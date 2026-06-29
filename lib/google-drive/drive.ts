import { DRIVE_ROOT_FOLDER_NAME } from "@/lib/google-drive/config";

// Google Drive REST v3 — fetch로 직접 호출.
// drive.file scope: 앱이 만든 파일/폴더만 보이고 다룰 수 있다.
// → files.list 검색도 앱이 만든 항목만 대상이라, 이름 기반 폴더 재사용이 안전·멱등하다.

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function escapeQueryValue(value: string): string {
  // Drive query 문자열의 작은따옴표·역슬래시 이스케이프
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * 부모 폴더 아래에서 name과 일치하는 폴더를 찾고 없으면 생성 → folderId 반환.
 * parentId가 없으면 My Drive 루트 기준. 동시 생성 경합은 드물지만,
 * 먼저 검색→없으면 생성 순서라 재실행해도 같은(또는 신규 1개) 폴더로 수렴한다.
 */
export async function ensureFolder(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string> {
  const parentClause = parentId
    ? `and '${escapeQueryValue(parentId)}' in parents`
    : "and 'root' in parents";
  const q =
    `mimeType = '${FOLDER_MIME}' and name = '${escapeQueryValue(name)}' ` +
    `and trashed = false ${parentClause}`;

  const listUrl =
    `${DRIVE_API}/files?` +
    new URLSearchParams({
      q,
      fields: "files(id,name)",
      spaces: "drive",
      pageSize: "1",
    }).toString();

  const listRes = await driveFetch(accessToken, listUrl);
  if (listRes.ok) {
    const data = (await listRes.json()) as { files?: { id: string }[] };
    const existing = data.files?.[0]?.id;
    if (existing) return existing;
  } else if (listRes.status !== 404) {
    throw new Error(`Drive 폴더 조회 실패: ${listRes.status} ${await safeText(listRes)}`);
  }

  const createRes = await driveFetch(accessToken, `${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Drive 폴더 생성 실패: ${createRes.status} ${await safeText(createRes)}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

/** 앱 루트 폴더("관제 자료") 보장 */
export function ensureRootFolder(accessToken: string): Promise<string> {
  return ensureFolder(accessToken, DRIVE_ROOT_FOLDER_NAME, null);
}

export interface ExistingDriveFile {
  id: string;
  webViewLink: string | null;
}

/**
 * appProperties.documentId로 이미 업로드된 파일을 조회(멱등성 핵심).
 * 잡 행이 유실돼도 Drive에 같은 documentId 파일이 있으면 중복 업로드를 막는다.
 */
export async function findFileByDocumentId(
  accessToken: string,
  documentId: string,
): Promise<ExistingDriveFile | null> {
  const q =
    `appProperties has { key='documentId' and value='${escapeQueryValue(documentId)}' } ` +
    `and trashed = false`;
  const url =
    `${DRIVE_API}/files?` +
    new URLSearchParams({
      q,
      fields: "files(id,webViewLink)",
      spaces: "drive",
      pageSize: "1",
    }).toString();

  const res = await driveFetch(accessToken, url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    files?: { id: string; webViewLink?: string }[];
  };
  const file = data.files?.[0];
  return file ? { id: file.id, webViewLink: file.webViewLink ?? null } : null;
}

export interface UploadResult {
  id: string;
  webViewLink: string | null;
}

/**
 * 멀티파트 업로드(메타데이터 + 본문). documentId를 appProperties에 박아
 * 이후 재실행에서 findFileByDocumentId로 중복을 방지한다.
 */
export async function uploadFile(
  accessToken: string,
  params: {
    name: string;
    mimeType: string;
    parentId: string;
    documentId: string;
    tenantId: string;
    body: ArrayBuffer;
  },
): Promise<UploadResult> {
  const boundary = `gwanje-${params.documentId}-${params.body.byteLength}`;
  const metadata = {
    name: params.name,
    parents: [params.parentId],
    mimeType: params.mimeType,
    appProperties: {
      documentId: params.documentId,
      tenantId: params.tenantId,
      source: "gwanje",
    },
  };

  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${params.mimeType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const bodyBytes = new Uint8Array(
    head.byteLength + params.body.byteLength + tail.byteLength,
  );
  bodyBytes.set(head, 0);
  bodyBytes.set(new Uint8Array(params.body), head.byteLength);
  bodyBytes.set(tail, head.byteLength + params.body.byteLength);

  const url =
    `${DRIVE_UPLOAD_API}/files?` +
    new URLSearchParams({ uploadType: "multipart", fields: "id,webViewLink" }).toString();

  const res = await driveFetch(accessToken, url, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: bodyBytes,
  });
  if (!res.ok) {
    throw new Error(`Drive 업로드 실패: ${res.status} ${await safeText(res)}`);
  }
  const data = (await res.json()) as { id: string; webViewLink?: string };
  return { id: data.id, webViewLink: data.webViewLink ?? null };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

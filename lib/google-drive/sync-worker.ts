import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { decryptRefreshToken } from "@/lib/google-drive/crypto";
import {
  RefreshTokenInvalidError,
  refreshAccessToken,
} from "@/lib/google-drive/oauth";
import {
  ensureFolder,
  ensureRootFolder,
  findFileByDocumentId,
  uploadFile,
} from "@/lib/google-drive/drive";

type Service = SupabaseClient<Database>;
type Job = Database["public"]["Tables"]["google_drive_sync_jobs"]["Row"];

const MAX_ATTEMPTS = 5;
// 시도 횟수별 백오프(분) — 일시적 오류(네트워크·rate limit)에 점증 재시도
const BACKOFF_MINUTES = [1, 5, 15, 60, 180];
// 'processing'으로 잡은 채 워커가 죽으면(서버리스 타임아웃 등) 잡이 영구히 묶인다.
// 이 시간보다 오래 processing이면 유실로 보고 pending으로 되돌려 재처리한다.
const STALE_PROCESSING_MINUTES = 10;

function nextRunAtIso(attempts: number): string {
  const idx = Math.min(attempts - 1, BACKOFF_MINUTES.length - 1);
  const minutes = BACKOFF_MINUTES[Math.max(0, idx)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export interface SyncRunResult {
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
}

/** 처리 대기 잡을 batchSize만큼 집어 처리 */
export async function runSyncBatch(
  service: Service,
  batchSize = 10,
): Promise<SyncRunResult> {
  const nowIso = new Date().toISOString();

  // 0) 유실된(오래 processing) 잡 회수 → pending. attempts는 보존(이미 1회 차감됨).
  //    set_updated_at 트리거 덕분에 갓 클레임한 잡의 updated_at은 최신이라 회수 대상이 아니다.
  const staleBeforeIso = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60_000,
  ).toISOString();
  const { error: reclaimError } = await service
    .from("google_drive_sync_jobs")
    .update({ status: "pending" })
    .eq("status", "processing")
    .lt("updated_at", staleBeforeIso);
  if (reclaimError) {
    console.error("[runSyncBatch:reclaim]", reclaimError.code, reclaimError.message);
  }

  const { data: dueJobs, error } = await service
    .from("google_drive_sync_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(batchSize);
  if (error) {
    throw new Error(`잡 조회 실패: ${error.message}`);
  }

  const result: SyncRunResult = { claimed: 0, succeeded: 0, failed: 0, retried: 0 };

  for (const job of dueJobs ?? []) {
    // 원자적 클레임 — pending인 동안에만 processing으로 전환(중복 실행 방지)
    const { data: claimed, error: claimError } = await service
      .from("google_drive_sync_jobs")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;
    result.claimed += 1;

    const attempts = job.attempts + 1;
    try {
      await processJob(service, job);
      result.succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanent = isPermanent(err);
      if (permanent || attempts >= MAX_ATTEMPTS) {
        await service
          .from("google_drive_sync_jobs")
          .update({ status: "failed", last_error: message.slice(0, 1000) })
          .eq("id", job.id);
        result.failed += 1;
      } else {
        await service
          .from("google_drive_sync_jobs")
          .update({
            status: "pending",
            last_error: message.slice(0, 1000),
            next_run_at: nextRunAtIso(attempts),
          })
          .eq("id", job.id);
        result.retried += 1;
      }
    }
  }

  return result;
}

class PermanentError extends Error {}
function isPermanent(err: unknown): boolean {
  return err instanceof PermanentError;
}

async function processJob(service: Service, job: Job): Promise<void> {
  // 1) 사용자의 유효한 연결
  const { data: connection, error: connError } = await service
    .from("google_drive_connections")
    .select("id, encrypted_refresh_token, root_folder_id, revoked_at")
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (connError) throw new Error(`연결 조회 실패: ${connError.message}`);
  if (!connection || connection.revoked_at) {
    throw new PermanentError("Google Drive 연결이 없거나 해제되었습니다.");
  }

  // 2) access token 발급
  const refreshToken = decryptRefreshToken(connection.encrypted_refresh_token);
  let accessToken: string;
  try {
    ({ accessToken } = await refreshAccessToken(refreshToken));
  } catch (err) {
    // refresh token 영구 폐기(사용자 액세스 철회 등) → 연결 해제 처리 후 영구 실패.
    // 무의미한 백오프 재시도(최대 ~4시간)와 배치 슬롯 점유를 막는다.
    if (err instanceof RefreshTokenInvalidError) {
      await service
        .from("google_drive_connections")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", connection.id);
      throw new PermanentError(
        "Google Drive 접근이 철회되어 연결을 해제했습니다. 설정에서 재연결해 주세요.",
      );
    }
    throw err;
  }

  // 3) 이미 업로드됐는지 확인(멱등) — 잡 유실/중복 실행 대비
  const existing = await findFileByDocumentId(accessToken, job.document_id);
  if (existing) {
    await markSucceeded(service, job.id, existing.id, existing.webViewLink);
    return;
  }

  // 4) 폴더 구조: 관제 자료 / {기업명}
  let rootFolderId = connection.root_folder_id;
  if (!rootFolderId) {
    rootFolderId = await ensureRootFolder(accessToken);
    await service
      .from("google_drive_connections")
      .update({ root_folder_id: rootFolderId })
      .eq("id", connection.id);
  }
  const companyName = await getCompanyName(service, job.document_id);
  const companyFolderId = await ensureFolder(
    accessToken,
    companyName,
    rootFolderId,
  );

  // 5) Supabase Storage에서 파일 본문 다운로드(service role → RLS 우회)
  const { data: blob, error: dlError } = await service.storage
    .from(job.storage_bucket)
    .download(job.storage_path);
  if (dlError || !blob) {
    throw new Error(`Storage 다운로드 실패: ${dlError?.message ?? "본문 없음"}`);
  }
  const body = await blob.arrayBuffer();

  // 6) Drive 업로드
  const uploaded = await uploadFile(accessToken, {
    name: job.file_name,
    mimeType: job.mime_type || "application/octet-stream",
    parentId: companyFolderId,
    documentId: job.document_id,
    tenantId: job.tenant_id,
    body,
  });

  await markSucceeded(service, job.id, uploaded.id, uploaded.webViewLink);
}

async function markSucceeded(
  service: Service,
  jobId: string,
  fileId: string,
  webViewLink: string | null,
): Promise<void> {
  await service
    .from("google_drive_sync_jobs")
    .update({
      status: "succeeded",
      google_drive_file_id: fileId,
      google_drive_web_view_link: webViewLink,
      last_error: null,
    })
    .eq("id", jobId);
}

async function getCompanyName(
  service: Service,
  documentId: string,
): Promise<string> {
  const { data: doc } = await service
    .from("document")
    .select("company_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc?.company_id) return "미분류";
  const { data: company } = await service
    .from("company")
    .select("name")
    .eq("id", doc.company_id)
    .maybeSingle();
  return company?.name?.trim() || "미분류";
}

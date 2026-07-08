import { decode } from "iconv-lite";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseCompanyDocumentStorageUrl } from "@/lib/storage";
import { isReportSourceSupported, normalizeReportFileType } from "@/lib/reports/file-types";

type Service = SupabaseClient<Database>;

export interface ExtractableDocument {
  id: string;
  name: string;
  file_type: string | null;
  storage_url: string | null;
}

export class UnsupportedReportSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedReportSourceError";
  }
}

const MAX_EXTRACTED_CHARS = 80_000;

function clipText(text: string): string {
  const cleaned = text.replace(/\u0000/g, "").trim();
  return cleaned.length > MAX_EXTRACTED_CHARS
    ? `${cleaned.slice(0, MAX_EXTRACTED_CHARS)}\n\n[본문 일부 생략]`
    : cleaned;
}

function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    // Windows Excel/한글 메모장에서 저장된 CSV/TXT가 흔히 CP949다.
    return decode(Buffer.from(data), "cp949");
  }
}

async function extractPdf(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    if (text.trim()) pages.push(text.trim());
  }
  return pages.join("\n\n");
}

async function extractDocx(data: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
  return result.value;
}

export async function extractDocumentText(
  service: Service,
  document: ExtractableDocument,
): Promise<string> {
  const fileType = normalizeReportFileType(document.file_type);
  if (!isReportSourceSupported(fileType)) {
    throw new UnsupportedReportSourceError(
      `'${document.name}'은(는) 보고서 생성에 사용할 수 없는 파일 형식입니다.`,
    );
  }

  const storage = parseCompanyDocumentStorageUrl(document.storage_url);
  if (!storage) {
    throw new Error(`'${document.name}'의 Storage 경로를 찾을 수 없습니다.`);
  }

  const { data: blob, error } = await service.storage
    .from(storage.bucket)
    .download(storage.path);
  if (error || !blob) {
    throw new Error(
      `'${document.name}' 다운로드에 실패했습니다: ${error?.message ?? "본문 없음"}`,
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text: string;
  if (fileType === "pdf") text = await extractPdf(bytes);
  else if (fileType === "docx") text = await extractDocx(bytes);
  else text = decodeText(bytes);

  const clipped = clipText(text);
  if (!clipped) {
    throw new UnsupportedReportSourceError(
      `'${document.name}'에서 텍스트를 추출하지 못했습니다. 스캔본 PDF나 이미지 파일은 아직 지원하지 않습니다.`,
    );
  }
  return clipped;
}

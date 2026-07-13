export const COMPANY_DOCUMENTS_BUCKET = "company-documents";
export const COMPANY_DOCUMENTS_MAX_BYTES = 50 * 1024 * 1024;

const COMPANY_DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
};

export const COMPANY_DOCUMENT_ALLOWED_MIME_TYPES = new Set(
  [
    ...Object.values(COMPANY_DOCUMENT_MIME_BY_EXTENSION),
    "application/haansofthwp",
    "application/vnd.hancom.hwp",
  ],
);

export function getFileExtension(fileName: string): string | null {
  const last = fileName.split(".").pop()?.trim().toLowerCase();
  if (!last || last === fileName.toLowerCase()) return null;
  return last.slice(0, 16);
}

export function normalizeCompanyDocumentMimeType(
  fileName: string,
  mimeType: string | null | undefined,
): string | null {
  const normalized = mimeType?.trim().toLowerCase() ?? "";
  if (COMPANY_DOCUMENT_ALLOWED_MIME_TYPES.has(normalized)) return normalized;

  const extension = getFileExtension(fileName);
  return extension ? (COMPANY_DOCUMENT_MIME_BY_EXTENSION[extension] ?? null) : null;
}

export function storageUrlFromPath(path: string): string {
  return `supabase://${COMPANY_DOCUMENTS_BUCKET}/${path}`;
}

export function parseCompanyDocumentStorageUrl(
  value: string | null,
): { bucket: string; path: string } | null {
  if (!value) return null;

  const prefix = `supabase://${COMPANY_DOCUMENTS_BUCKET}/`;
  if (value.startsWith(prefix)) {
    return { bucket: COMPANY_DOCUMENTS_BUCKET, path: value.slice(prefix.length) };
  }

  const legacyPrefix = `${COMPANY_DOCUMENTS_BUCKET}/`;
  if (value.startsWith(legacyPrefix)) {
    return { bucket: COMPANY_DOCUMENTS_BUCKET, path: value.slice(legacyPrefix.length) };
  }

  return null;
}

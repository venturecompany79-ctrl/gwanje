export const COMPANY_DOCUMENTS_BUCKET = "company-documents";
export const COMPANY_DOCUMENTS_MAX_BYTES = 50 * 1024 * 1024;

export function getFileExtension(fileName: string): string | null {
  const last = fileName.split(".").pop()?.trim().toLowerCase();
  if (!last || last === fileName.toLowerCase()) return null;
  return last.slice(0, 16);
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

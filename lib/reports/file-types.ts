const REPORT_SOURCE_TYPES = new Set(["pdf", "docx", "txt", "md", "csv", "json"]);

export function normalizeReportFileType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^\./, "");
}

export function isReportSourceSupported(
  fileType: string | null | undefined,
): boolean {
  return REPORT_SOURCE_TYPES.has(normalizeReportFileType(fileType));
}

export function reportSourceHelpText(): string {
  return "PDF, DOCX, TXT, MD, CSV, JSON";
}

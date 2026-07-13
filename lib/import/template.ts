// 임포트 템플릿 정의 + 생성 — 클라이언트 전용 (xlsx는 이 모듈을 dynamic import해 로드)
import * as XLSX from "xlsx";
import { TEMPLATE_CREDENTIAL_SLOTS } from "./types";

// 헤더는 "괄호 안내·별표·공백 제거" 후 비교하므로 표기를 다듬어도 매칭된다 (parse-template.ts)
export const COMPANY_HEADERS = [
  "기업명*",
  "사업자번호",
  "업종",
  "업태",
  "지역",
  "설립일(YYYY-MM-DD)",
  "연매출(억원)",
  "인원수",
  "대표자명",
  "담당자명",
  "담당자연락처",
  "담당자이메일",
  "태그(쉼표구분)",
  "메모",
] as const;

export function credentialHeaders(slot: number): string[] {
  return [
    `자격${slot}_종류`,
    `자격${slot}_분류`,
    `자격${slot}_발급일(YYYY-MM-DD)`,
    `자격${slot}_만료일(YYYY-MM-DD)`,
  ];
}

export function templateHeaders(): string[] {
  const headers: string[] = [...COMPANY_HEADERS];
  for (let slot = 1; slot <= TEMPLATE_CREDENTIAL_SLOTS; slot += 1) {
    headers.push(...credentialHeaders(slot));
  }
  return headers;
}

/** 이 접두사로 시작하는 기업명 행은 예시로 간주해 파싱에서 제외한다 */
export const EXAMPLE_ROW_PREFIX = "예시)";

export function exampleRow(categoryNames: string[]): (string | number)[] {
  const category = categoryNames[0] ?? "인증";
  return [
    `${EXAMPLE_ROW_PREFIX}한빛테크`,
    "123-45-67890",
    "제조업",
    "금속가공",
    "경기 안산",
    "2018-03-15",
    25,
    12,
    "김한빛",
    "이담당",
    "010-1234-5678",
    "contact@hanbit.co.kr",
    "성장기, 수출기업",
    "주력 제품: 정밀 부품",
    "ISO 9001",
    category,
    "2024-01-10",
    "2027-01-09",
    "벤처기업확인",
    category,
    "2023-05-01",
    "2026-04-30",
    "",
    "",
    "",
    "",
  ];
}

export const TEMPLATE_SHEET_NAME = "기업목록";
export const TEMPLATE_FILE_BASENAME = "gwanje_기업_임포트_템플릿";

/** xlsx 템플릿 생성·다운로드 (예시 1행 포함 — 예시 행은 파싱에서 자동 제외) */
export function downloadTemplateXlsx(categoryNames: string[]): void {
  const headers = templateHeaders();
  const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow(categoryNames)]);
  sheet["!cols"] = headers.map((h) => ({
    wch: Math.max(12, h.length + 6),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, TEMPLATE_SHEET_NAME);
  XLSX.writeFile(book, `${TEMPLATE_FILE_BASENAME}.xlsx`);
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV 템플릿 다운로드 (BOM 포함 — 엑셀에서 한글 깨짐 방지, ExportButton과 동일 패턴) */
export function downloadTemplateCsv(categoryNames: string[]): void {
  const lines = [
    templateHeaders().map(csvCell).join(","),
    exampleRow(categoryNames).map(csvCell).join(","),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${TEMPLATE_FILE_BASENAME}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

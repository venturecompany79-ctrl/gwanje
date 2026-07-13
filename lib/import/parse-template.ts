// 업로드 파일(xlsx/csv) → DraftCompanyRow[] — 클라이언트 전용 (xlsx 포함, dynamic import로 로드)
import * as XLSX from "xlsx";
import {
  COMPANY_HEADERS,
  credentialHeaders,
  EXAMPLE_ROW_PREFIX,
} from "./template";
import type { DraftCompanyRow, DraftCredential } from "./types";
import { TEMPLATE_CREDENTIAL_SLOTS } from "./types";

/** 템플릿 헤더를 찾지 못했을 때 — UI에서 "AI 가져오기" 안내로 분기 */
export class TemplateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateFormatError";
  }
}

/** 헤더 비교 키 — 별표·괄호 안내·공백 제거 (예: "설립일(YYYY-MM-DD)" → "설립일") */
function headerKey(value: unknown): string {
  return String(value ?? "")
    .replace(/\(.*?\)/g, "")
    .replace(/[*\s]/g, "")
    .trim();
}

type CellValue = string | number | boolean | Date | null | undefined;

function cellText(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Excel 날짜 serial(1900 기준) → YYYY-MM-DD */
function serialToDateString(serial: number): string {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return String(serial);
  return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
}

/**
 * 날짜 셀 → "YYYY-MM-DD". Date 객체(cellDates)·serial 숫자·문자열(구분자 다양) 모두 수용.
 * 변환 불가한 값은 원문 그대로 반환해 validate 단계에서 오류로 표시되게 한다.
 */
export function cellToDateString(value: CellValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    // cellDates:true가 만든 Date는 로컬 자정 기준 — 로컬 게터로 읽어야 하루 밀림이 없다
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === "number") return serialToDateString(value);
  const text = String(value).trim();
  const m = text.match(/^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})[일\s]*$/);
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  return text;
}

/** 숫자 셀 → number. "1,200" 같은 콤마 표기 수용. 변환 불가 시 NaN(validate에서 오류 표시) */
function cellToNumber(value: CellValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isNaN(n) ? NaN : n;
}

function splitTags(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const REQUIRED_KEY = headerKey(COMPANY_HEADERS[0]); // "기업명"

interface HeaderIndex {
  [key: string]: number;
}

function buildHeaderIndex(headerRow: CellValue[]): HeaderIndex {
  const index: HeaderIndex = {};
  headerRow.forEach((cell, i) => {
    const key = headerKey(cell);
    if (key && !(key in index)) index[key] = i;
  });
  return index;
}

function makeRowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Math.random().toString(36).slice(2)}`;
}

function rowToDraft(
  cells: CellValue[],
  index: HeaderIndex,
  sourceRef: string,
): DraftCompanyRow {
  const at = (header: string): CellValue => {
    const i = index[headerKey(header)];
    return i === undefined ? null : cells[i];
  };

  const credentials: DraftCredential[] = [];
  for (let slot = 1; slot <= TEMPLATE_CREDENTIAL_SLOTS; slot += 1) {
    const [typeH, categoryH, issuedH, expiresH] = credentialHeaders(slot);
    const type = cellText(at(typeH));
    if (!type) continue;
    credentials.push({
      type,
      categoryName: cellText(at(categoryH)),
      categoryId: null,
      issuedDate: cellToDateString(at(issuedH)),
      expiresDate: cellToDateString(at(expiresH)),
      memo: null,
    });
  }

  return {
    rowId: makeRowId(),
    sourceRef,
    include: true,
    name: cellText(at("기업명*")) ?? "",
    bizNo: cellText(at("사업자번호")),
    industry: cellText(at("업종")),
    businessCondition: cellText(at("업태")),
    foundedDate: cellToDateString(at("설립일(YYYY-MM-DD)")),
    region: cellText(at("지역")),
    revenueEok: cellToNumber(at("연매출(억원)")),
    headcount: cellToNumber(at("인원수")),
    ceoName: cellText(at("대표자명")),
    contactName: cellText(at("담당자명")),
    contactPhone: cellText(at("담당자연락처")),
    contactEmail: cellText(at("담당자이메일")),
    conditionTags: splitTags(cellText(at("태그(쉼표구분)"))),
    memo: cellText(at("메모")),
    credentials,
    errors: [],
    warnings: [],
    duplicateName: null,
    confirmDuplicate: false,
  };
}

function isEmptyRow(cells: CellValue[]): boolean {
  return cells.every((c) => cellText(c) === null);
}

/** 템플릿 파일 파싱 — 첫 시트의 헤더를 템플릿 컬럼과 매칭해 초안 행 생성 */
export function parseTemplateWorkbook(data: ArrayBuffer): DraftCompanyRow[] {
  const book = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = book.SheetNames[0];
  const sheet = sheetName ? book.Sheets[sheetName] : undefined;
  if (!sheet) throw new TemplateFormatError("시트를 찾을 수 없습니다.");

  const matrix = XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
    header: 1,
    defval: null,
  });
  if (matrix.length === 0) throw new TemplateFormatError("파일이 비어 있습니다.");

  const index = buildHeaderIndex(matrix[0]);
  if (!(REQUIRED_KEY in index)) {
    throw new TemplateFormatError(
      "템플릿 형식이 아닙니다. 템플릿을 내려받아 작성하거나, AI 가져오기를 사용해 보세요.",
    );
  }

  const rows: DraftCompanyRow[] = [];
  matrix.slice(1).forEach((cells, i) => {
    if (isEmptyRow(cells)) return;
    const draft = rowToDraft(cells, index, `${i + 2}행`);
    if (draft.name.startsWith(EXAMPLE_ROW_PREFIX)) return; // 예시 행 제외
    rows.push(draft);
  });
  return rows;
}

/** AI 경로용: 통째로 시트별 CSV 텍스트 추출 (서버로는 이 텍스트만 전송) */
export interface SheetCsv {
  name: string;
  csv: string;
}

/** AI 파싱에 보낼 시트 텍스트 상한 (전체 합산) */
export const AI_SHEET_TEXT_LIMIT = 200_000;
/** 시트당 최대 행 수 */
export const AI_SHEET_ROW_LIMIT = 1_000;

export function extractSheetsAsCsv(data: ArrayBuffer): SheetCsv[] {
  const book = XLSX.read(data, { type: "array", cellDates: true });
  return book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
      header: 1,
      defval: null,
    });
    const trimmed = matrix
      .slice(0, AI_SHEET_ROW_LIMIT)
      .filter((cells) => !isEmptyRow(cells))
      .map((cells) =>
        cells
          .map((c) => {
            if (c instanceof Date) return cellToDateString(c) ?? "";
            const s = c === null || c === undefined ? "" : String(c);
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      );
    return { name, csv: trimmed.join("\n") };
  }).filter((s) => s.csv.trim() !== "");
}

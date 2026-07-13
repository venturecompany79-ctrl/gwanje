// 임포트 초안 행 검증 — 순수 함수 (클라이언트 미리보기 + 서버 재검증 양쪽에서 사용)
// datetime은 상대 경로로 import — 스모크 스크립트(tsc 일회 컴파일)가 alias 없이 실행 가능해야 함
import { isValidDateString } from "../datetime";
import type {
  DraftCompanyRow,
  DraftCredential,
  ImportCategoryOption,
  ImportExistingCompany,
} from "./types";

/** 공백·대소문자 무시 정규화 (상호 유사중복 비교용 — addCompany와 동일 기준) */
export function normalizeCompanyName(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function bizNoDigits(value: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

/** 숫자 10자리 사업자번호 → "000-00-00000" 표기 정규화 (그 외는 원문 유지) */
export function formatBizNo(value: string | null): string | null {
  if (!value) return null;
  const digits = bizNoDigits(value);
  if (digits.length !== 10) return value.trim() || null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidateContext {
  /** 기존 등록 기업 (중복 의심 표시용) */
  existing: ImportExistingCompany[];
  /** 테넌트 자격 분류 (분류명 → categoryId 매칭용) */
  categories: ImportCategoryOption[];
}

function matchCategoryId(
  categoryName: string | null,
  categories: ImportCategoryOption[],
): string | null {
  if (!categoryName) return null;
  const norm = normalizeCompanyName(categoryName);
  const found = categories.find((c) => normalizeCompanyName(c.name) === norm);
  return found?.id ?? null;
}

function validateCredential(
  cred: DraftCredential,
  categories: ImportCategoryOption[],
  errors: string[],
  warnings: string[],
): DraftCredential | null {
  const type = cred.type.trim();
  if (!type) {
    warnings.push("종류가 빈 자격 항목은 제외됩니다.");
    return null;
  }
  if (cred.issuedDate && !isValidDateString(cred.issuedDate)) {
    errors.push(`자격 "${type}"의 발급일이 YYYY-MM-DD 형식이 아닙니다: ${cred.issuedDate}`);
  }
  if (cred.expiresDate && !isValidDateString(cred.expiresDate)) {
    errors.push(`자격 "${type}"의 만료일이 YYYY-MM-DD 형식이 아닙니다: ${cred.expiresDate}`);
  }
  if (
    cred.issuedDate &&
    cred.expiresDate &&
    isValidDateString(cred.issuedDate) &&
    isValidDateString(cred.expiresDate) &&
    cred.expiresDate < cred.issuedDate
  ) {
    errors.push(`자격 "${type}"의 만료일이 발급일보다 빠릅니다.`);
  }
  const categoryId = matchCategoryId(cred.categoryName, categories);
  if (cred.categoryName && !categoryId) {
    warnings.push(
      `자격 "${type}"의 분류 "${cred.categoryName}"이(가) 설정된 분류와 일치하지 않아 분류 없이 등록됩니다.`,
    );
  }
  return { ...cred, type, categoryId };
}

/** 행 하나 검증 — errors/warnings/duplicateName/categoryId를 채워 반환 (원본 불변) */
export function validateDraftRow(
  row: DraftCompanyRow,
  ctx: ValidateContext,
): DraftCompanyRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = row.name.trim();
  if (!name) errors.push("기업명이 비어 있습니다.");

  if (row.foundedDate && !isValidDateString(row.foundedDate)) {
    errors.push(`설립일이 YYYY-MM-DD 형식이 아닙니다: ${row.foundedDate}`);
  }
  if (row.revenueEok !== null && (!Number.isFinite(row.revenueEok) || row.revenueEok < 0)) {
    errors.push("연 매출은 0 이상의 숫자(억 원)여야 합니다.");
  }
  if (
    row.headcount !== null &&
    (!Number.isInteger(row.headcount) || row.headcount < 0)
  ) {
    errors.push("인원수는 0 이상의 정수여야 합니다.");
  }

  const digits = bizNoDigits(row.bizNo);
  if (row.bizNo && digits.length !== 10) {
    warnings.push(`사업자번호가 10자리가 아닙니다: ${row.bizNo}`);
  }
  if (row.contactEmail && !EMAIL_PATTERN.test(row.contactEmail)) {
    warnings.push(`이메일 형식을 확인해 주세요: ${row.contactEmail}`);
  }

  const credentials = row.credentials
    .map((cred) => validateCredential(cred, ctx.categories, errors, warnings))
    .filter((cred): cred is DraftCredential => cred !== null);

  // 기존 DB 중복 의심 (addCompany 중복 검사와 동일 기준: 정규화 상호 or 사업자번호 일치)
  let duplicateName: string | null = null;
  if (name) {
    const normName = normalizeCompanyName(name);
    const match = ctx.existing.find((c) => {
      const cDigits = bizNoDigits(c.bizNo);
      if (digits.length === 10 && cDigits.length === 10 && digits === cDigits) return true;
      return normalizeCompanyName(c.name) === normName;
    });
    duplicateName = match?.name ?? null;
  }

  return {
    ...row,
    name,
    bizNo: formatBizNo(row.bizNo),
    credentials,
    errors,
    warnings,
    duplicateName,
    include: errors.length === 0 && row.include,
  };
}

/** 전체 행 검증 — 행별 검증 + 파일 내부 중복(뒤 행 error) */
export function validateDraftRows(
  rows: DraftCompanyRow[],
  ctx: ValidateContext,
): DraftCompanyRow[] {
  const seenNames = new Map<string, string>(); // 정규화 상호 → sourceRef
  const seenBizNos = new Map<string, string>();

  return rows.map((raw) => {
    const row = validateDraftRow(raw, ctx);
    const normName = normalizeCompanyName(row.name);
    const digits = bizNoDigits(row.bizNo);

    const dupErrors: string[] = [];
    if (normName && seenNames.has(normName)) {
      dupErrors.push(`파일 내 같은 기업명이 이미 있습니다 (${seenNames.get(normName)}).`);
    }
    if (digits.length === 10 && seenBizNos.has(digits)) {
      dupErrors.push(`파일 내 같은 사업자번호가 이미 있습니다 (${seenBizNos.get(digits)}).`);
    }
    if (normName && !seenNames.has(normName)) seenNames.set(normName, row.sourceRef);
    if (digits.length === 10 && !seenBizNos.has(digits)) seenBizNos.set(digits, row.sourceRef);

    if (dupErrors.length === 0) return row;
    return {
      ...row,
      errors: [...row.errors, ...dupErrors],
      include: false,
    };
  });
}

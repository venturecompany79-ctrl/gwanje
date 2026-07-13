// 기업 대량 임포트(GWJ-030) 공통 중간 표현 — 템플릿/AI 두 경로가 이 타입으로 수렴한다.
// 클라이언트(미리보기 편집)와 서버(재검증·등록)가 공유하므로 순수 타입만 둔다.

export interface DraftCredential {
  /** 자격·인증 종류 (credential.type, 필수) */
  type: string;
  /** 원본 파일에 적힌 분류명 — 테넌트 category 매칭 전 원문 */
  categoryName: string | null;
  /** 테넌트 category 매칭 결과 (미매칭이면 null로 등록) */
  categoryId: string | null;
  /** YYYY-MM-DD */
  issuedDate: string | null;
  expiresDate: string | null;
  memo: string | null;
}

export interface DraftCompanyRow {
  /** 클라이언트 생성 UUID — 등록 결과 매칭 키 */
  rowId: string;
  /** 오류 위치 안내용 원본 참조 (예: "기업목록 시트 3행") */
  sourceRef: string;
  /** 미리보기 체크박스 — 등록 대상 여부 (오류 행은 자동 false) */
  include: boolean;
  name: string;
  bizNo: string | null;
  industry: string | null;
  businessCondition: string | null;
  /** YYYY-MM-DD */
  foundedDate: string | null;
  region: string | null;
  /** 억 원 단위 — 등록 시 원(₩)으로 환산 */
  revenueEok: number | null;
  headcount: number | null;
  ceoName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  conditionTags: string[];
  memo: string | null;
  credentials: DraftCredential[];
  /** 있으면 등록 차단 (행 단위) */
  errors: string[];
  /** 등록은 허용, 배지로만 표시 */
  warnings: string[];
  /** 기존 등록 기업과 상호·사업자번호 중복 의심 — 일치한 기업명 */
  duplicateName: string | null;
  /** 사용자가 "중복 아님, 그대로 등록" 확인 */
  confirmDuplicate: boolean;
}

export interface ImportCategoryOption {
  id: string;
  name: string;
}

export interface ImportExistingCompany {
  name: string;
  bizNo: string | null;
}

/** 행별 등록 결과 (bulkImportCompanies 반환) */
export interface ImportRowResult {
  rowId: string;
  name: string;
  ok: boolean;
  companyId?: string;
  /** 실패 사유 (ok=false) */
  error?: string;
  /** 기업은 저장됐지만 일부 실패 (예: 자격 생성 실패) */
  warning?: string;
}

/** 한 번에 등록 가능한 행 수 상한 */
export const IMPORT_MAX_ROWS = 200;

/** 템플릿의 자격 wide 컬럼 세트 수 */
export const TEMPLATE_CREDENTIAL_SLOTS = 3;

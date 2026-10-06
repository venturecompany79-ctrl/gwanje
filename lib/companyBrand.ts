// 기업 브랜드(로고·기업명 컬러) — 팔레트·검증·CSS 조립. 클라이언트/서버 공용 순수 모듈.
// 색은 사용자 데이터지만 임의 색은 받지 않는다(CLAUDE.md §5): 다크 표면(canvas·hover·body)
// 위 글자 대비 5:1 이상으로 실측한 팔레트에서만 고른다.

export const COMPANY_BRAND_COLORS = [
  { value: "#7cb0ff", label: "블루" },
  { value: "#5cc8ef", label: "스카이" },
  { value: "#3fd0bd", label: "틸" },
  { value: "#5fd38a", label: "그린" },
  { value: "#b5dc4f", label: "라임" },
  { value: "#f2cf4a", label: "옐로" },
  { value: "#ff9f5a", label: "오렌지" },
  { value: "#ff8f80", label: "코랄" },
  { value: "#f78fc8", label: "핑크" },
  { value: "#b79bff", label: "퍼플" },
  { value: "#d3a6f5", label: "라벤더" },
  { value: "#a9b8cc", label: "슬레이트" },
] as const;

const BRAND_COLOR_SET = new Set<string>(COMPANY_BRAND_COLORS.map((c) => c.value));

export function isCompanyBrandColor(value: string | null | undefined): value is string {
  return typeof value === "string" && BRAND_COLOR_SET.has(value);
}

export const COMPANY_LOGOS_BUCKET = "company-logos";
export const COMPANY_LOGO_MAX_BYTES = 1024 * 1024;
export const COMPANY_LOGO_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp(`^${UUID}$`);
// {tenant_id}/{company_id}/{uuid}.{ext} — 업로드 준비 액션이 만드는 형태만 통과
const LOGO_PATH_RE = new RegExp(`^${UUID}/(${UUID})/${UUID}\\.(png|jpg|jpeg|webp)$`);

export function isCompanyLogoPath(path: string | null | undefined, companyId: string): boolean {
  if (!path) return false;
  const match = LOGO_PATH_RE.exec(path);
  return Boolean(match && match[1] === companyId);
}

export function companyLogoUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${COMPANY_LOGOS_BUCKET}/${path}`;
}

export interface CompanyBrandEntry {
  id: string;
  color: string | null;
  /** 완성된 공개 URL (데모는 로컬 정적 경로) */
  logoUrl: string | null;
}

/**
 * 기업 id → 브랜드 CSS. `.co-name`·`.co-mark` 가 data-co 로 이 규칙을 집는다.
 * 색은 팔레트 화이트리스트, id는 uuid, URL은 따옴표·괄호·역슬래시가 없을 때만 통과 →
 * <style> 탈출이나 url() 주입 불가.
 */
export function buildCompanyBrandCss(entries: CompanyBrandEntry[]): string {
  return entries
    .filter(({ id }) => UUID_RE.test(id))
    .map(({ id, color, logoUrl }) => {
      const sel = `[data-co="${id}"]`;
      let css = "";
      if (isCompanyBrandColor(color)) css += `${sel}{--co-color:${color};}`;
      if (logoUrl && !/["'()\\\s<>]/.test(logoUrl)) {
        css += `.co-mark.co-mark${sel}{background:#fff url("${logoUrl}") center/78% no-repeat;border-color:transparent;color:transparent;}`;
      }
      return css;
    })
    .join("");
}

/** 이니셜 아이콘 글자 — 법인 표기(주식회사·(주) 등)를 건너뛴 첫 글자 */
export function companyInitial(name: string): string {
  const cleaned = name
    .replace(/^\s*(주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|\(주\)|\(유\)|㈜)\s*/u, "")
    .trim();
  return Array.from(cleaned || name.trim())[0]?.toUpperCase() ?? "?";
}

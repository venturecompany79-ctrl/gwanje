import type { GovProgramSlim } from "@/lib/gov-programs/types";

export const REGION_OPTIONS = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

export type RegionOption = (typeof REGION_OPTIONS)[number];

export const REGION_ALIASES: Record<RegionOption, string[]> = {
  서울: ["서울", "서울특별시"],
  부산: ["부산", "부산광역시"],
  대구: ["대구", "대구광역시"],
  인천: ["인천", "인천광역시"],
  광주: ["광주", "광주광역시"],
  대전: ["대전", "대전광역시"],
  울산: ["울산", "울산광역시"],
  세종: ["세종", "세종특별자치시"],
  경기: ["경기", "경기도"],
  강원: ["강원", "강원도", "강원특별자치도"],
  충북: ["충북", "충청북도"],
  충남: ["충남", "충청남도"],
  전북: ["전북", "전라북도", "전북특별자치도"],
  전남: ["전남", "전라남도"],
  경북: ["경북", "경상북도"],
  경남: ["경남", "경상남도"],
  제주: ["제주", "제주도", "제주특별자치도"],
};

export const NATIONAL_REGION_KEYWORDS = ["전국", "지역무관", "전지역", "전국공통"];

type ProgramRegionSource = Pick<GovProgramSlim, "region" | "hashtags">;

export function compactRegionText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export function matchesRegionAlias(value: string, aliases: string[]): boolean {
  const normalized = compactRegionText(value);
  return aliases.some((alias) => normalized.includes(compactRegionText(alias)));
}

export function hasNationalRegionText(value: string | null | undefined): boolean {
  if (!value) return false;
  return NATIONAL_REGION_KEYWORDS.some((keyword) =>
    compactRegionText(value).includes(compactRegionText(keyword)),
  );
}

export function extractProgramRegions(
  program: ProgramRegionSource,
): RegionOption[] {
  const regions = new Set<RegionOption>();
  const candidates = [program.region, ...program.hashtags];
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    for (const region of REGION_OPTIONS) {
      if (matchesRegionAlias(candidate, REGION_ALIASES[region])) {
        regions.add(region);
      }
    }
  }
  return [...regions];
}

export function isNationalProgram(program: ProgramRegionSource): boolean {
  if (hasNationalRegionText(program.region)) return true;
  if (program.hashtags.some(hasNationalRegionText)) return true;
  return !program.region?.trim() && extractProgramRegions(program).length === 0;
}

/**
 * 자유 텍스트 기업 지역("서울특별시 강남구" 등)을 광역 단위로 판정.
 * "광주"처럼 모호한 표기(경기도 광주시 vs 광주광역시)는 오판 가능 —
 * 점수에서 지역 불일치를 배제가 아닌 감점으로만 쓰는 이유.
 */
export function companyRegionOption(region: string | null): RegionOption | null {
  if (!region?.trim()) return null;
  const normalized = compactRegionText(region);
  let best: { option: RegionOption; aliasLength: number } | null = null;
  for (const option of REGION_OPTIONS) {
    for (const alias of REGION_ALIASES[option]) {
      const compact = compactRegionText(alias);
      if (!normalized.includes(compact)) continue;
      // 가장 긴 alias 우선 — "경기도 광주시"가 "광주"보다 "경기도"로 판정되게.
      if (!best || compact.length > best.aliasLength) {
        best = { option, aliasLength: compact.length };
      }
    }
  }
  return best?.option ?? null;
}

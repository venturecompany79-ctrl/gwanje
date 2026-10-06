import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_BRAND_COLORS,
  companyLogoUrl,
  type CompanyBrandEntry,
} from "@/lib/companyBrand";

// 데모 모드에서도 구분 효과가 보이도록 데모 기업 일부에 팔레트 색을 입힌다(로고는 스토리지가 없어 생략)
const DEMO_COMPANY_BRANDS: CompanyBrandEntry[] = [1, 2, 3, 4].map((n, i) => ({
  id: `00000000-0000-0000-0000-0000000000c${n}`,
  color: COMPANY_BRAND_COLORS[[0, 3, 6, 9][i]].value,
  logoUrl: null,
}));

/**
 * 브랜드(색·로고)가 지정된 기업만 반환 — 앱 셸에서 한 번 읽어 전 화면에 주입한다.
 * RLS가 tenant를 격리하므로 별도 필터는 두지 않는다.
 */
export async function getCompanyBrandEntries(): Promise<CompanyBrandEntry[]> {
  const supabase = await createClient();
  if (!supabase) return DEMO_COMPANY_BRANDS;

  const { data, error } = await supabase
    .from("company")
    .select("id, brand_color, logo_path")
    .or("brand_color.not.is.null,logo_path.not.is.null");
  if (error || !data) {
    if (error) console.error("[getCompanyBrandEntries]", error.code, error.message);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    color: row.brand_color,
    logoUrl: row.logo_path ? companyLogoUrl(row.logo_path) : null,
  }));
}

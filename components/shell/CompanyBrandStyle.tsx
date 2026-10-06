import { buildCompanyBrandCss } from "@/lib/companyBrand";
import { getCompanyBrandEntries } from "@/lib/data/companyBrands";

/**
 * 기업별 로고·기업명 컬러를 전 화면의 `.co-mark`·`.co-name`(data-co)에 한 번에 주입.
 * CategoryColorStyle 과 같은 방식 — 각 화면의 데이터 페치를 건드리지 않고 id만으로 반영된다.
 */
export async function CompanyBrandStyle() {
  const css = buildCompanyBrandCss(await getCompanyBrandEntries());
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

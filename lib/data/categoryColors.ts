import { createClient } from "@/lib/supabase/server";
import { CATEGORY_COLORS } from "@/lib/categoryColors";

export interface CategoryColorEntry {
  name: string;
  color: string;
}

// 데모 모드(.env 없음)에서도 칩 색이 보이도록 기본 분류에 팔레트를 순서대로 매핑
const DEMO_CATEGORY_COLORS: CategoryColorEntry[] = [
  { name: "정부지원사업", color: CATEGORY_COLORS[0] },
  { name: "벤처기업확인", color: CATEGORY_COLORS[1] },
  { name: "기업부설연구소", color: CATEGORY_COLORS[2] },
  { name: "세액공제", color: CATEGORY_COLORS[3] },
  { name: "정책자금", color: CATEGORY_COLORS[4] },
];

/**
 * 카테고리 이름 → 색 매핑. 앱 셸에서 한 번 읽어 전 화면 칩에 주입한다.
 * 색이 지정된 카테고리만 반환(미지정은 중립 칩 유지).
 */
export async function getCategoryColorMap(): Promise<CategoryColorEntry[]> {
  const supabase = await createClient();
  if (!supabase) return DEMO_CATEGORY_COLORS;

  const { data, error } = await supabase
    .from("category")
    .select("name, color")
    .not("color", "is", null);
  if (error || !data) return [];

  return data
    .filter((c): c is { name: string; color: string } => Boolean(c.color))
    .map((c) => ({ name: c.name, color: c.color }));
}

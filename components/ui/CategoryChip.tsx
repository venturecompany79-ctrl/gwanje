// 카테고리 칩 — 설정에서 색을 지정하면 앱 셸의 CategoryColorStyle가
// .cat-chip[data-cat="<이름>"] 규칙을 주입해 전 화면에서 동일 색으로 표시.
// 색 미지정 카테고리는 매칭 규칙이 없어 중립 스타일을 유지한다. (CLAUDE.md 5절 갭 1)
export function CategoryChip({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="cat-chip" data-cat={name}>
      {name}
    </span>
  );
}

// 카테고리 칩 — 팀이 카테고리 색을 정식 정의하기 전까지 중립 스타일 고정 (CLAUDE.md 5절 갭 1)
export function CategoryChip({ name }: { name: string | null }) {
  if (!name) return null;
  return <span className="cat-chip">{name}</span>;
}

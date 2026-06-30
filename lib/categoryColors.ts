// 카테고리 색은 디자인 시스템 토큰 값만 허용 (임의 색 생성 금지 — CLAUDE.md §5)
// "use server" 모듈에서는 async 함수만 export 가능하므로 상수는 별도 모듈로 분리.
export const CATEGORY_COLORS = [
  "#0064e0", // primary (cobalt)
  "#a121ce", // oculus-purple
  "#31a24c", // success
  "#f2a918", // attention
  "#f7b928", // warning
  "#e41e3f", // critical
  "#5d6c7b", // steel
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

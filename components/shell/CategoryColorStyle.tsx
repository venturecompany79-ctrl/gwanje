import { getCategoryColorMap } from "@/lib/data/categoryColors";

// CSS 선택자/문자열 안전화 — 영숫자·한글·_- 외 모든 문자를 hex 이스케이프.
// (`<`, `>`, `"` 등이 모두 이스케이프되어 <style> 탈출 불가)
function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9가-힣_-]/g, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return `\\${cp.toString(16)} `;
  });
}

/**
 * 설정에서 지정한 카테고리별 색을 전 화면의 `.cat-chip[data-cat]`에 한 번에 주입.
 * 앱 셸(layout)에서만 렌더해 모든 솔루션 화면의 분류 태그가 동일 색을 공유한다.
 */
export async function CategoryColorStyle() {
  const entries = await getCategoryColorMap();
  if (entries.length === 0) return null;

  const css = entries
    .map(({ name, color }) => {
      const sel = `.cat-chip[data-cat="${cssEscape(name)}"]`;
      return (
        `${sel}{` +
        `background:color-mix(in srgb,${color} 12%,#fff);` +
        `border-color:color-mix(in srgb,${color} 32%,#fff);` +
        `color:color-mix(in srgb,${color} 78%,#1c1e21);` +
        `}`
      );
    })
    .join("");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

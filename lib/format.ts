// 공용 표시 포맷터 — 화면 간 중복 방지

export function formatRevenue(won: number | null): string {
  if (won === null) return "—";
  const eok = won / 100_000_000;
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}MB`;
}

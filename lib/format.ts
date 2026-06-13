// 공용 표시 포맷터 — 화면 간 중복 방지
// 날짜·시각 포맷은 KST 고정 헬퍼(lib/datetime)에 위임한다 (운영 UTC 어긋남 방지).
import { formatKstShortDateTime } from "@/lib/datetime";

export function formatRevenue(won: number | null): string {
  if (won === null) return "—";
  const eok = won / 100_000_000;
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
}

/** ISO 타임스탬프 → KST "MM-DD HH:mm" (캠페인 응답 시각 등 컴팩트 표기) */
export function formatShortDateTime(iso: string | null): string {
  return formatKstShortDateTime(iso);
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}MB`;
}

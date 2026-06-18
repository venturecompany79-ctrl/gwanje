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

// ── 입력 마스킹 (GWJ-002 / GWJ-003) ──────────────────────────
// 사업자등록번호·전화번호 자동 하이픈. 입력 중 실시간 적용하므로 부분 입력도
// 자연스럽게 마스킹된다(붙여넣기 시 숫자만 추출). 저장값도 이 표준 포맷으로 통일.

/** 사업자등록번호 → `###-##-#####` (숫자 10자리 기준, 부분 입력 허용) */
export function formatBizNo(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 사업자등록번호 유효성(숫자 10자리). 빈 값은 true(선택 입력) */
export function isValidBizNo(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  return d.length === 0 || d.length === 10;
}

/**
 * 전화번호 자동 하이픈.
 * - 휴대폰(010 등 11자리): `010-####-####`
 * - 서울(02): `02-###-####` / `02-####-####`
 * - 그 외 지역(0XX)·대표번호: 자릿수에 맞춰 분기
 */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";

  // 서울 지역번호 02 (2자리 국번)
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }

  // 휴대폰/3자리 지역번호 (010, 031, 1666 대표번호 등)
  // 1xxx 대표번호(8자리): 1666-0000
  if (/^1\d{3}/.test(d) && d.length <= 8) {
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)}-${d.slice(4)}`;
  }

  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

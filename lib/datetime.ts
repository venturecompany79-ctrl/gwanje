// 모든 날짜·시각 표시는 한국 시간(KST) 기준으로 고정한다.
// 운영 서버(Vercel)는 UTC로 동작하므로, 서버 로컬 시간을 그대로 쓰면
// 00:00~09:00 KST 구간에서 D-day가 하루 어긋나고 시각이 9시간 어긋난다.
// (CLAUDE.md 7절 deadline_item 뷰도 동일하게 KST로 맞춘다 — supabase 마이그레이션 참고)

const KST = "Asia/Seoul";

interface KstParts {
  year: number;
  month: number;
  day: number;
  /** "HH" (00~23) */
  hour: string;
  /** "mm" */
  minute: string;
}

/** 주어진 시각을 KST 달력 구성요소로 분해 */
function kstParts(d: Date): KstParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** KST 달력 날짜의 UTC 자정 타임스탬프(ms) — 일수 차이 계산용 기준점 */
export function kstDayNumber(d: Date): number {
  const t = kstParts(d);
  return Date.UTC(t.year, t.month - 1, t.day);
}

/**
 * "YYYY-MM-DD"(날짜 전용 문자열) → 오늘(KST) 기준 남은 일수. 음수 = 지남.
 * deadline_item 뷰의 days_left와 동일 규칙(KST 달력 일수 차).
 */
export function daysFromToday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - kstDayNumber(new Date())) / 86_400_000,
  );
}

/** 두 시각의 KST 달력 일수 차 (a - b). 같은 날=0, a가 하루 뒤=1 */
export function kstDayDiff(a: Date, b: Date): number {
  return Math.round((kstDayNumber(a) - kstDayNumber(b)) / 86_400_000);
}

/** KST "HH:mm" */
export function formatKstTime(d: Date): string {
  const t = kstParts(d);
  return `${t.hour}:${t.minute}`;
}

/** KST "M/D" (패딩 없음 — 상대시각 폴백 표기) */
export function formatKstMonthDay(d: Date): string {
  const t = kstParts(d);
  return `${t.month}/${t.day}`;
}

/** KST "MM.DD" (패딩) */
export function formatKstDotDate(d: Date): string {
  const t = kstParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.month)}.${pad(t.day)}`;
}

/** 현재 KST "YYYY-MM-DD" */
export function todayKstDate(): string {
  const t = kstParts(new Date());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

/** "YYYY-MM-DD" 날짜 문자열을 UTC 달력 기준으로 days만큼 이동 */
export function shiftDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → "YYYY.MM.DD" */
export function formatDotDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${year}.${month}.${day}`;
}

/** ISO 타임스탬프 → KST "YYYY-MM-DD" (timestamptz를 KST 날짜로 표시) */
export function formatKstDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const t = kstParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

/** ISO 타임스탬프 → KST "MM-DD HH:mm" (캠페인 응답 시각 등 컴팩트 표기) */
export function formatKstShortDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const t = kstParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.month)}-${pad(t.day)} ${t.hour}:${t.minute}`;
}

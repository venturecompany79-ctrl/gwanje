export function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function longKstDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(kst);
}

export function shiftDateString(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function ddayLabel(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined) return "-";
  if (daysLeft < 0) return `D+${Math.abs(daysLeft)}`;
  if (daysLeft === 0) return "D-day";
  return `D-${daysLeft}`;
}

export function shortDate(date: string | null | undefined): string {
  if (!date) return "-";
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}

export function monthDayKo(date: string | null | undefined): string {
  if (!date) return "-";
  const [, month, day] = date.split("-");
  return `${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
}

export function daysFromDateString(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = todayKstDate();
  const due = new Date(`${date}T00:00:00.000Z`).getTime();
  const base = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.round((due - base) / 86_400_000);
}

export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

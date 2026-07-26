// 휴대폰 번호 정규화 — 클라이언트 안전(순수 함수, 서버 전용 import 없음).
// 위저드에서 "연락처 없어 제외될 기업"을 미리 보여줄 때와,
// 워커에서 실제 발송 대상을 확정할 때 같은 규칙을 쓰기 위해 한 곳에 둔다.

/**
 * 자유 입력 연락처를 알림톡 발송 가능한 휴대폰 번호로 정규화한다.
 * "010-1234-5678", "+82 10 1234 5678", "01012345678" → "01012345678"
 * 유선번호(02·031…)나 형식 오류는 알림톡을 보낼 수 없으므로 null.
 */
export function normalizeKoreanMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");

  // 국가번호 표기(+82 10…, 8210…) → 국내 표기(010…)
  if (digits.startsWith("8210")) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("82") && digits.length >= 11) digits = `0${digits.slice(2)}`;

  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

/** 화면 표시용 마스킹 — 010-1234-**** */
export function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const head = digits.slice(0, 3);
  const mid = digits.slice(3, digits.length - 4);
  return `${head}-${mid}-****`;
}

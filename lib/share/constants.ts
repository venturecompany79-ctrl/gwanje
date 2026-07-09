// 공유 대시보드 공용 상수 — 서버 액션과 클라이언트 게이트가 함께 쓰는 문구/정책.
// env 접근이 없어 클라이언트 번들에 안전하다("use server" 파일은 상수 export 불가라 분리).
// ⚠️ 잠금 임계(5회)·잠금 시간(10분)의 실제 집행은 DB 함수
//    company_share_record_failure(마이그레이션 20260715)에 있다 — 정책 변경 시 함께 수정.

export const SHARE_LOCK_MINUTES = 10;

/** 열거 방지 — 없는 토큰과 중지된 공유를 구분할 수 없도록 문구를 하나로 통일 */
export const SHARE_INVALID_LINK_ERROR =
  "링크가 유효하지 않거나 공유가 중지되었습니다. 담당 컨설턴트에게 문의해 주세요.";

export const SHARE_LOCKED_ERROR = `비밀번호가 여러 번 잘못 입력되어 잠시 잠겼습니다. ${SHARE_LOCK_MINUTES}분 후 다시 시도해 주세요.`;

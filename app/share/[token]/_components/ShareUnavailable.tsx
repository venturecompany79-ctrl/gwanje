import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert } from "@/components/ui/icons";
import { SHARE_INVALID_LINK_ERROR } from "@/lib/share/constants";

// 무효 토큰·공유 중지·서버 설정 미비 공통 화면.
// 열거 방지: 어느 경우인지 구분할 수 없도록 기본 문구를 하나로 통일한다.
// (인증을 통과한 뒤의 일시 오류는 열거 방지 대상이 아니므로 별도 문구를 전달)
export function ShareUnavailable({
  title = "페이지를 표시할 수 없습니다",
  description = SHARE_INVALID_LINK_ERROR,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="share-gate">
      <EmptyState icon={<IconAlert />} title={title} description={description} />
    </div>
  );
}

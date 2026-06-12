import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconSend } from "@/components/ui/icons";

export default function CampaignNotFound() {
  return (
    <EmptyState
      icon={<IconSend />}
      title="캠페인을 찾을 수 없습니다"
      description="삭제되었거나 주소가 잘못된 캠페인입니다. 일괄안내 목록에서 다시 선택해 주세요."
      action={
        <LinkButton variant="cta" href="/app/campaigns">
          일괄안내로
        </LinkButton>
      }
    />
  );
}

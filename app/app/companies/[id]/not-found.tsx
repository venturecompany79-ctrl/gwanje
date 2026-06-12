import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBuilding } from "@/components/ui/icons";

export default function CompanyNotFound() {
  return (
    <EmptyState
      icon={<IconBuilding />}
      title="기업을 찾을 수 없습니다"
      description="삭제되었거나 주소가 잘못된 기업입니다. 기업 목록에서 다시 선택해 주세요."
      action={
        <LinkButton variant="cta" href="/app/companies">
          기업 목록으로
        </LinkButton>
      }
    />
  );
}

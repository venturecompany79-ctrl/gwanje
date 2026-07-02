import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert } from "@/components/ui/icons";

export default function RootNotFound() {
  return (
    <main className="shell-content">
      <EmptyState
        icon={<IconAlert />}
        title="페이지를 찾을 수 없습니다"
        description="주소가 바뀌었거나 접근할 수 없는 화면입니다."
        action={
          <LinkButton variant="cta" href="/app">
            대시보드로 이동
          </LinkButton>
        }
      />
    </main>
  );
}

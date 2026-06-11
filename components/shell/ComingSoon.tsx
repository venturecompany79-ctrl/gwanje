import { EmptyState } from "@/components/ui/EmptyState";
import { IconInfo } from "@/components/ui/icons";

// 후속 세션에서 구현될 화면의 자리표시 (한 세션에 한 화면 원칙)
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <EmptyState
        icon={<IconInfo />}
        title="화면 준비 중"
        description={description}
      />
    </>
  );
}

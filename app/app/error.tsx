"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert } from "@/components/ui/icons";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={<IconAlert />}
      title="데이터를 불러오지 못했습니다"
      description={
        error.message ||
        "일시적인 오류가 발생했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      }
      action={
        <Button variant="cta" onClick={() => reset()}>
          다시 시도
        </Button>
      }
    />
  );
}

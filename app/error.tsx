"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert } from "@/components/ui/icons";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell-content">
      <EmptyState
        icon={<IconAlert />}
        title="화면을 불러오지 못했습니다"
        description={
          error.message ||
          "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        }
        action={
          <Button variant="cta" onClick={() => reset()}>
            다시 시도
          </Button>
        }
      />
    </main>
  );
}

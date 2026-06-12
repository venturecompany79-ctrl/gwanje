"use client";

// 마법사 발송 직후 ?sent=N / ?scheduled=1 쿼리로 진입하면 토스트 1회 노출
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/ui/Toast";

export function SentToast({
  sentCount,
  scheduled,
}: {
  sentCount: number | null;
  scheduled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (sentCount !== null) {
      showToast(`${sentCount}개사에 발송되었습니다`);
    } else if (scheduled) {
      showToast("예약 발송이 설정되었습니다");
    } else {
      return;
    }
    // 쿼리 제거 — 새로고침 시 토스트 재노출 방지
    router.replace(pathname, { scroll: false });
  }, [sentCount, scheduled, showToast, router, pathname]);

  return <Toast message={toast} />;
}

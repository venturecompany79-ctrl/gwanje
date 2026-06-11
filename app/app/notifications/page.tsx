import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "알림" };

export default function NotificationsPage() {
  return (
    <ComingSoon
      title="알림"
      description="만료·마감·공고매칭 알림 센터는 다음 세션에서 구현됩니다. 스펙: docs/화면설계_기획자료.md 6절."
    />
  );
}

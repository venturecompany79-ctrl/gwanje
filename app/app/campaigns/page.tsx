import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "일괄안내" };

export default function CampaignsPage() {
  return (
    <ComingSoon
      title="일괄안내"
      description="세그먼트 추출 → 메시지 작성 → 발송 → 응답 집계 흐름은 다음 세션에서 구현됩니다. 스펙: docs/화면설계_기획자료.md 5절."
    />
  );
}

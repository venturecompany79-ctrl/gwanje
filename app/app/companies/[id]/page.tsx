import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "기업 상세" };

export default function CompanyDetailPage() {
  return (
    <ComingSoon
      title="기업 상세"
      description="프로파일·자격·과제·일정·자료 탭 화면은 다음 세션에서 구현됩니다. 스펙: docs/화면설계_기획자료.md 3절."
    />
  );
}

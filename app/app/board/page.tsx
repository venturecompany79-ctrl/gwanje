import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "관리포인트 보드" };

export default function BoardPage() {
  return (
    <ComingSoon
      title="관리포인트 보드"
      description="현황진단→제안→신청→결과 4단계 칸반은 다음 세션에서 구현됩니다. 스펙: docs/화면설계_기획자료.md 4절."
    />
  );
}

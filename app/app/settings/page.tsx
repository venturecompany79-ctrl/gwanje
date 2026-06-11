import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return (
    <ComingSoon
      title="설정"
      description="알림 규칙·분류 카테고리·프로필/발신정보 관리는 다음 세션에서 구현됩니다. 스펙: docs/화면설계_기획자료.md 7절."
    />
  );
}

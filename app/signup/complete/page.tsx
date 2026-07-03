import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthStage } from "@/components/auth/AuthStage";
import { isSignupEnabled } from "@/lib/auth/config";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
} from "@/lib/data/current-member";
import { createClient } from "@/lib/supabase/server";
import { SignupCompleteForm } from "./SignupCompleteForm";

export const metadata: Metadata = { title: "가입 완료" };

// Google OAuth 직후 온보딩 — 이름·소속·워크스페이스 이름을 받아 프로비저닝한다.
// middleware가 1차로 막지만, 서버에서도 동일 조건을 재검증한다(belt & suspenders).
export default async function SignupCompletePage() {
  if (!isSignupEnabled()) redirect("/login");

  const supabase = await createClient();
  if (!supabase) redirect("/login"); // 데모 모드 — OAuth 세션이 있을 수 없음

  const identity = await getCurrentIdentity(supabase);
  if (!identity) redirect("/login");

  const profile = await readCurrentMemberProfile(supabase, identity.userId);
  if (profile?.status === "active") redirect("/app");
  if (profile) redirect("/login?status=inactive");

  return (
    <AuthStage>
      <SignupCompleteForm
        defaultName={identity.name ?? ""}
        email={identity.email ?? ""}
      />
    </AuthStage>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthStage } from "@/components/auth/AuthStage";
import { isSignupEnabled } from "@/lib/auth/config";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <AuthStage>
      <Suspense>
        {/* 서버 전용 플래그를 RSC에서 읽어 prop으로 전달(NEXT_PUBLIC_ 불필요) */}
        <LoginForm signupEnabled={isSignupEnabled()} />
      </Suspense>
    </AuthStage>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthStage } from "@/components/auth/AuthStage";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <AuthStage>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthStage>
  );
}

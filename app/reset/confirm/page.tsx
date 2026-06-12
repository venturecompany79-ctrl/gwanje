import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthStage } from "@/components/auth/AuthStage";
import { ResetConfirmForm } from "./ResetConfirmForm";

export const metadata: Metadata = { title: "새 비밀번호 설정" };

export default function ResetConfirmPage() {
  return (
    <AuthStage>
      <Suspense>
        <ResetConfirmForm />
      </Suspense>
    </AuthStage>
  );
}

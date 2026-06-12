import type { Metadata } from "next";
import { AuthStage } from "@/components/auth/AuthStage";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default function ResetPage() {
  return (
    <AuthStage>
      <ResetForm />
    </AuthStage>
  );
}

import type { Metadata } from "next";
import { AuthStage } from "@/components/auth/AuthStage";
import { InviteAcceptForm } from "./InviteAcceptForm";

export const metadata: Metadata = { title: "팀 초대 수락" };

export default function InviteAcceptPage() {
  return (
    <AuthStage>
      <InviteAcceptForm />
    </AuthStage>
  );
}

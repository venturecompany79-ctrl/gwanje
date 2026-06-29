import type { Metadata } from "next";
import { BillingSuccess } from "./BillingSuccess";

export const metadata: Metadata = { title: "결제 처리 중" };
export const dynamic = "force-dynamic";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    flow?: string;
    customerKey?: string;
    authKey?: string;
  }>;
}) {
  const sp = await searchParams;
  return (
    <BillingSuccess
      flow={sp.flow === "change" ? "change" : "register"}
      customerKey={sp.customerKey ?? null}
      authKey={sp.authKey ?? null}
    />
  );
}

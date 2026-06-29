import type { Metadata } from "next";
import { getBillingOverview } from "@/lib/billing/data";
import { BillingView } from "./_components/BillingView";

export const metadata: Metadata = { title: "결제" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const data = await getBillingOverview();

  return (
    <>
      <div className="page-head">
        <h1>결제</h1>
      </div>
      <BillingView data={data} />
    </>
  );
}

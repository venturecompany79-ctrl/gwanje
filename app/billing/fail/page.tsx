import type { Metadata } from "next";
import Link from "next/link";
import { IconAlert } from "@/components/ui/icons";

export const metadata: Metadata = { title: "결제 실패" };
export const dynamic = "force-dynamic";

export default async function BillingFailPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; message?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="bill-result">
      <div className="bill-result-card is-error">
        <div className="bill-result-icon">
          <IconAlert />
        </div>
        <h1>결제를 완료하지 못했습니다</h1>
        <p>{sp.message ?? "카드 등록이 취소되었거나 인증에 실패했습니다."}</p>
        {sp.code ? <p className="bill-result-code">오류 코드: {sp.code}</p> : null}
        <div className="bill-result-actions">
          <Link className="btn btn--cta" href="/app/billing">
            다시 시도하기
          </Link>
        </div>
      </div>
    </div>
  );
}

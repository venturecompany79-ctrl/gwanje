import type { Metadata } from "next";
import Link from "next/link";
import { IconAlert, IconBack } from "@/components/ui/icons";
import { getSegmentCompanies } from "@/lib/data/campaigns";
import { CampaignWizard } from "./_components/CampaignWizard";

export const metadata: Metadata = { title: "새 일괄안내" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const data = await getSegmentCompanies();

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — 발송·예약은 Supabase 연결(.env.local) 후
          저장됩니다.
        </div>
      ) : null}

      <nav className="crumb" aria-label="브레드크럼">
        <Link href="/app/campaigns">
          <IconBack /> 일괄안내
        </Link>
        <span className="sep">/</span>
        <span className="cur">새 일괄안내</span>
      </nav>

      <div className="page-head">
        <h1>새 일괄안내</h1>
      </div>

      <CampaignWizard companies={data.companies} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { IconAlert, IconBack, IconGear } from "@/components/ui/icons";
import { getAlimtalkWizardData, getSegmentCompanies } from "@/lib/data/campaigns";
import { CampaignWizard } from "./_components/CampaignWizard";

export const metadata: Metadata = { title: "새 일괄안내" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [data, alimtalk] = await Promise.all([
    getSegmentCompanies(),
    getAlimtalkWizardData(),
  ]);

  // 연동은 됐는데 검수된 템플릿이 하나도 없으면 발송할 수단이 없다 — 설정으로 안내.
  const missingTemplates = alimtalk.live && alimtalk.templates.length === 0;

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

      {missingTemplates ? (
        <Panel>
          <EmptyState
            bare
            icon={<IconGear />}
            title="등록된 알림톡 템플릿이 없습니다"
            description="알림톡은 카카오 검수를 통과한 템플릿으로만 발송할 수 있습니다. Solapi 콘솔에서 템플릿을 등록·검수한 뒤, 설정 → 알림톡에서 템플릿 ID를 추가해 주세요."
            action={
              <Link className="btn btn--cta" href="/app/settings">
                설정으로 이동
              </Link>
            }
          />
        </Panel>
      ) : (
        <CampaignWizard
          companies={data.companies}
          templates={alimtalk.templates}
          live={alimtalk.live}
        />
      )}
    </>
  );
}

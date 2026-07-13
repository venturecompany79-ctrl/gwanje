import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconAlert, IconPlus, IconSend } from "@/components/ui/icons";
import {
  CAMPAIGN_LIST_LIMIT,
  getCampaignsData,
} from "@/lib/data/campaigns";
import { CampaignsTable } from "./_components/CampaignsTable";

export const metadata: Metadata = { title: "일괄안내" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const data = await getCampaignsData();

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <div className="page-head">
        <div>
          <h1>일괄안내</h1>
          <p className="sub">
            조건으로 대상을 추려 알림톡으로 한 번에 안내합니다
          </p>
        </div>
        <div className="spacer" />
        <LinkButton variant="cta" href="/app/campaigns/new">
          <IconPlus /> 새 일괄안내
        </LinkButton>
      </div>

      {data.hasMore ? (
        <div className="demo-banner">
          <IconAlert />
          일괄안내가 {CAMPAIGN_LIST_LIMIT}건을 초과해 최근 {CAMPAIGN_LIST_LIMIT}
          건까지만 표시됩니다. 이전 일괄안내는 목록에 나타나지 않을 수 있습니다.
        </div>
      ) : null}

      {data.campaigns.length === 0 ? (
        <EmptyState
          icon={<IconSend />}
          title="첫 일괄안내를 만들어보세요"
          description="조건으로 대상 기업을 추려 알림톡으로 한 번에 안내하고, 수신·응답 현황을 모아 확인할 수 있습니다."
          action={
            <LinkButton variant="cta" href="/app/campaigns/new">
              <IconPlus /> 새 일괄안내
            </LinkButton>
          }
        />
      ) : (
        <Panel>
          <PanelHead
            title="일괄안내"
            count={`${data.campaigns.length}${data.hasMore ? "+" : ""}건`}
          />
          <CampaignsTable campaigns={data.campaigns} />
        </Panel>
      )}
    </>
  );
}

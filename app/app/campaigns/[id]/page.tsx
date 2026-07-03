import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconAlert, IconBack, IconSend } from "@/components/ui/icons";
import { getCampaignDetail } from "@/lib/data/campaigns";
import { formatShortDateTime } from "@/lib/format";
import { formatKstDate } from "@/lib/datetime";
import { CampaignStatusBadge } from "../_components/CampaignStatusBadge";
import { SentToast } from "./_components/SentToast";

export const metadata: Metadata = { title: "일괄안내 집계" };
export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; scheduled?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getCampaignDetail(id);
  if (!data) notFound();

  const { campaign, recipients } = data;
  const delivered = recipients.filter((r) => r.delivered).length;
  const responded = recipients.filter((r) => r.responded).length;
  const rate =
    recipients.length > 0
      ? Math.round((responded / recipients.length) * 100)
      : 0;

  const headMeta =
    campaign.status === "sent" && campaign.sentAt
      ? `${formatKstDate(campaign.sentAt)} 발송`
      : campaign.scheduledAt
        ? `${formatShortDateTime(campaign.scheduledAt)} 발송 예정`
        : "발송 전";

  const sentParam = sp.sent ? Number(sp.sent) : NaN;

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <nav className="crumb" aria-label="브레드크럼">
        <Link href="/app/campaigns">
          <IconBack /> 일괄안내
        </Link>
        <span className="sep">/</span>
        <span className="cur">{campaign.title}</span>
      </nav>

      <div className="page-head">
        <h1>{campaign.title}</h1>
        <CampaignStatusBadge status={campaign.status} />
        <span className="head-meta num">{headMeta}</span>
        <div className="spacer" />
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">발송</div>
          <div className="kpi-value num">{recipients.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">도달</div>
          <div className="kpi-value num">{delivered}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">응답</div>
          <div className="kpi-value num">{responded}</div>
        </div>
        <div className="kpi kpi--hl">
          <div className="kpi-label">응답률</div>
          <div className="kpi-value num">
            {rate}
            <em>%</em>
          </div>
        </div>
      </div>

      <Panel>
        <PanelHead title="기업별 응답" count={`${recipients.length}개사`} />
        {recipients.length === 0 ? (
          <EmptyState
            bare
            icon={<IconSend />}
            title="아직 발송 전입니다"
            description="발송이 완료되면 기업별 도달·응답 현황이 여기에 집계됩니다."
          />
        ) : (
          <table className="dlist dlist--cards">
            <thead>
              <tr>
                <th>기업명</th>
                <th className="c">도달</th>
                <th className="c">응답</th>
                <th>응답 내용</th>
                <th>응답 시각</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td className="co" data-label="기업명">
                    {r.companyName}
                  </td>
                  <td className="c" data-label="도달">
                    <span className={`yn ${r.delivered ? "yn--ok" : "yn--no"}`}>
                      <span className="d" />
                      {r.delivered ? "도달" : "미도달"}
                    </span>
                  </td>
                  <td className="c" data-label="응답">
                    <span className={`yn ${r.responded ? "yn--ok" : "yn--no"}`}>
                      <span className="d" />
                      {r.responded ? "응답" : "미응답"}
                    </span>
                  </td>
                  <td data-label="응답 내용">
                    {r.responseNote ? (
                      <span className="ans">“{r.responseNote}”</span>
                    ) : (
                      <span className="cell-muted">–</span>
                    )}
                  </td>
                  <td className="date num" data-label="응답 시각">
                    {formatShortDateTime(r.respondedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <SentToast
        sentCount={Number.isNaN(sentParam) ? null : sentParam}
        scheduled={sp.scheduled === "1"}
      />
    </>
  );
}

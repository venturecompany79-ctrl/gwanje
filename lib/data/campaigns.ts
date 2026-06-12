import { createClient } from "@/lib/supabase/server";
import {
  DEMO_CAMPAIGNS,
  DEMO_CAMPAIGN_DETAIL,
  DEMO_SEGMENT_COMPANIES,
} from "@/lib/demo-data";
import {
  parseSegment,
  summarizeSegment,
  type SegmentCompany,
} from "@/lib/segments";
import type { CampaignChannel, CampaignStatus } from "@/lib/database.types";

export interface CampaignListRow {
  id: string;
  title: string;
  status: CampaignStatus;
  /** 세그먼트 요약 칩 텍스트 — 조건 미작성(임시저장)이면 null */
  segmentSummary: string | null;
  /** 발송(예정) 대상 수 — 수신자 스냅샷 없으면 null */
  recipientCount: number | null;
  sentAt: string | null;
  scheduledAt: string | null;
  /** 응답률 % (응답/발송) — 발송 전이면 null */
  responseRate: number | null;
}

export interface CampaignsData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  campaigns: CampaignListRow[];
}

export interface RecipientRow {
  id: string;
  companyId: string;
  companyName: string;
  delivered: boolean;
  responded: boolean;
  responseNote: string | null;
  respondedAt: string | null;
}

export interface CampaignDetail {
  id: string;
  title: string;
  body: string | null;
  channel: CampaignChannel;
  status: CampaignStatus;
  segmentSummary: string | null;
  sentAt: string | null;
  scheduledAt: string | null;
}

export interface CampaignDetailData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  campaign: CampaignDetail;
  recipients: RecipientRow[];
}

export interface SegmentCompaniesData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  companies: SegmentCompany[];
}

/** 응답 먼저(응답 시각순) → 도달 → 미도달 순으로 정렬 */
function sortRecipients(recipients: RecipientRow[]): RecipientRow[] {
  return [...recipients].sort((a, b) => {
    if (a.responded !== b.responded) return a.responded ? -1 : 1;
    if (a.responded && b.responded) {
      return (a.respondedAt ?? "").localeCompare(b.respondedAt ?? "");
    }
    if (a.delivered !== b.delivered) return a.delivered ? -1 : 1;
    return a.companyName.localeCompare(b.companyName, "ko");
  });
}

export async function getCampaignsData(): Promise<CampaignsData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_CAMPAIGNS();

  const [campaigns, recipients] = await Promise.all([
    supabase
      .from("campaign")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("campaign_recipient").select("campaign_id, responded"),
  ]);

  const firstError = campaigns.error ?? recipients.error;
  if (firstError) {
    throw new Error(`캠페인 목록을 불러오지 못했습니다: ${firstError.message}`);
  }

  const total = new Map<string, number>();
  const responded = new Map<string, number>();
  for (const r of recipients.data ?? []) {
    total.set(r.campaign_id, (total.get(r.campaign_id) ?? 0) + 1);
    if (r.responded) {
      responded.set(r.campaign_id, (responded.get(r.campaign_id) ?? 0) + 1);
    }
  }

  return {
    demo: false,
    campaigns: (campaigns.data ?? []).map((c) => {
      const count = total.get(c.id) ?? null;
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        segmentSummary: summarizeSegment(parseSegment(c.segment)),
        recipientCount: count,
        sentAt: c.sent_at,
        scheduledAt: c.scheduled_at,
        responseRate:
          c.status === "sent" && count
            ? Math.round(((responded.get(c.id) ?? 0) / count) * 100)
            : null,
      };
    }),
  };
}

export async function getCampaignDetail(
  campaignId: string,
): Promise<CampaignDetailData | null> {
  const supabase = await createClient();
  if (!supabase) return DEMO_CAMPAIGN_DETAIL(campaignId);

  const [campaign, recipients] = await Promise.all([
    supabase.from("campaign").select("*").eq("id", campaignId).maybeSingle(),
    supabase
      .from("campaign_recipient")
      .select("*")
      .eq("campaign_id", campaignId),
  ]);

  const firstError = campaign.error ?? recipients.error;
  if (firstError) {
    throw new Error(`캠페인을 불러오지 못했습니다: ${firstError.message}`);
  }
  if (!campaign.data) return null;

  const companyIds = (recipients.data ?? []).map((r) => r.company_id);
  const companyName = new Map<string, string>();
  if (companyIds.length > 0) {
    const companies = await supabase
      .from("company")
      .select("id, name")
      .in("id", companyIds);
    if (companies.error) {
      throw new Error(
        `캠페인을 불러오지 못했습니다: ${companies.error.message}`,
      );
    }
    for (const co of companies.data ?? []) companyName.set(co.id, co.name);
  }

  return {
    demo: false,
    campaign: {
      id: campaign.data.id,
      title: campaign.data.title,
      body: campaign.data.body,
      channel: campaign.data.channel,
      status: campaign.data.status,
      segmentSummary: summarizeSegment(parseSegment(campaign.data.segment)),
      sentAt: campaign.data.sent_at,
      scheduledAt: campaign.data.scheduled_at,
    },
    recipients: sortRecipients(
      (recipients.data ?? []).map((r) => ({
        id: r.id,
        companyId: r.company_id,
        companyName: companyName.get(r.company_id) ?? "—",
        delivered: r.delivered,
        responded: r.responded,
        responseNote: r.response_note,
        respondedAt: r.responded_at,
      })),
    ),
  };
}

/** 마법사 세그먼트 평가용 기업 전체 — 단일 컨설턴트 MVP 규모라 전량 로드 */
export async function getSegmentCompanies(): Promise<SegmentCompaniesData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SEGMENT_COMPANIES();

  const [companies, credentials, deadlines] = await Promise.all([
    supabase
      .from("company")
      .select("id, name, industry, revenue, condition_tags, contact_name")
      .order("name"),
    supabase.from("credential").select("company_id, type"),
    supabase.from("deadline_item").select("company_id, days_left"),
  ]);

  const firstError = companies.error ?? credentials.error ?? deadlines.error;
  if (firstError) {
    throw new Error(`대상 기업을 불러오지 못했습니다: ${firstError.message}`);
  }

  const credsByCompany = new Map<string, string[]>();
  for (const cred of credentials.data ?? []) {
    const list = credsByCompany.get(cred.company_id) ?? [];
    list.push(cred.type);
    credsByCompany.set(cred.company_id, list);
  }

  const nearest = new Map<string, number>();
  for (const item of deadlines.data ?? []) {
    if (!item.company_id || item.days_left < 0) continue;
    const current = nearest.get(item.company_id);
    if (current === undefined || item.days_left < current) {
      nearest.set(item.company_id, item.days_left);
    }
  }

  return {
    demo: false,
    companies: (companies.data ?? []).map((co) => ({
      id: co.id,
      name: co.name,
      industry: co.industry,
      revenue: co.revenue,
      conditionTags: co.condition_tags,
      credentialTypes: credsByCompany.get(co.id) ?? [],
      nearestDaysLeft: nearest.get(co.id) ?? null,
      contactName: co.contact_name,
    })),
  };
}

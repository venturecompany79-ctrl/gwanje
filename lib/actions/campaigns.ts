"use server";

// 일괄안내(캠페인) 서버 액션 — 마법사 [발송]/[예약 발송]
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ERROR, getTenantContext, requirePermission } from "@/lib/actions/shared";
import { segmentToJson, type Segment } from "@/lib/segments";
import type { CampaignChannel } from "@/lib/database.types";

const CHANNELS: CampaignChannel[] = ["alimtalk", "email"];

export interface CreateCampaignInput {
  title: string;
  body: string;
  channel: CampaignChannel;
  segment: Segment;
  /** 마법사 3스텝에서 확정한 대상 스냅샷 */
  companyIds: string[];
  /** null = 즉시 발송, 값 있으면 예약 발송(ISO) */
  scheduledAt: string | null;
}

export interface CreateCampaignResult {
  ok: boolean;
  error: string | null;
  /** 성공 시 생성된 캠페인 id — 집계 화면 이동용 */
  id: string | null;
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<CreateCampaignResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR, id: null };

  const allowed = await requirePermission(supabase, "campaigns.write");
  if ("error" in allowed) return { ok: false, error: allowed.error, id: null };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) {
    return { ok: false, error: "일괄안내 제목을 입력해 주세요.", id: null };
  }
  if (!body) {
    return { ok: false, error: "메시지 본문을 입력해 주세요.", id: null };
  }
  if (!CHANNELS.includes(input.channel)) {
    return { ok: false, error: "채널 값이 올바르지 않습니다.", id: null };
  }
  if (input.companyIds.length === 0) {
    return {
      ok: false,
      error: "발송 대상이 없습니다. 세그먼트 조건을 확인해 주세요.",
      id: null,
    };
  }
  if (input.scheduledAt !== null) {
    const scheduledMs = Date.parse(input.scheduledAt);
    if (Number.isNaN(scheduledMs)) {
      return { ok: false, error: "예약 일시가 올바르지 않습니다.", id: null };
    }
    // 과거 일시 예약 거부 — 게이트웨이 연동 전 "예약했는데 안 감" 기대 불일치 방지(F5)
    if (scheduledMs <= Date.now()) {
      return {
        ok: false,
        error: "예약 일시는 현재 시각 이후로 지정해 주세요.",
        id: null,
      };
    }
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error, id: null };

  const immediate = input.scheduledAt === null;
  const now = new Date().toISOString();

  const { data: campaign, error } = await supabase
    .from("campaign")
    .insert({
      tenant_id: ctx.tenantId,
      title,
      body,
      channel: input.channel,
      segment: segmentToJson(input.segment),
      status: immediate ? "sent" : "scheduled",
      scheduled_at: input.scheduledAt,
      sent_at: immediate ? now : null,
    })
    .select("id")
    .single();
  if (error || !campaign) {
    console.error("[createCampaign:campaign]", error?.code, error?.message);
    return {
      ok: false,
      error: `저장에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}`,
      id: null,
    };
  }

  // 알림톡 게이트웨이 연동 전 — 즉시 발송은 도달 처리까지 한 번에 기록
  const { error: recipientError } = await supabase
    .from("campaign_recipient")
    .insert(
      input.companyIds.map((companyId) => ({
        tenant_id: ctx.tenantId,
        campaign_id: campaign.id,
        company_id: companyId,
        delivered: immediate,
        delivered_at: immediate ? now : null,
      })),
    );
  if (recipientError) {
    // 트랜잭션이 아니므로 수신자 저장 실패 시 방금 만든 캠페인을 보상 삭제 —
    // "발송완료인데 수신자 0명" 고아 캠페인·재시도 중복 방지(F11)
    console.error("[createCampaign:recipient]", recipientError.code, recipientError.message);
    const { error: rollbackError } = await supabase
      .from("campaign")
      .delete()
      .eq("id", campaign.id);
    if (rollbackError) {
      console.error("[createCampaign:rollback]", rollbackError.code, rollbackError.message);
    }
    return {
      ok: false,
      error: `대상 저장에 실패했습니다: ${recipientError.message}`,
      id: null,
    };
  }

  revalidatePath("/app/campaigns");
  return { ok: true, error: null, id: campaign.id };
}

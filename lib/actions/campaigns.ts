"use server";

// 일괄안내(캠페인) 서버 액션 — 마법사 [발송]/[예약 발송]
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ERROR, getTenantContext, requirePermission } from "@/lib/actions/shared";
import { isTenantAlimtalkLive } from "@/lib/alimtalk/settings";
import { triggerCampaignSendAfterResponse } from "@/lib/alimtalk/trigger";
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
  /** 실발송 시 사용할 검수 완료 템플릿(alimtalk_template.id). 미연동 테넌트는 null. */
  templateId?: string | null;
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

  // 수신자 id가 전부 우리 tenant의 기업인지 검증 — RLS가 자기 tenant 행만
  // 반환하므로 개수 불일치 = 타 tenant/존재하지 않는 id 혼입
  const companyIds = Array.from(new Set(input.companyIds));
  const { count: ownedCount, error: ownedError } = await supabase
    .from("company")
    .select("id", { count: "exact", head: true })
    .in("id", companyIds);
  if (ownedError || (ownedCount ?? 0) !== companyIds.length) {
    if (ownedError) {
      console.error("[createCampaign:verify]", ownedError.code, ownedError.message);
    }
    return {
      ok: false,
      error: "발송 대상에 접근할 수 없는 기업이 포함되어 있습니다.",
      id: null,
    };
  }

  const immediate = input.scheduledAt === null;
  const now = new Date().toISOString();

  // 실발송 가능 테넌트인지 — 미연동이면 종전처럼 "기록만 저장"으로 동작한다.
  const live = await isTenantAlimtalkLive(supabase, ctx.tenantId);

  let templateId: string | null = null;
  if (live) {
    templateId = input.templateId ?? null;
    if (!templateId) {
      return { ok: false, error: "발송할 알림톡 템플릿을 선택해 주세요.", id: null };
    }
    const { data: template, error: templateError } = await supabase
      .from("alimtalk_template")
      .select("id")
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle();
    if (templateError || !template) {
      return {
        ok: false,
        error: "선택한 템플릿을 찾을 수 없습니다. 설정 → 알림톡에서 확인해 주세요.",
        id: null,
      };
    }
  }

  const { data: campaign, error } = await supabase
    .from("campaign")
    .insert({
      tenant_id: ctx.tenantId,
      title,
      body,
      channel: input.channel,
      segment: segmentToJson(input.segment),
      // 실발송은 워커가 scheduled를 선점해 처리한다. 즉시 발송도 "지금 예약"으로 넣어
      // after()가 죽더라도 cron이 회수할 수 있게 한다.
      status: live ? "scheduled" : immediate ? "sent" : "scheduled",
      scheduled_at: live ? (input.scheduledAt ?? now) : input.scheduledAt,
      sent_at: !live && immediate ? now : null,
      template_id: templateId,
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

  // 실발송 테넌트는 pending으로 적재하고 워커가 상태를 채운다.
  // 미연동 테넌트는 종전대로 즉시 발송을 도달 처리까지 한 번에 기록한다.
  const fakeDelivered = !live && immediate;
  const { error: recipientError } = await supabase
    .from("campaign_recipient")
    .insert(
      companyIds.map((companyId) => ({
        tenant_id: ctx.tenantId,
        campaign_id: campaign.id,
        company_id: companyId,
        delivered: fakeDelivered,
        delivered_at: fakeDelivered ? now : null,
        status: fakeDelivered ? ("delivered" as const) : ("pending" as const),
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

  // 즉시 발송은 응답을 보낸 뒤 백그라운드로 실제 발송을 시작한다(cron이 안전망).
  if (live && immediate) {
    triggerCampaignSendAfterResponse(campaign.id);
  }

  revalidatePath("/app/campaigns");
  return { ok: true, error: null, id: campaign.id };
}

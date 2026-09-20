import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isAlimtalkDryRun } from "@/lib/alimtalk/config";
import { normalizeKoreanMobile } from "@/lib/alimtalk/phone";
import { getTenantAlimtalkCredential } from "@/lib/alimtalk/settings";
import { sendMany, type SolapiMessage } from "@/lib/alimtalk/solapi";

// 캠페인 실발송 워커 — service_role 클라이언트로 실행(RLS 우회).
// 즉시 발송은 lib/alimtalk/trigger.ts의 after()가, 예약 발송·누락분은 cron이 호출한다.

type Service = SupabaseClient<Database>;

/** 한 번에 Solapi로 보내는 최대 건수. 부분 실패 영향 범위를 작게 유지한다. */
const CHUNK_SIZE = 100;
/** 같은 수신자에 대한 최대 발송 시도 횟수(무한 재시도 방지). */
const MAX_ATTEMPTS = 3;
/** sending 상태로 이 시간 넘게 멈춰 있으면 함수가 죽은 것으로 보고 회수한다. */
const STUCK_MINUTES = 15;

export interface SendSummary {
  campaignId: string;
  sent: number;
  failed: number;
  skipped: number;
  /** 다른 실행이 이미 선점한 캠페인이라 아무것도 하지 않음. */
  alreadyClaimed: boolean;
}

function emptySummary(campaignId: string): SendSummary {
  return { campaignId, sent: 0, failed: 0, skipped: 0, alreadyClaimed: false };
}

interface PendingRecipient {
  id: string;
  companyId: string;
  attempts: number;
}

interface CompanyInfo {
  name: string;
  contactName: string | null;
  contactPhone: string | null;
}

/**
 * 검수 본문의 #{변수}를 실제 값으로 치환한다.
 * 알림톡 본문 자체는 카카오 승인본이 나가지만, SMS 대체발송 시에는 이 텍스트가 쓰인다.
 */
function renderText(content: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (text, [token, value]) => text.split(token).join(value),
    content,
  );
}

/**
 * 템플릿이 선언한 변수만 정확히 채운다.
 * Solapi는 승인 템플릿과 변수 집합이 다르면 발송을 거절하므로
 * 임의 키를 추가하거나 누락시키지 않는다.
 */
function buildVariables(
  declared: string[],
  company: CompanyInfo,
): Record<string, string> {
  const known: Record<string, string> = {
    "#{기업명}": company.name,
    "#{담당자명}": company.contactName?.trim() || "담당자",
  };
  const variables: Record<string, string> = {};
  for (const token of declared) {
    variables[token] = known[token] ?? "";
  }
  return variables;
}

/** 수신자 전원을 같은 사유로 실패 처리하고 캠페인을 종료한다. */
async function failAll(
  service: Service,
  campaignId: string,
  recipientIds: string[],
  message: string,
): Promise<SendSummary> {
  if (recipientIds.length > 0) {
    await service
      .from("campaign_recipient")
      .update({ status: "failed", error_code: "config", error_message: message })
      .in("id", recipientIds);
  }
  await service
    .from("campaign")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", campaignId);

  return { campaignId, sent: 0, failed: recipientIds.length, skipped: 0, alreadyClaimed: false };
}

/**
 * 캠페인 1건을 발송한다.
 *
 * 이중 발송 방지: scheduled → sending 조건부 UPDATE로 선점한다. 즉시 발송의 after()와
 * cron이 동시에 같은 캠페인을 잡아도 UPDATE가 성공한 쪽만 진행한다.
 */
export async function sendCampaign(
  service: Service,
  campaignId: string,
): Promise<SendSummary> {
  const { data: claimed, error: claimError } = await service
    .from("campaign")
    .update({ status: "sending", send_started_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "scheduled")
    .select("id, tenant_id, template_id")
    .maybeSingle();

  if (claimError) {
    console.error("[alimtalk:claim]", claimError.code, claimError.message);
    return { ...emptySummary(campaignId), alreadyClaimed: true };
  }
  if (!claimed) {
    // 이미 다른 실행이 가져갔거나 발송 대상 상태가 아니다.
    return { ...emptySummary(campaignId), alreadyClaimed: true };
  }

  const { data: recipientRows, error: recipientError } = await service
    .from("campaign_recipient")
    .select("id, company_id, attempts")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS);

  if (recipientError) {
    console.error("[alimtalk:recipients]", recipientError.code, recipientError.message);
    await service.from("campaign").update({ status: "scheduled" }).eq("id", campaignId);
    return emptySummary(campaignId);
  }

  const recipients: PendingRecipient[] = (recipientRows ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    attempts: row.attempts,
  }));
  const recipientIds = recipients.map((r) => r.id);

  const credential = await getTenantAlimtalkCredential(service, claimed.tenant_id);
  if (!credential) {
    return failAll(
      service,
      campaignId,
      recipientIds,
      "알림톡 연동이 설정되지 않았습니다. 설정 → 알림톡에서 Solapi 계정을 연결해 주세요.",
    );
  }

  if (!claimed.template_id) {
    return failAll(service, campaignId, recipientIds, "발송 템플릿이 지정되지 않았습니다.");
  }

  const { data: template } = await service
    .from("alimtalk_template")
    .select("solapi_template_id, content, variables, is_active")
    .eq("id", claimed.template_id)
    .maybeSingle();

  if (!template || !template.is_active) {
    return failAll(
      service,
      campaignId,
      recipientIds,
      "발송 템플릿을 찾을 수 없거나 비활성 상태입니다.",
    );
  }

  if (recipients.length === 0) {
    await service
      .from("campaign")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    return emptySummary(campaignId);
  }

  const { data: companyRows } = await service
    .from("company")
    .select("id, name, contact_name, contact_phone")
    .in("id", recipients.map((r) => r.companyId));

  const companies = new Map<string, CompanyInfo>(
    (companyRows ?? []).map((row) => [
      row.id,
      { name: row.name, contactName: row.contact_name, contactPhone: row.contact_phone },
    ]),
  );

  // 1) 연락처가 없거나 휴대폰 형식이 아닌 기업은 발송 대상에서 제외한다.
  const sendable: { recipient: PendingRecipient; company: CompanyInfo; phone: string }[] = [];
  const skippedIds: string[] = [];

  for (const recipient of recipients) {
    const company = companies.get(recipient.companyId);
    const phone = normalizeKoreanMobile(company?.contactPhone);
    if (!company || !phone) {
      skippedIds.push(recipient.id);
      continue;
    }
    sendable.push({ recipient, company, phone });
  }

  if (skippedIds.length > 0) {
    await service
      .from("campaign_recipient")
      .update({
        status: "skipped",
        error_code: "no_phone",
        error_message: "연락처 없음 또는 휴대폰 형식 오류",
      })
      .in("id", skippedIds);
  }

  // 2) 청크 단위 발송.
  const dryRun = isAlimtalkDryRun();
  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < sendable.length; offset += CHUNK_SIZE) {
    const chunk = sendable.slice(offset, offset + CHUNK_SIZE);
    const now = new Date().toISOString();

    // 시도 횟수를 먼저 올려, 함수가 중간에 죽어도 무한 재시도가 되지 않게 한다.
    await Promise.all(
      chunk.map(({ recipient, phone }) =>
        service
          .from("campaign_recipient")
          .update({ phone, attempts: recipient.attempts + 1 })
          .eq("id", recipient.id),
      ),
    );

    if (dryRun) {
      await Promise.all(
        chunk.map(({ recipient }) =>
          service
            .from("campaign_recipient")
            .update({
              status: "delivered",
              delivered: true,
              delivered_at: now,
              sent_at: now,
              provider_message_id: `dry-run:${recipient.id}`,
              error_code: null,
              error_message: null,
            })
            .eq("id", recipient.id),
        ),
      );
      sent += chunk.length;
      continue;
    }

    const messages: SolapiMessage[] = chunk.map(({ recipient, company, phone }) => {
      const variables = buildVariables(template.variables, company);
      return {
        to: phone,
        from: credential.senderPhone,
        text: renderText(template.content, variables),
        kakaoOptions: {
          pfId: credential.pfId,
          templateId: template.solapi_template_id,
          variables,
          disableSms: !credential.smsFallback,
        },
        customFields: { campaignId, recipientId: recipient.id },
      };
    });

    try {
      const result = await sendMany(credential, messages);
      const byRecipient = new Map(
        result.outcomes
          .filter((outcome) => outcome.recipientId)
          .map((outcome) => [outcome.recipientId as string, outcome]),
      );

      await Promise.all(
        chunk.map(async ({ recipient }, index) => {
          // recipientId 매핑 우선, 없으면 요청 순서로 폴백(전화번호 매칭은 중복 위험).
          const outcome = byRecipient.get(recipient.id) ?? result.outcomes[index] ?? null;
          if (outcome?.ok) {
            sent += 1;
            await service
              .from("campaign_recipient")
              .update({
                status: "sent",
                sent_at: now,
                provider_message_id: outcome.messageId,
                provider_group_id: result.groupId,
                error_code: null,
                error_message: null,
              })
              .eq("id", recipient.id);
            return;
          }
          failed += 1;
          await service
            .from("campaign_recipient")
            .update({
              status: "failed",
              provider_group_id: result.groupId,
              error_code: outcome?.statusCode ?? "unknown",
              error_message: outcome?.statusMessage ?? "발송 접수에 실패했습니다.",
            })
            .eq("id", recipient.id);
        }),
      );
    } catch (err) {
      // 청크 전체 실패(네트워크·인증·잔액 부족 등).
      const message = err instanceof Error ? err.message : String(err);
      console.error("[alimtalk:send]", message);
      failed += chunk.length;
      await service
        .from("campaign_recipient")
        .update({ status: "failed", error_code: "request_failed", error_message: message })
        .in(
          "id",
          chunk.map(({ recipient }) => recipient.id),
        );
    }
  }

  // 3) 부분 실패여도 캠페인은 발송완료로 닫는다 — 실패는 수신자별 상태로 드러난다.
  await service
    .from("campaign")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", campaignId);

  return { campaignId, sent, failed, skipped: skippedIds.length, alreadyClaimed: false };
}

/**
 * 예약 시각이 된 캠페인을 발송한다(cron 진입점).
 * 먼저 죽은 실행이 남긴 sending 캠페인을 scheduled로 되돌려 회수한다 —
 * 워커는 pending 수신자만 처리하므로 이미 보낸 건이 다시 나가지는 않는다.
 */
export async function runDueCampaigns(
  service: Service,
  limit = 5,
): Promise<SendSummary[]> {
  const stuckBefore = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
  const { error: rescueError } = await service
    .from("campaign")
    .update({ status: "scheduled" })
    .eq("status", "sending")
    .lt("send_started_at", stuckBefore);
  if (rescueError) {
    console.error("[alimtalk:rescue]", rescueError.code, rescueError.message);
  }

  const { data: due, error } = await service
    .from("campaign")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[alimtalk:due]", error.code, error.message);
    return [];
  }

  const summaries: SendSummary[] = [];
  for (const campaign of due ?? []) {
    summaries.push(await sendCampaign(service, campaign.id));
  }
  return summaries;
}

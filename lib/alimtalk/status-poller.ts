import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getTenantAlimtalkCredential } from "@/lib/alimtalk/settings";
import { isTerminalFailure, listGroupMessages } from "@/lib/alimtalk/solapi";

// 도달 확인 폴링.
//
// 웹훅 대신 폴링을 쓰는 이유: 자격증명이 테넌트별이라 웹훅을 쓰려면 각 컨설팅사가
// 자기 Solapi 콘솔에 URL을 직접 등록해야 한다. 폴링은 저장된 키로 우리가 조회하므로
// 고객 쪽 추가 작업이 없다.

type Service = SupabaseClient<Database>;

/** 이 시간이 지난 발송은 더 조회하지 않는다(무한 폴링 방지). */
const LOOKBACK_HOURS = 72;
/** 한 번 실행에서 조회할 최대 발송 그룹 수. */
const MAX_GROUPS = 20;

export interface PollSummary {
  groups: number;
  delivered: number;
  failed: number;
}

/**
 * 접수(sent) 상태로 남아 있는 수신자의 최종 도달 여부를 Solapi에서 확인해 반영한다.
 * delivered로 이미 넘어간 행은 건드리지 않는다(상태 역행 방지).
 */
export async function pollDeliveryStatus(service: Service): Promise<PollSummary> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString();

  const { data: rows, error } = await service
    .from("campaign_recipient")
    .select("id, tenant_id, provider_group_id, provider_message_id")
    .eq("status", "sent")
    .not("provider_group_id", "is", null)
    .gte("sent_at", since)
    .limit(2000);

  if (error) {
    console.error("[alimtalk:poll]", error.code, error.message);
    return { groups: 0, delivered: 0, failed: 0 };
  }

  // 그룹 단위로 묶어 조회 횟수를 줄인다(그룹 1건 = API 1회).
  const groups = new Map<string, { tenantId: string; groupId: string }>();
  for (const row of rows ?? []) {
    if (!row.provider_group_id) continue;
    const key = `${row.tenant_id}:${row.provider_group_id}`;
    if (!groups.has(key)) {
      groups.set(key, { tenantId: row.tenant_id, groupId: row.provider_group_id });
    }
  }

  const summary: PollSummary = { groups: 0, delivered: 0, failed: 0 };
  const credentials = new Map<string, Awaited<ReturnType<typeof getTenantAlimtalkCredential>>>();

  for (const { tenantId, groupId } of Array.from(groups.values()).slice(0, MAX_GROUPS)) {
    if (!credentials.has(tenantId)) {
      credentials.set(tenantId, await getTenantAlimtalkCredential(service, tenantId));
    }
    const credential = credentials.get(tenantId);
    if (!credential) continue;

    try {
      const statuses = await listGroupMessages(credential, groupId);
      summary.groups += 1;

      for (const status of statuses) {
        // recipientId를 못 받았으면 messageId로 되짚는다.
        const match = status.recipientId
          ? { column: "id" as const, value: status.recipientId }
          : status.messageId
            ? { column: "provider_message_id" as const, value: status.messageId }
            : null;
        if (!match) continue;

        if (status.delivered) {
          const now = new Date().toISOString();
          await service
            .from("campaign_recipient")
            .update({ status: "delivered", delivered: true, delivered_at: now })
            .eq(match.column, match.value)
            .eq("status", "sent");
          summary.delivered += 1;
        } else if (isTerminalFailure(status.statusCode)) {
          await service
            .from("campaign_recipient")
            .update({
              status: "failed",
              error_code: status.statusCode,
              error_message: status.statusMessage ?? "수신에 실패했습니다.",
            })
            .eq(match.column, match.value)
            .eq("status", "sent");
          summary.failed += 1;
        }
      }
    } catch (err) {
      // 한 그룹 조회 실패가 나머지를 막지 않게 한다 — 다음 주기에 다시 시도된다.
      console.error("[alimtalk:poll-group]", groupId, err);
    }
  }

  return summary;
}

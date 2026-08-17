"use server";

// 알림톡 템플릿 서버 액션 — 설정 → 알림톡 화면.
// 템플릿 등록·검수는 각 사 Solapi 콘솔에서 하고, 여기에는 승인된 템플릿 ID와
// 본문 사본만 등록한다(위저드 미리보기·변수 치환용).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  optionalText,
  requirePermission,
  type ActionResult,
} from "@/lib/actions/shared";

/** 검수 본문에서 #{변수}를 추출한다. 발송 시 이 집합만 Solapi로 넘긴다. */
function extractVariables(content: string): string[] {
  const matches = content.match(/#\{[^}]+\}/g) ?? [];
  return Array.from(new Set(matches));
}

interface TemplateFields {
  name: string;
  solapiTemplateId: string;
  content: string;
  variables: string[];
  isActive: boolean;
}

function parseFields(formData: FormData): TemplateFields | { error: string } {
  const name = optionalText(formData, "name");
  const solapiTemplateId = optionalText(formData, "solapi_template_id");
  const content = optionalText(formData, "content");

  if (!name) return { error: "템플릿 이름을 입력해 주세요." };
  if (!solapiTemplateId) {
    return { error: "Solapi 콘솔에서 검수 완료된 템플릿 ID를 입력해 주세요." };
  }
  if (!content) return { error: "검수받은 템플릿 본문을 붙여넣어 주세요." };

  return {
    name,
    solapiTemplateId,
    content,
    variables: extractVariables(content),
    isActive: formData.get("is_active") !== null,
  };
}

export async function createAlimtalkTemplate(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "campaigns.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const fields = parseFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const { error } = await supabase.from("alimtalk_template").insert({
    tenant_id: allowed.tenantId,
    name: fields.name,
    solapi_template_id: fields.solapiTemplateId,
    content: fields.content,
    variables: fields.variables,
    is_active: fields.isActive,
  });

  if (error) {
    console.error("[createAlimtalkTemplate]", error.code, error.message);
    if (error.code === "23505") {
      return { ok: false, error: "이미 등록된 템플릿 ID입니다." };
    }
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/campaigns");
  return { ok: true, error: null };
}

export async function updateAlimtalkTemplate(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "campaigns.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const fields = parseFields(formData);
  if ("error" in fields) return { ok: false, error: fields.error };

  const { error } = await supabase
    .from("alimtalk_template")
    .update({
      name: fields.name,
      solapi_template_id: fields.solapiTemplateId,
      content: fields.content,
      variables: fields.variables,
      is_active: fields.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[updateAlimtalkTemplate]", error.code, error.message);
    if (error.code === "23505") {
      return { ok: false, error: "이미 등록된 템플릿 ID입니다." };
    }
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/campaigns");
  return { ok: true, error: null };
}

export async function deleteAlimtalkTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "campaigns.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const { error } = await supabase.from("alimtalk_template").delete().eq("id", id);

  if (error) {
    console.error("[deleteAlimtalkTemplate]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/campaigns");
  return { ok: true, error: null };
}

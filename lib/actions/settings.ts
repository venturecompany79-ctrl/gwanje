"use server";

// 설정 서버 액션 — 프로필/발신정보 · 알림 규칙 · 분류 카테고리
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  DEMO_ERROR,
  getTenantContext,
  requireOwner,
  requirePermission,
  type ActionResult,
  type Supabase,
} from "@/lib/actions/shared";
import {
  isMemberRole,
  normalizePermissions,
  type MemberRole,
  type PermissionKey,
} from "@/lib/permissions";
import { CATEGORY_COLORS, type CategoryColor } from "@/lib/categoryColors";

// 사전 알림 시점은 사용자가 자유롭게 추가/변경 (GWJ-017) — 1~365일 정수 범위만 검증
const LEAD_DAY_MIN = 1;
const LEAD_DAY_MAX = 365;
const CHANNEL_OPTIONS = ["email", "alimtalk"];
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function clean(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

async function getUserId(
  supabase: Supabase,
): Promise<{ userId: string } | { error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "세션이 만료되었습니다. 다시 로그인해 주세요." };
  }
  return { userId: auth.user.id };
}

export interface ProfileInput {
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  senderName: string | null;
  senderPhone: string | null;
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };

  const user = await getUserId(supabase);
  if ("error" in user) return { ok: false, error: user.error };

  const { error } = await supabase
    .from("profile")
    .update({
      name,
      title: clean(input.title),
      phone: clean(input.phone),
      email: clean(input.email),
      sender_name: clean(input.senderName),
      sender_phone: clean(input.senderPhone),
    })
    .eq("id", user.userId);
  if (error) {
    console.error("[updateProfile]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  // 이름·직함은 앱 셸(사이드바·상단바)에도 표시 — /app 전체 무효화
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export interface NotifyRulesInput {
  /** 사전 알림 시점 — 7/3/1 중 켜진 값 */
  leadDays: number[];
  /** 발송 채널 — email / alimtalk */
  channels: string[];
  notifyMatch: boolean;
  /** "HH:MM" (null = 일일 요약 off) */
  dailySummaryAt: string | null;
}

export async function updateNotifyRules(
  input: NotifyRulesInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "settings.rules.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (
    input.leadDays.some(
      (d) => !Number.isInteger(d) || d < LEAD_DAY_MIN || d > LEAD_DAY_MAX,
    )
  ) {
    return {
      ok: false,
      error: "사전 알림 시점은 1~365일 사이의 일수여야 합니다.",
    };
  }
  if (input.channels.some((c) => !CHANNEL_OPTIONS.includes(c))) {
    return { ok: false, error: "발송 채널 값이 올바르지 않습니다." };
  }
  if (
    input.dailySummaryAt !== null &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dailySummaryAt)
  ) {
    return { ok: false, error: "일일 요약 시각이 올바르지 않습니다." };
  }

  const user = await getUserId(supabase);
  if ("error" in user) return { ok: false, error: user.error };

  const { error } = await supabase
    .from("profile")
    .update({
      notify_lead_days: [...new Set(input.leadDays)].sort((a, b) => b - a),
      notify_channels: input.channels,
      notify_match: input.notifyMatch,
      daily_summary_at: input.dailySummaryAt,
    })
    .eq("id", user.userId);
  if (error) {
    console.error("[updateNotifyRules]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  return { ok: true, error: null };
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "settings.categories.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "카테고리 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("category")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) {
    console.error("[renameCategory]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  // 카테고리 칩은 대시보드·보드·기업상세 등 전 화면에서 사용
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export async function setCategoryColor(
  id: string,
  color: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "settings.categories.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (!id) return { ok: false, error: "분류를 찾을 수 없습니다." };
  if (color !== null && !CATEGORY_COLORS.includes(color as CategoryColor)) {
    return { ok: false, error: "허용되지 않은 색상입니다." };
  }

  const { error } = await supabase
    .from("category")
    .update({ color })
    .eq("id", id);
  if (error) {
    console.error("[setCategoryColor]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  // 카테고리 칩은 대시보드·보드·기업상세 등 전 화면에서 사용
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export type AddCategoryResult = ActionResult & { categoryId?: string };

export async function addCategory(name: string): Promise<AddCategoryResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "settings.categories.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "카테고리 이름을 입력해 주세요." };

  const context = await getTenantContext(supabase);
  if ("error" in context) return { ok: false, error: context.error };

  const { data: last } = await supabase
    .from("category")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("category")
    .insert({
      tenant_id: context.tenantId,
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[addCategory]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app", "layout");
  return { ok: true, error: null, categoryId: data.id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!id) return { ok: false, error: "분류를 찾을 수 없습니다." };

  const allowed = await requirePermission(supabase, "settings.categories.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  // 연결된 자격·과제의 category_id는 on delete set null로 끊기고 레코드는 보존됨
  const { error } = await supabase.from("category").delete().eq("id", id);
  if (error) {
    console.error("[deleteCategory]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export interface InviteTeamMemberInput {
  name: string;
  title: string | null;
  email: string;
  role: MemberRole;
  permissions: PermissionKey[];
}

export async function inviteTeamMember(
  input: InviteTeamMemberInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const owner = await requireOwner(supabase);
  if ("error" in owner) return { ok: false, error: owner.error };

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "초대 서버 설정이 누락되었습니다(service role)." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "이메일 형식이 올바르지 않습니다." };
  }
  if (!isMemberRole(input.role)) {
    return { ok: false, error: "역할 값이 올바르지 않습니다." };
  }

  const { data: existing, error: existingError } = await service
    .from("profile")
    .select("id, status")
    .eq("tenant_id", owner.tenantId)
    .ilike("email", email)
    .maybeSingle();
  if (existingError) {
    console.error("[inviteTeamMember:existing]", existingError.code, existingError.message);
    return { ok: false, error: `팀원 확인에 실패했습니다: ${existingError.message}` };
  }
  if (existing && existing.status !== "disabled") {
    return { ok: false, error: "이미 등록되었거나 초대 중인 이메일입니다." };
  }

  const origin = await getRequestOrigin();
  const { data: invite, error: inviteError } =
    await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? `${origin}/invite/accept` : undefined,
      data: {
        tenant_id: owner.tenantId,
        invited_by: owner.userId,
        name,
        role: input.role,
      },
    });
  if (inviteError || !invite.user) {
    console.error("[inviteTeamMember:auth]", inviteError?.message);
    return {
      ok: false,
      error: `초대 메일 발송에 실패했습니다: ${inviteError?.message ?? "알 수 없는 오류"}`,
    };
  }

  const permissions = normalizePermissions(input.role, input.permissions);
  const { error } = await service.from("profile").upsert(
    {
      id: invite.user.id,
      tenant_id: owner.tenantId,
      name,
      title: clean(input.title),
      email,
      role: input.role,
      permissions,
      status: "invited",
      invited_by: owner.userId,
      invited_at: new Date().toISOString(),
      disabled_at: null,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("[inviteTeamMember:profile]", error.code, error.message);
    return { ok: false, error: `팀원 등록에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  return { ok: true, error: null };
}

export interface UpdateTeamMemberInput {
  memberId: string;
  role: MemberRole;
  permissions: PermissionKey[];
}

export async function updateTeamMember(
  input: UpdateTeamMemberInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const owner = await requireOwner(supabase);
  if ("error" in owner) return { ok: false, error: owner.error };

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "팀원 수정 서버 설정이 누락되었습니다(service role)." };
  }
  if (!input.memberId) return { ok: false, error: "팀원을 찾을 수 없습니다." };
  if (input.memberId === owner.userId) {
    return { ok: false, error: "본인의 역할과 권한은 직접 변경할 수 없습니다." };
  }
  if (!isMemberRole(input.role)) {
    return { ok: false, error: "역할 값이 올바르지 않습니다." };
  }

  const { data: target, error: targetError } = await service
    .from("profile")
    .select("id, role, status, tenant_id")
    .eq("id", input.memberId)
    .eq("tenant_id", owner.tenantId)
    .maybeSingle();
  if (targetError || !target) {
    if (targetError) console.error("[updateTeamMember:target]", targetError.code, targetError.message);
    return { ok: false, error: "팀원을 찾을 수 없습니다." };
  }

  if (target.role === "owner" && input.role !== "owner" && target.status === "active") {
    const { count } = await service
      .from("profile")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", owner.tenantId)
      .eq("role", "owner")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "마지막 최고관리자는 변경할 수 없습니다." };
    }
  }

  const { error } = await service
    .from("profile")
    .update({
      role: input.role,
      permissions: normalizePermissions(input.role, input.permissions),
    })
    .eq("id", input.memberId)
    .eq("tenant_id", owner.tenantId);
  if (error) {
    console.error("[updateTeamMember]", error.code, error.message);
    return { ok: false, error: `팀원 수정에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export async function disableTeamMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const owner = await requireOwner(supabase);
  if ("error" in owner) return { ok: false, error: owner.error };

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "팀원 비활성화 서버 설정이 누락되었습니다(service role)." };
  }
  if (!memberId) return { ok: false, error: "팀원을 찾을 수 없습니다." };
  if (memberId === owner.userId) {
    return { ok: false, error: "본인 계정은 비활성화할 수 없습니다." };
  }

  const { data: target, error: targetError } = await service
    .from("profile")
    .select("id, role, status")
    .eq("id", memberId)
    .eq("tenant_id", owner.tenantId)
    .maybeSingle();
  if (targetError || !target) {
    if (targetError) console.error("[disableTeamMember:target]", targetError.code, targetError.message);
    return { ok: false, error: "팀원을 찾을 수 없습니다." };
  }

  if (target.role === "owner" && target.status === "active") {
    const { count } = await service
      .from("profile")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", owner.tenantId)
      .eq("role", "owner")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "마지막 최고관리자는 비활성화할 수 없습니다." };
    }
  }

  const now = new Date().toISOString();
  const { error } = await service
    .from("profile")
    .update({ status: "disabled", disabled_at: now })
    .eq("id", memberId)
    .eq("tenant_id", owner.tenantId);
  if (error) {
    console.error("[disableTeamMember]", error.code, error.message);
    return { ok: false, error: `팀원 비활성화에 실패했습니다: ${error.message}` };
  }

  const { error: banError } = await service.auth.admin.updateUserById(memberId, {
    ban_duration: "876000h",
  });
  if (banError) {
    console.error("[disableTeamMember:ban]", banError.message);
  }

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export async function acceptTeamInvite(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "초대 세션을 확인할 수 없습니다. 초대 메일 링크로 다시 접속해 주세요." };
  }

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "초대 수락 서버 설정이 누락되었습니다(service role)." };
  }

  const { data: profile, error: profileError } = await service
    .from("profile")
    .select("status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    if (profileError) console.error("[acceptTeamInvite:profile]", profileError.code, profileError.message);
    return { ok: false, error: "초대 정보를 찾을 수 없습니다." };
  }
  if (profile.status === "disabled") {
    return { ok: false, error: "비활성화된 계정입니다. 최고관리자에게 문의해 주세요." };
  }

  const { error } = await service
    .from("profile")
    .update({
      status: "active",
      accepted_at: new Date().toISOString(),
      disabled_at: null,
    })
    .eq("id", auth.user.id);
  if (error) {
    console.error("[acceptTeamInvite]", error.code, error.message);
    return { ok: false, error: `초대 수락에 실패했습니다: ${error.message}` };
  }

  await service.auth.admin.updateUserById(auth.user.id, {
    ban_duration: "none",
  });

  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

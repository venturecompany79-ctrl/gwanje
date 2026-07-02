// 서버 액션 공용 헬퍼 — "use server" 파일은 async 함수만 export 가능하므로 분리
import type { createClient } from "@/lib/supabase/server";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
} from "@/lib/data/current-member";
import { isValidDateString } from "@/lib/datetime";
import {
  hasPermission,
  isMemberRole,
  isMemberStatus,
  type MemberRole,
  type MemberStatus,
  type PermissionKey,
} from "@/lib/permissions";

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

export const DEMO_ERROR =
  "데모 모드에서는 저장되지 않습니다. Supabase 연결(.env.local) 후 이용해 주세요.";

export function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

export type ParsedDate =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export type ParsedRequiredDate =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type ValidationResult =
  | { ok: true; error: null }
  | { ok: false; error: string };

export function parseOptionalDate(
  formData: FormData,
  key: string,
  label: string,
): ParsedDate {
  const value = optionalText(formData, key);
  if (value === null) return { ok: true, value: null };
  if (!isValidDateString(value)) {
    return {
      ok: false,
      error: `${label}은(는) YYYY-MM-DD 형식의 올바른 날짜로 입력해 주세요.`,
    };
  }
  return { ok: true, value };
}

export function parseRequiredDate(
  formData: FormData,
  key: string,
  label: string,
): ParsedRequiredDate {
  const parsed = parseOptionalDate(formData, key, label);
  if (!parsed.ok) return parsed;
  if (parsed.value === null) {
    return { ok: false, error: `${label}을(를) 선택해 주세요.` };
  }
  return { ok: true, value: parsed.value };
}

export function validateDateOrder(
  startDate: string | null,
  endDate: string | null,
  startLabel: string,
  endLabel: string,
): ValidationResult {
  if (startDate && endDate && startDate > endDate) {
    return {
      ok: false,
      error: `${endLabel}은(는) ${startLabel}보다 빠를 수 없습니다.`,
    };
  }
  return { ok: true, error: null };
}

export type ParsedNumber =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/** "억 원" 입력 → 원(정수). 빈 값=null. 음수·NaN·Infinity 거부. (서버 액션은 공개 엔드포인트라 클라이언트 min= 검증을 신뢰하지 않음) */
export function parseEokToWon(formData: FormData, key: string): ParsedNumber {
  const text = optionalText(formData, key);
  if (text === null) return { ok: true, value: null };
  const eok = Number(text);
  if (!Number.isFinite(eok) || eok < 0) {
    return { ok: false, error: "연 매출은 0 이상의 숫자(억 원)로 입력해 주세요." };
  }
  return { ok: true, value: Math.round(eok * 100_000_000) };
}

/** 0 이상 정수 입력. 빈 값=null. 소수·NaN·음수 거부. */
export function parseNonNegativeInt(
  formData: FormData,
  key: string,
  label: string,
): ParsedNumber {
  const text = optionalText(formData, key);
  if (text === null) return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, error: `${label}은(는) 0 이상의 정수로 입력해 주세요.` };
  }
  return { ok: true, value: n };
}

export type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export interface MemberContext {
  tenantId: string;
  userId: string;
  role: MemberRole;
  permissions: string[];
  status: MemberStatus;
}

// RLS insert 정책은 tenant_id 일치를 요구 — 본인 프로필에서 조회해 채운다
export async function getTenantContext(
  supabase: Supabase,
): Promise<{ tenantId: string; userId: string } | { error: string }> {
  const member = await getMemberContext(supabase);
  if ("error" in member) return member;
  return { tenantId: member.tenantId, userId: member.userId };
}

export async function assertCompanyAccess(
  supabase: Supabase,
  companyId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("company")
    .select("id")
    .eq("id", companyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[assertCompanyAccess]", error.code, error.message);
    return { ok: false, error: `기업 확인에 실패했습니다: ${error.message}` };
  }
  if (!data) return { ok: false, error: "기업을 찾을 수 없습니다." };
  return { ok: true };
}

export async function getMemberContext(
  supabase: Supabase,
): Promise<MemberContext | { error: string }> {
  const identity = await getCurrentIdentity(supabase);
  if (!identity) {
    return { error: "세션이 만료되었습니다. 다시 로그인해 주세요." };
  }
  const profile = await readCurrentMemberProfile(supabase, identity.userId);
  if (!profile) {
    return { error: "프로필 정보를 찾을 수 없습니다. seed.sql 적용 여부를 확인해 주세요." };
  }
  if (!isMemberStatus(profile.status)) {
    return { error: "계정 상태 정보가 올바르지 않습니다. 관리자에게 문의해 주세요." };
  }
  if (profile.status !== "active") {
    return { error: "비활성화되었거나 아직 초대 수락 전인 계정입니다." };
  }
  if (!isMemberRole(profile.role)) {
    return { error: "권한 정보가 올바르지 않습니다. 관리자에게 문의해 주세요." };
  }
  return {
    tenantId: profile.tenant_id,
    userId: identity.userId,
    role: profile.role,
    permissions: profile.permissions ?? [],
    status: profile.status,
  };
}

export async function requirePermission(
  supabase: Supabase,
  permission: PermissionKey,
): Promise<MemberContext | { error: string }> {
  const member = await getMemberContext(supabase);
  if ("error" in member) return member;
  if (!hasPermission(member, permission)) {
    return { error: "이 기능을 사용할 권한이 없습니다." };
  }
  return member;
}

export async function requireOwner(
  supabase: Supabase,
): Promise<MemberContext | { error: string }> {
  const member = await getMemberContext(supabase);
  if ("error" in member) return member;
  if (member.role !== "owner") {
    return { error: "최고관리자만 사용할 수 있는 기능입니다." };
  }
  return member;
}

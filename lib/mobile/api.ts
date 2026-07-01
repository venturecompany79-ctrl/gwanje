import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  getSupabaseConfigErrorMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import {
  hasPermission,
  isMemberRole,
  isMemberStatus,
  type MemberRole,
  type MemberStatus,
  type PermissionKey,
} from "@/lib/permissions";

export interface MobileMemberContext {
  tenantId: string;
  userId: string;
  role: MemberRole;
  permissions: string[];
  status: MemberStatus;
}

export type MobileSupabase = ReturnType<
  typeof createSupabaseClient<Database>
>;

export interface MobileRequestContext {
  supabase: MobileSupabase;
  member: MobileMemberContext;
  user: User;
  token: string;
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function mobileError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function mobileOk<T extends object>(data?: T) {
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

export async function mobileJson<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function requireMobileContext(
  request: NextRequest,
  permission?: PermissionKey,
): Promise<MobileRequestContext | NextResponse> {
  if (!isSupabaseConfigured()) {
    return mobileError(getSupabaseConfigErrorMessage(), 503);
  }

  const token = bearerToken(request);
  if (!token) {
    return mobileError("인증 토큰이 없습니다.", 401);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return mobileError(getSupabaseConfigErrorMessage(), 503);
  }

  const supabase = createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return mobileError("세션이 만료되었습니다. 다시 로그인해 주세요.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("id, tenant_id, role, permissions, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return mobileError(`프로필 조회에 실패했습니다: ${profileError.message}`, 500);
  }
  if (
    !profile ||
    !isMemberRole(profile.role) ||
    !isMemberStatus(profile.status)
  ) {
    return mobileError("프로필 정보를 찾을 수 없습니다.", 403);
  }

  const member: MobileMemberContext = {
    tenantId: profile.tenant_id,
    userId: user.id,
    role: profile.role,
    permissions: profile.permissions ?? [],
    status: profile.status,
  };

  if (member.status !== "active") {
    return mobileError("비활성화되었거나 아직 초대 수락 전인 계정입니다.", 403);
  }
  if (permission && !hasPermission(member, permission)) {
    return mobileError("이 기능을 사용할 권한이 없습니다.", 403);
  }

  return { supabase, member, user, token };
}

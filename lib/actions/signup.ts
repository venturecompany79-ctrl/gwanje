"use server";

import { revalidatePath } from "next/cache";
import { DEMO_ERROR, type ActionResult } from "@/lib/actions/shared";
import { isSignupEnabled } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// 신규 워크스페이스 기본 분류 5종 (provision-trial-account.sql과 동일, sort_order 1~5)
const DEFAULT_CATEGORIES = [
  "정부지원사업",
  "벤처기업확인",
  "기업부설연구소",
  "세액공제",
  "정책자금",
];

export interface CompleteSignupInput {
  name: string;
  title: string | null;
  workspaceName: string;
  agreedToTerms: boolean;
}

/**
 * Google OAuth 가입 완료 — 온보딩(/signup/complete)에서 호출.
 * tenant → profile → category 5종을 service role로 생성한다.
 * profile은 authenticated INSERT가 RLS로 차단돼 있어 반드시 service role이어야 하고,
 * SECURITY DEFINER RPC로 만들면 PostgREST 직접 호출로 SIGNUP_ENABLED 게이트를
 * 우회할 수 있으므로 서버 액션에 둔다.
 */
export async function completeSignup(
  input: CompleteSignupInput,
): Promise<ActionResult> {
  if (!isSignupEnabled()) {
    return { ok: false, error: "아직 회원가입이 열리지 않았습니다." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return { ok: false, error: "세션이 만료되었습니다. 다시 로그인해 주세요." };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if (!input.agreedToTerms) {
    return { ok: false, error: "이용약관과 개인정보 처리방침에 동의해 주세요." };
  }
  const workspaceName = input.workspaceName.trim() || `${name} 컨설팅`;

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "가입 서버 설정이 누락되었습니다(service role)." };
  }

  // 멱등 가드 — 새로고침/뒤로가기 재제출 시 이미 가입됐으면 성공 처리
  const { data: existing, error: existingError } = await service
    .from("profile")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) {
    console.error("[completeSignup:existing]", existingError.code, existingError.message);
    return { ok: false, error: "가입 상태 확인에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (existing?.status === "active") {
    revalidatePath("/app", "layout");
    return { ok: true, error: null };
  }
  if (existing) {
    return {
      ok: false,
      error: "초대 중이거나 비활성화된 계정입니다. 최고관리자에게 문의해 주세요.",
    };
  }

  // tenant → profile → category 순차 생성.
  // 실패 시 tenant 삭제 한 번으로 전체 롤백(profile·category는 FK cascade).
  const { data: tenant, error: tenantError } = await service
    .from("tenant")
    .insert({ name: workspaceName })
    .select("id")
    .single();
  if (tenantError || !tenant) {
    console.error("[completeSignup:tenant]", tenantError?.code, tenantError?.message);
    return { ok: false, error: "워크스페이스 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const cleanup = () => service.from("tenant").delete().eq("id", tenant.id);

  const { error: profileError } = await service.from("profile").insert({
    id: user.id,
    tenant_id: tenant.id,
    name,
    title: input.title?.trim() || null,
    email: user.email ?? null,
    // role/status/permissions/알림 규칙은 DB 기본값(owner/active/전체 권한/{7,3,1})
  });
  if (profileError) {
    await cleanup();
    if (profileError.code === "23505") {
      // 동시 제출 경합 — 상대 요청이 먼저 프로비저닝을 끝냈으므로 성공 처리
      revalidatePath("/app", "layout");
      return { ok: true, error: null };
    }
    console.error("[completeSignup:profile]", profileError.code, profileError.message);
    return { ok: false, error: "프로필 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const { error: categoryError } = await service.from("category").insert(
    DEFAULT_CATEGORIES.map((categoryName, index) => ({
      tenant_id: tenant.id,
      name: categoryName,
      sort_order: index + 1,
    })),
  );
  if (categoryError) {
    await cleanup(); // profile도 cascade로 함께 삭제된다
    console.error("[completeSignup:category]", categoryError.code, categoryError.message);
    return { ok: false, error: "기본 분류 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

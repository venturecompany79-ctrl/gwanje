import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
} from "@/lib/data/current-member";

export interface ConsultantOption {
  id: string;
  name: string;
  title: string | null;
}

export interface ConsultantOptionsData {
  demo: boolean;
  consultants: ConsultantOption[];
  currentConsultantId: string | null;
}

export const DEMO_CONSULTANTS: ConsultantOption[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "김컨설턴트", title: "경영컨설턴트" },
  { id: "00000000-0000-0000-0000-000000000002", name: "이컨설턴트", title: "수석 컨설턴트" },
  { id: "00000000-0000-0000-0000-000000000003", name: "박컨설턴트", title: "경영컨설턴트" },
];

export async function getConsultantOptions(): Promise<ConsultantOptionsData> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      demo: true,
      consultants: DEMO_CONSULTANTS,
      currentConsultantId: DEMO_CONSULTANTS[0].id,
    };
  }

  const identity = await getCurrentIdentity(supabase);
  const [profiles, currentProfile] = await Promise.all([
    supabase
      .from("profile")
      .select("id, name, title")
      .eq("status", "active")
      .order("name")
      .order("id"),
    identity
      ? readCurrentMemberProfile(supabase, identity.userId)
      : Promise.resolve(null),
  ]);

  if (profiles.error) {
    throw new Error(`컨설턴트 목록을 불러오지 못했습니다: ${profiles.error.message}`);
  }

  return {
    demo: false,
    consultants: profiles.data ?? [],
    currentConsultantId:
      currentProfile?.status === "active" ? currentProfile.id : null,
  };
}

/**
 * 주담당자로 저장하기 전에 같은 테넌트의 활성 프로필인지 재검증한다.
 * null은 비활성화·이관 중인 기업의 명시적인 "미배정" 상태다.
 */
export async function validatePrimaryConsultant(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  consultantId: string | null,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (consultantId === null) return { ok: true, value: null };

  const { data, error } = await supabase
    .from("profile")
    .select("id")
    .eq("id", consultantId)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[validatePrimaryConsultant]", error.code, error.message);
    return { ok: false, error: `주담당자 확인에 실패했습니다: ${error.message}` };
  }
  if (!data) {
    return { ok: false, error: "같은 워크스페이스의 활성 컨설턴트를 선택해 주세요." };
  }

  return { ok: true, value: data.id };
}

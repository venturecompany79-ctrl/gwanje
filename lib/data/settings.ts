import { createClient } from "@/lib/supabase/server";
import { DEMO_SETTINGS } from "@/lib/demo-data";

export interface SettingsProfile {
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  /** 알림톡 발신 프로필명 */
  senderName: string | null;
  /** 알림톡 발신번호 */
  senderPhone: string | null;
  /** 사전 알림 시점 — 7/3/1 중 켜진 값 */
  notifyLeadDays: number[];
  /** 발송 채널 — email / alimtalk */
  notifyChannels: string[];
  /** 공고매칭 알림 */
  notifyMatch: boolean;
  /** 일일 요약 시각 "HH:MM" (null = off) */
  dailySummaryAt: string | null;
}

export interface SettingsCategory {
  id: string;
  name: string;
  /** 팀 정식 정의 전까지 null — 칩은 중립 스타일 (CLAUDE.md 5절 갭 1) */
  color: string | null;
  sortOrder: number;
}

export interface SettingsData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  profile: SettingsProfile;
  categories: SettingsCategory[];
}

export async function getSettingsData(): Promise<SettingsData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SETTINGS();

  const [profileRes, categoriesRes] = await Promise.all([
    supabase.from("profile").select("*").maybeSingle(),
    supabase
      .from("category")
      .select("id, name, color, sort_order")
      .order("sort_order")
      .order("created_at"),
  ]);

  const firstError = profileRes.error ?? categoriesRes.error;
  if (firstError) {
    throw new Error(`설정을 불러오지 못했습니다: ${firstError.message}`);
  }
  const profile = profileRes.data;
  if (!profile) {
    throw new Error(
      "프로필 정보를 찾을 수 없습니다. seed.sql 적용 여부를 확인해 주세요.",
    );
  }

  return {
    demo: false,
    profile: {
      name: profile.name,
      title: profile.title,
      phone: profile.phone,
      email: profile.email,
      senderName: profile.sender_name,
      senderPhone: profile.sender_phone,
      notifyLeadDays: profile.notify_lead_days,
      notifyChannels: profile.notify_channels,
      notifyMatch: profile.notify_match,
      // DB time "09:00:00" → "09:00"
      dailySummaryAt: profile.daily_summary_at?.slice(0, 5) ?? null,
    },
    categories: (categoriesRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      sortOrder: c.sort_order,
    })),
  };
}

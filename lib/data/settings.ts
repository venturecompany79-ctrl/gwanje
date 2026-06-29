import { createClient } from "@/lib/supabase/server";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import {
  isMemberRole,
  isMemberStatus,
  normalizePermissions,
  type MemberRole,
  type MemberStatus,
  type PermissionKey,
} from "@/lib/permissions";

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

export interface SettingsDriveConnection {
  googleEmail: string | null;
  rootFolderName: string | null;
  connectedAt: string;
}

export interface SettingsDrive {
  /** 서버에 Google OAuth 환경변수가 갖춰졌는지 — false면 연결 버튼 비활성 */
  configured: boolean;
  /** 현재 사용자의 유효한 연결(없거나 해제됐으면 null) */
  connection: SettingsDriveConnection | null;
  /** 영구 실패(failed) 동기화 잡 수 — 0보다 크면 재연결 유도 */
  failedCount: number;
}

export interface SettingsCurrentMember {
  id: string;
  role: MemberRole;
  permissions: PermissionKey[];
  status: MemberStatus;
  canManageTeam: boolean;
}

export interface SettingsTeamMember {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  role: MemberRole;
  permissions: PermissionKey[];
  status: MemberStatus;
  invitedAt: string | null;
  acceptedAt: string | null;
  disabledAt: string | null;
  isCurrentUser: boolean;
}

export interface SettingsData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  profile: SettingsProfile;
  categories: SettingsCategory[];
  drive: SettingsDrive;
  currentMember: SettingsCurrentMember;
  teamMembers: SettingsTeamMember[];
}

export async function getSettingsData(): Promise<SettingsData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SETTINGS();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const [profileRes, categoriesRes, driveRes, driveFailedRes] = await Promise.all([
    supabase.from("profile").select("*").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("category")
      .select("id, name, color, sort_order")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("google_drive_connections")
      .select("google_email, root_folder_name, connected_at, revoked_at")
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("google_drive_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
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
  if (!isMemberRole(profile.role) || !isMemberStatus(profile.status)) {
    throw new Error("권한 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
  }

  const currentPermissions = normalizePermissions(
    profile.role,
    profile.permissions ?? [],
  );
  const canManageTeam = profile.role === "owner" && profile.status === "active";

  const teamRes = canManageTeam
    ? await supabase
        .from("profile")
        .select(
          "id, name, title, email, role, permissions, status, invited_at, accepted_at, disabled_at",
        )
        .eq("tenant_id", profile.tenant_id)
        .order("status")
        .order("created_at")
    : null;

  if (teamRes?.error) {
    throw new Error(`팀원을 불러오지 못했습니다: ${teamRes.error.message}`);
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
    drive: {
      configured: isGoogleDriveConfigured(),
      connection: driveRes.data
        ? {
            googleEmail: driveRes.data.google_email,
            rootFolderName: driveRes.data.root_folder_name,
            connectedAt: driveRes.data.connected_at,
          }
        : null,
      failedCount: driveFailedRes.count ?? 0,
    },
    currentMember: {
      id: auth.user.id,
      role: profile.role,
      permissions: currentPermissions,
      status: profile.status,
      canManageTeam,
    },
    teamMembers: (teamRes?.data ?? []).flatMap((member) => {
      if (!isMemberRole(member.role) || !isMemberStatus(member.status)) {
        return [];
      }
      return [
        {
          id: member.id,
          name: member.name,
          title: member.title,
          email: member.email,
          role: member.role,
          permissions: normalizePermissions(
            member.role,
            member.permissions ?? [],
          ),
          status: member.status,
          invitedAt: member.invited_at,
          acceptedAt: member.accepted_at,
          disabledAt: member.disabled_at,
          isCurrentUser: member.id === auth.user.id,
        },
      ];
    }),
  };
}

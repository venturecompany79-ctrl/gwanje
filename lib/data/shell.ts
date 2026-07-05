import { createClient } from "@/lib/supabase/server";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
  type CurrentMemberProfile,
} from "@/lib/data/current-member";
import {
  isMemberRole,
  normalizePermissions,
  type MemberRole,
  type MemberStatus,
  type PermissionKey,
} from "@/lib/permissions";

export interface ShellData {
  demo: boolean;
  consultantName: string;
  consultantTitle: string;
  orgName: string;
  unreadCount: number;
  role: MemberRole;
  permissions: PermissionKey[];
  /** 미들웨어 게이트의 이중 방어용 — active가 아니면 레이아웃에서 차단 */
  memberStatus: MemberStatus | null;
}

const DEMO_SHELL: ShellData = {
  demo: true,
  consultantName: "김컨설턴트",
  consultantTitle: "경영컨설턴트",
  orgName: "Growth Partners",
  unreadCount: 3,
  role: "owner",
  permissions: [
    "companies.read",
    "companies.write",
    "tasks.read",
    "tasks.write",
    "campaigns.read",
    "campaigns.write",
    "notifications.read",
    "settings.categories.write",
    "settings.rules.write",
    "settings.drive.write",
    "billing.manage",
  ],
  memberStatus: "active",
};

export async function getShellData(): Promise<ShellData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SHELL;

  const identity = await getCurrentIdentity(supabase);

  // RLS가 자기 tenant 행만 반환하므로 tenant 이름도 같은 병렬 배치에서 조회
  const [profile, unread, tenantRow] = await Promise.all([
    identity
      ? readCurrentMemberProfile(supabase, identity.userId)
      : Promise.resolve<CurrentMemberProfile | null>(null),
    supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
    supabase.from("tenant").select("name").maybeSingle(),
  ]);

  const role =
    profile?.role && isMemberRole(profile.role)
      ? profile.role
      : "viewer";
  const permissions = profile?.permissions?.length
    ? normalizePermissions(role, profile.permissions)
    : [];

  return {
    demo: false,
    consultantName: profile?.name ?? identity?.name ?? "컨설턴트",
    consultantTitle: profile?.title ?? "",
    orgName: tenantRow.data?.name ?? "",
    unreadCount: unread.count ?? 0,
    role,
    permissions,
    memberStatus: profile?.status ?? null,
  };
}

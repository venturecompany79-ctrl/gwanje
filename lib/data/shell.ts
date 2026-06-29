import { createClient } from "@/lib/supabase/server";
import {
  isMemberRole,
  normalizePermissions,
  type MemberRole,
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
};

export async function getShellData(): Promise<ShellData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SHELL;

  const { data: auth } = await supabase.auth.getUser();
  const [{ data: profile }, unread] = await Promise.all([
    auth.user
      ? supabase
          .from("profile")
          .select("name, title, role, permissions, tenant:tenant_id(name)")
          .eq("id", auth.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
  ]);
  const tenant = Array.isArray(profile?.tenant)
    ? profile?.tenant[0]
    : profile?.tenant;

  const role = profile?.role && isMemberRole(profile.role) ? profile.role : "viewer";

  return {
    demo: false,
    consultantName: profile?.name ?? "컨설턴트",
    consultantTitle: profile?.title ?? "",
    orgName: tenant?.name ?? "",
    unreadCount: unread.count ?? 0,
    role,
    permissions: normalizePermissions(role, profile?.permissions ?? []),
  };
}

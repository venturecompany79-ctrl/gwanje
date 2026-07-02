import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
  type CurrentMemberProfile,
} from "@/lib/data/current-member";
import {
  PERMISSION_KEYS,
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

async function readTenantNameById(
  tenantId: string | null | undefined,
): Promise<string> {
  if (!tenantId) return "";

  const service = createServiceClient();
  if (!service) return "";

  const { data } = await service
    .from("tenant")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  return data?.name ?? "";
}

export async function getShellData(): Promise<ShellData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SHELL;

  const identity = await getCurrentIdentity(supabase);
  const unreadPromise = supabase
    .from("notification")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  const [profile, unread] = await Promise.all([
    identity
      ? readCurrentMemberProfile(supabase, identity.userId)
      : Promise.resolve<CurrentMemberProfile | null>(null),
    unreadPromise,
  ]);

  const role =
    profile?.role && isMemberRole(profile.role)
      ? profile.role
      : identity
        ? "owner"
        : "viewer";
  const permissions = profile?.permissions?.length
    ? normalizePermissions(role, profile.permissions)
    : role === "owner"
      ? [...PERMISSION_KEYS]
      : [];
  const orgName = await readTenantNameById(profile?.tenant_id);

  return {
    demo: false,
    consultantName: profile?.name ?? identity?.name ?? "컨설턴트",
    consultantTitle: profile?.title ?? "",
    orgName,
    unreadCount: unread.count ?? 0,
    role,
    permissions,
  };
}

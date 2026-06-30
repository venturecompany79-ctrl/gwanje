import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

type TenantShape = { name: string | null } | { name: string | null }[] | null;

interface ShellProfileRow {
  name: string | null;
  title: string | null;
  role?: string | null;
  permissions?: string[] | null;
  tenant_id?: string | null;
  tenant?: TenantShape;
}

function readTenantName(profile: ShellProfileRow | null): string {
  const tenant = Array.isArray(profile?.tenant)
    ? profile?.tenant[0]
    : profile?.tenant;

  return tenant?.name ?? "";
}

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

async function readShellProfile(
  userClient: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
): Promise<ShellProfileRow | null> {
  const rich = await userClient
    .from("profile")
    .select("name, title, role, permissions, tenant:tenant_id(name)")
    .eq("id", userId)
    .maybeSingle();

  if (rich.data) return rich.data;

  const minimal = await userClient
    .from("profile")
    .select("name, title, role, permissions, tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (minimal.data) return minimal.data;

  const legacy = await userClient
    .from("profile")
    .select("name, title, tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (legacy.data) {
    return {
      ...legacy.data,
      role: "owner",
      permissions: [...PERMISSION_KEYS],
    };
  }

  const service = createServiceClient();
  if (!service) return null;

  const serviceProfile = await service
    .from("profile")
    .select("name, title, role, permissions, tenant_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (!serviceProfile.data || serviceProfile.data.status !== "active") {
    return null;
  }

  return serviceProfile.data;
}

export async function getShellData(): Promise<ShellData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SHELL;

  const [{ data: auth }, { data: claims }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const userId = auth.user?.id ?? claims?.claims.sub ?? null;
  const userName =
    typeof auth.user?.user_metadata?.name === "string"
      ? auth.user.user_metadata.name
      : null;
  const unreadPromise = supabase
    .from("notification")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  const [profile, unread] = await Promise.all([
    userId ? readShellProfile(supabase, userId) : Promise.resolve(null),
    unreadPromise,
  ]);

  const role =
    profile?.role && isMemberRole(profile.role)
      ? profile.role
      : userId
        ? "owner"
        : "viewer";
  const permissions = profile?.permissions?.length
    ? normalizePermissions(role, profile.permissions)
    : role === "owner"
      ? [...PERMISSION_KEYS]
      : [];
  const orgName = readTenantName(profile) || (await readTenantNameById(profile?.tenant_id));

  return {
    demo: false,
    consultantName: profile?.name ?? userName ?? "컨설턴트",
    consultantTitle: profile?.title ?? "",
    orgName,
    unreadCount: unread.count ?? 0,
    role,
    permissions,
  };
}

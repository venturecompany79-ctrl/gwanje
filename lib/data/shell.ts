import { createClient } from "@/lib/supabase/server";

export interface ShellData {
  demo: boolean;
  consultantName: string;
  consultantTitle: string;
  orgName: string;
  unreadCount: number;
}

const DEMO_SHELL: ShellData = {
  demo: true,
  consultantName: "김컨설턴트",
  consultantTitle: "경영컨설턴트",
  orgName: "Growth Partners",
  unreadCount: 3,
};

export async function getShellData(): Promise<ShellData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_SHELL;

  const [{ data: profile }, unread, { data: tenant }] = await Promise.all([
    supabase.from("profile").select("name, title, tenant_id").maybeSingle(),
    supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
    supabase.from("tenant").select("name").maybeSingle(),
  ]);

  return {
    demo: false,
    consultantName: profile?.name ?? "컨설턴트",
    consultantTitle: profile?.title ?? "",
    orgName: tenant?.name ?? "",
    unreadCount: unread.count ?? 0,
  };
}

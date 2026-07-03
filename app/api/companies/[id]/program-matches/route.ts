import { NextResponse } from "next/server";
import { assertCompanyAccess, requirePermission } from "@/lib/actions/shared";
import { getCompanyProgramMatches } from "@/lib/data/company-programs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  if (supabase) {
    const allowed = await requirePermission(supabase, "companies.read");
    if ("error" in allowed) {
      const status = allowed.error.includes("세션") ? 401 : 403;
      return NextResponse.json(
        { ok: false, error: allowed.error },
        { status },
      );
    }

    const access = await assertCompanyAccess(supabase, id, allowed.tenantId);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: 404 },
      );
    }
  }

  const data = await getCompanyProgramMatches(id);
  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...data });
}

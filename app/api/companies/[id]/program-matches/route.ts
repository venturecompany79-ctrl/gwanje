import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/data/current-member";
import { getCompanyProgramMatches } from "@/lib/data/company-programs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  if (supabase) {
    const identity = await getCurrentIdentity(supabase);
    if (!identity) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const { id } = await params;
  const data = await getCompanyProgramMatches(id);
  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...data });
}

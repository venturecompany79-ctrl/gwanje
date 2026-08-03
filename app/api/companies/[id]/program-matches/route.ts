import { NextResponse } from "next/server";
import { assertCompanyAccess, requirePermission } from "@/lib/actions/shared";
import {
  getCompanyProgramMatches,
  type CompanyProgramQuery,
  type ProgramDueFilter,
  type ProgramFitFilter,
  type ProgramSortKey,
  type ProgramStatusFilter,
} from "@/lib/data/company-programs";
import type { Json } from "@/lib/database.types";
import type { MatchEligibility } from "@/lib/gov-programs/match";
import { refreshCompanyDocumentMatchFacts } from "@/lib/gov-programs/profile";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const url = new URL(request.url);
  let member: Awaited<ReturnType<typeof requirePermission>> | null = null;
  if (supabase) {
    member = await requirePermission(supabase, "companies.read");
    if ("error" in member) {
      const status = member.error.includes("세션") ? 401 : 403;
      return NextResponse.json(
        { ok: false, error: member.error },
        { status },
      );
    }

    const access = await assertCompanyAccess(supabase, id, member.tenantId);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: 404 },
      );
    }
  }

  const canManageProfile =
    member && !("error" in member) ? hasPermission(member, "companies.write") : false;
  const canManageWorkflow =
    member && !("error" in member) ? hasPermission(member, "tasks.write") : false;

  let profileRefreshError: string | null = null;
  if (supabase && member && !("error" in member) && canManageProfile) {
    const { data: cachedProfile, error: cachedProfileError } = await supabase
      .from("company_match_profile")
      .select("status")
      .eq("company_id", id)
      .maybeSingle();
    if (cachedProfileError) {
      profileRefreshError = cachedProfileError.message;
    } else if (
      url.searchParams.get("refresh") === "1" ||
      !cachedProfile ||
      cachedProfile.status !== "ready"
    ) {
      try {
        await refreshCompanyDocumentMatchFacts(
          supabase,
          member.tenantId,
          id,
          url.searchParams.get("refresh") === "1",
        );
      } catch (error) {
        profileRefreshError = error instanceof Error ? error.message : String(error);
        console.error("[program-matches:document-facts]", profileRefreshError);
      }
    }
  }

  const dueValues: ProgramDueFilter[] = ["all", "7", "14", "30", "60", "none"];
  const fitValues: ProgramFitFilter[] = ["all", "high", "review", "exclude-low"];
  const eligibilityValues: Array<MatchEligibility | "all"> = ["all", "eligible", "review", "ineligible"];
  const statusValues: ProgramStatusFilter[] = ["active", "saved", "task", "excluded"];
  const sortValues: ProgramSortKey[] = ["recommend", "deadline", "synced"];
  const due = url.searchParams.get("due") as ProgramDueFilter | null;
  const fit = url.searchParams.get("fit") as ProgramFitFilter | null;
  const eligibility = url.searchParams.get("eligibility") as MatchEligibility | "all" | null;
  const status = url.searchParams.get("status") as ProgramStatusFilter | null;
  const sort = url.searchParams.get("sort") as ProgramSortKey | null;
  const requestedProgramId = url.searchParams.get("program");
  const query: CompanyProgramQuery = {
    query: url.searchParams.get("q") ?? "",
    field: url.searchParams.get("field") ?? "all",
    region: url.searchParams.get("region") ?? "all",
    due: due && dueValues.includes(due) ? due : "all",
    fit: fit && fitValues.includes(fit) ? fit : "all",
    eligibility:
      eligibility && eligibilityValues.includes(eligibility) ? eligibility : "all",
    status: status && statusValues.includes(status) ? status : "active",
    sort: sort && sortValues.includes(sort) ? sort : "recommend",
    pinnedProgramId:
      requestedProgramId && UUID_PATTERN.test(requestedProgramId)
        ? requestedProgramId
        : undefined,
    page: Number(url.searchParams.get("page") ?? "1"),
    pageSize: Number(url.searchParams.get("pageSize") ?? "30"),
  };

  const data = await getCompanyProgramMatches(id, query);
  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (supabase && member && !("error" in member) && canManageProfile) {
    const profile = data.profile;
    const { data: profileRow, error: profileError } = await supabase
      .from("company_match_profile")
      .upsert(
        {
          tenant_id: member.tenantId,
          company_id: id,
          status: profileRefreshError ? "failed" : "ready",
          profile_json: profile as unknown as Json,
          completeness: profile.completeness,
          missing_information: profile.missingInformation as unknown as Json,
          source_counts: profile.sourceCounts as unknown as Json,
          source_fingerprint: profile.fingerprint,
          analyzed_at: profile.analyzedAt,
          last_error: profileRefreshError,
        },
        { onConflict: "tenant_id,company_id" },
      )
      .select("id")
      .single();
    if (profileError) console.error("[program-matches:profile]", profileError.message);

    const sourceRows = profile.sources
      // document 행은 facts_text를 함께 쓰는 추출 루틴이 전담한다. 여기서 다시
      // upsert하면 PostgREST의 missing=default 처리로 본문 캐시가 지워질 수 있다.
      .filter((source) => source.kind !== "company" && source.kind !== "document")
      .map((source) => ({
        tenant_id: member.tenantId,
        company_id: id,
        source_kind: source.kind,
        source_id: source.id,
        label: source.label,
        included: source.included,
        extraction_status: "skipped",
        source_updated_at: source.updatedAt,
      }));
    if (sourceRows.length > 0) {
      const { error: sourceError } = await supabase
        .from("company_match_profile_source")
        .upsert(sourceRows, {
          onConflict: "tenant_id,company_id,source_kind,source_id",
        });
      if (sourceError) console.error("[program-matches:sources]", sourceError.message);
    }

    if (profileRow && data.matches.length > 0) {
      const matchedAt = new Date().toISOString();
      const matchRows = data.matches.map((match) => ({
        tenant_id: member.tenantId,
        company_id: id,
        gov_program_id: match.program.id,
        profile_id: profileRow.id,
        eligibility: match.eligibility,
        confidence: match.confidence,
        score: match.score,
        score_breakdown: match.scoreBreakdown as unknown as Json,
        reasons: match.reasons as unknown as Json,
        warnings: match.warnings as unknown as Json,
        evidence: match.evidence as unknown as Json,
        profile_version: profile.fingerprint,
        program_synced_at: match.program.synced_at,
        matched_at: matchedAt,
      }));
      const { error: matchError } = await supabase
        .from("company_program_match")
        .upsert(matchRows, { onConflict: "tenant_id,company_id,gov_program_id" });
      if (matchError) console.error("[program-matches:cache]", matchError.message);
    }
  }

  return NextResponse.json({
    ok: true,
    ...data,
    canManageProfile,
    canManageWorkflow,
    companyStatus: data.profile.company.status,
  });
}

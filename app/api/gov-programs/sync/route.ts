import { NextResponse } from "next/server";
import { enabledSources } from "@/lib/gov-programs/config";
import { GOV_PROGRAM_ADAPTERS } from "@/lib/gov-programs/registry";
import {
  toGovProgramInsert,
  type NormalizedProgram,
  type SourceCode,
} from "@/lib/gov-programs/types";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyBearerSecret } from "@/lib/api/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE_PRIORITY: Record<SourceCode, number> = {
  bizinfo: 0,
  smes: 1,
  msit: 2,
  kstartup: 3,
};

interface SourceResult {
  source: SourceCode;
  fetched: number;
  programs: NormalizedProgram[];
  error: string | null;
}

function timeValue(date: string | null): number {
  if (!date) return 0;
  const value = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function chooseProgram(
  current: NormalizedProgram,
  next: NormalizedProgram,
): NormalizedProgram {
  const priorityDelta =
    SOURCE_PRIORITY[next.source] - SOURCE_PRIORITY[current.source];
  if (priorityDelta < 0) return next;
  if (priorityDelta > 0) return current;
  return timeValue(next.applyEnd) > timeValue(current.applyEnd) ? next : current;
}

function dedupePrograms(programs: NormalizedProgram[]): NormalizedProgram[] {
  const byContent = new Map<string, NormalizedProgram>();
  for (const program of programs) {
    const existing = byContent.get(program.contentKey);
    byContent.set(
      program.contentKey,
      existing ? chooseProgram(existing, program) : program,
    );
  }
  return [...byContent.values()];
}

async function handle(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 미설정" },
      { status: 503 },
    );
  }

  if (!verifyBearerSecret(request, cronSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  const sources = enabledSources();
  if (sources.length === 0) {
    return NextResponse.json({ ok: true, enabledSources: [], fetched: 0, upserted: 0 });
  }

  const results: SourceResult[] = [];
  for (const source of sources) {
    try {
      const programs = await GOV_PROGRAM_ADAPTERS[source].fetch();
      results.push({ source, fetched: programs.length, programs, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[gov-programs/sync:${source}]`, message);
      results.push({ source, fetched: 0, programs: [], error: message });
    }
  }

  const successful = results.filter((result) => result.error === null);
  const deduped = dedupePrograms(successful.flatMap((result) => result.programs));
  const retainedBySource = new Map<SourceCode, number>();
  for (const program of deduped) {
    retainedBySource.set(program.source, (retainedBySource.get(program.source) ?? 0) + 1);
  }

  if (deduped.length > 0) {
    const { error } = await service
      .from("gov_program")
      .upsert(deduped.map(toGovProgramInsert), { onConflict: "source,external_id" });
    if (error) {
      await service.from("gov_program_sync_log").insert(
        successful.map((result) => ({
          source: result.source,
          status: "failed",
          fetched: result.fetched,
          upserted: 0,
          error: error.message,
        })),
      );
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  const logs = results.map((result) => ({
    source: result.source,
    status: result.error ? "failed" : "success",
    fetched: result.fetched,
    upserted: result.error ? 0 : (retainedBySource.get(result.source) ?? 0),
    error: result.error,
  }));
  const { error: logError } = await service.from("gov_program_sync_log").insert(logs);
  if (logError) {
    console.error("[gov-programs/sync:log]", logError.message);
  }

  return NextResponse.json({
    ok: true,
    enabledSources: sources,
    fetched: results.reduce((sum, result) => sum + result.fetched, 0),
    upserted: deduped.length,
    failedSources: results.filter((result) => result.error).map((result) => result.source),
  });
}

export const GET = handle;
export const POST = handle;

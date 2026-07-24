import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDocumentText } from "@/lib/reports/extract";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";
import type { MemberContext } from "@/lib/actions/shared";
import type { AssistantScope, AssistantSource } from "@/lib/assistant/types";
import { ASSISTANT_MAX_DOCUMENTS } from "@/lib/assistant/config";

type Supabase = SupabaseClient<Database>;

export interface AssistantGrounding {
  effectiveScope: AssistantScope;
  contextText: string;
  sources: AssistantSource[];
  companyIds: string[];
}

function deadlineHref(companyId: string | null, source: string): string | null {
  if (!companyId) return null;
  const tab =
    source === "credential"
      ? "cert"
      : source === "ip_deadline"
        ? "ip"
        : source === "task"
          ? "tasks"
          : source === "schedule"
            ? "schedule"
            : null;
  return tab
    ? `/app/companies/${companyId}?tab=${tab}`
    : `/app/companies/${companyId}`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
}

function normalizeScope(scope: AssistantScope, member: MemberContext): AssistantScope {
  if (scope.mode === "team" && (member.role === "owner" || member.role === "manager")) {
    return { mode: "team", consultantId: scope.consultantId ?? null };
  }
  return { mode: "mine" };
}

export async function buildAssistantGrounding(
  supabase: Supabase,
  member: MemberContext,
  input: {
    scope: AssistantScope;
    companyId?: string | null;
    documentIds?: string[];
  },
): Promise<AssistantGrounding> {
  const effectiveScope = normalizeScope(input.scope, member);

  let companiesQuery = supabase
    .from("company")
    .select(
      "id, name, industry, founded_date, revenue, headcount, condition_tags, memo, primary_consultant_id",
    )
    .eq("status", "active")
    .order("name")
    .limit(100);

  if (input.companyId) companiesQuery = companiesQuery.eq("id", input.companyId);
  if (effectiveScope.mode === "mine") {
    companiesQuery = companiesQuery.eq("primary_consultant_id", member.userId);
  } else if (effectiveScope.consultantId === "unassigned") {
    companiesQuery = companiesQuery.is("primary_consultant_id", null);
  } else if (effectiveScope.consultantId) {
    companiesQuery = companiesQuery.eq(
      "primary_consultant_id",
      effectiveScope.consultantId,
    );
  }

  const companiesResult = await companiesQuery;
  if (companiesResult.error) {
    throw new Error(`AI 컨텍스트의 기업 정보를 불러오지 못했습니다: ${companiesResult.error.message}`);
  }
  const companies = companiesResult.data ?? [];
  const companyIds = companies.map((company) => company.id);

  if (input.companyId && companyIds.length === 0) {
    throw new Error("선택한 기업에 접근할 수 없거나 현재 관제 범위에 포함되지 않습니다.");
  }

  const [tasksResult, deadlinesResult, notificationsResult] =
    companyIds.length === 0
      ? [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]
      : await Promise.all([
          supabase
            .from("task")
            .select(
              "id, company_id, title, stage, due_date, assignee_id, memo, updated_at",
            )
            .in("company_id", companyIds)
            .neq("work_status", "completed")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(80),
          supabase
            .from("deadline_item")
            .select(
              "id, company_id, company_name, title, source, status, due_date, days_left, category_name",
            )
            .in("company_id", companyIds)
            .order("due_date", { ascending: true })
            .limit(80),
          supabase
            .from("notification")
            .select("id, company_id, title, body, type, is_urgent, created_at")
            .in("company_id", companyIds)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

  const firstError =
    tasksResult.error ?? deadlinesResult.error ?? notificationsResult.error;
  if (firstError) {
    throw new Error(`AI 컨텍스트의 운영 정보를 불러오지 못했습니다: ${firstError.message}`);
  }

  const sources: AssistantSource[] = [];
  const sourceRows: string[] = [];
  let sourceIndex = 1;
  const addSource = (
    kind: AssistantSource["kind"],
    id: string,
    label: string,
    href: string | null,
    payload: unknown,
  ) => {
    const citationId = `S${sourceIndex}`;
    sourceIndex += 1;
    sources.push({ id: citationId, kind, label, href });
    sourceRows.push(`[${citationId}] ${kind} ${safeJson(payload)}`);
  };

  for (const company of companies) {
    addSource(
      "company",
      company.id,
      company.name,
      `/app/companies/${company.id}`,
      company,
    );
  }
  for (const task of tasksResult.data ?? []) {
    const company = companies.find((item) => item.id === task.company_id);
    addSource(
      "task",
      task.id,
      `${company?.name ?? "기업"} · ${task.title}`,
      `/app/companies/${task.company_id}?tab=tasks`,
      task,
    );
  }
  for (const deadline of deadlinesResult.data ?? []) {
    if (!deadline.id || !deadline.source) continue;
    addSource(
      "deadline",
      deadline.id,
      `${deadline.company_name ?? "기업"} · ${deadline.title}`,
      deadlineHref(deadline.company_id, deadline.source),
      deadline,
    );
  }
  for (const notification of notificationsResult.data ?? []) {
    addSource(
      "notification",
      notification.id,
      notification.title,
      notification.company_id
        ? `/app/companies/${notification.company_id}`
        : "/app/notifications",
      notification,
    );
  }

  const documentIds = Array.from(new Set(input.documentIds ?? [])).slice(
    0,
    ASSISTANT_MAX_DOCUMENTS,
  );
  if (documentIds.length > 0) {
    const documentsResult = await supabase
      .from("document")
      .select("id, company_id, name, file_type, storage_url")
      .in("id", documentIds)
      .in("company_id", companyIds);
    if (documentsResult.error) {
      throw new Error(`선택 문서를 확인하지 못했습니다: ${documentsResult.error.message}`);
    }
    const documents = documentsResult.data ?? [];
    if (documents.length !== documentIds.length) {
      throw new Error("선택 문서 중 접근할 수 없거나 현재 관제 범위 밖인 파일이 있습니다.");
    }

    const extractionClient = createServiceClient() ?? supabase;
    for (const document of documents) {
      const text = await extractDocumentText(extractionClient, document);
      addSource(
        "document",
        document.id,
        document.name,
        `/app/companies/${document.company_id}?tab=files`,
        {
          id: document.id,
          company_id: document.company_id,
          name: document.name,
          content: text,
        },
      );
    }
  }

  return {
    effectiveScope,
    companyIds,
    sources,
    contextText: sourceRows.length
      ? sourceRows.join("\n")
      : "현재 관제 범위에 등록된 운영 데이터가 없습니다.",
  };
}

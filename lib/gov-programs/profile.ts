import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CompanyProfile } from "@/lib/data/company-detail";
import type {
  CompanyMatchProfile,
  MatchProfileMissingItem,
  MatchProfileSource,
  MatchProfileSourceKind,
} from "@/lib/gov-programs/profile-types";
import { normalizeContentText } from "@/lib/gov-programs/types";
import { extractDocumentText } from "@/lib/reports/extract";
import {
  isReportSourceSupported,
  normalizeReportFileType,
} from "@/lib/reports/file-types";

type Supabase = SupabaseClient<Database>;

export type {
  CompanyMatchProfile,
  MatchProfileMissingItem,
  MatchProfileSource,
  MatchProfileSourceKind,
} from "@/lib/gov-programs/profile-types";

interface SourcePreference {
  source_kind: string;
  source_id: string;
  included: boolean;
  facts_text: string | null;
  extraction_status: string;
  extraction_error: string | null;
  source_updated_at: string | null;
}

type SourcePreferenceMap = Map<string, SourcePreference>;

export interface DocumentFactsRefreshResult {
  processed: number;
  ready: number;
  failed: number;
  skipped: number;
}

const STOP_WORDS = new Set([
  "그리고",
  "또는",
  "대한",
  "관련",
  "사업",
  "기업",
  "지원",
  "정부",
  "위한",
  "통한",
  "해당",
  "진행",
  "관리",
  "예정",
  "필요",
  "정보",
  "자료",
  "보고서",
]);

function smallHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function buildKeywords(sources: MatchProfileSource[]): string[] {
  const counts = new Map<string, number>();
  for (const source of sources) {
    if (!source.included) continue;
    const tokens = normalizeContentText(
      `${source.label} ${source.matchText ?? source.detail}`,
    ).split(" ");
    for (const token of tokens) {
      if (token.length < 2 || STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + (source.kind === "company" ? 3 : 1));
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 120)
    .map(([keyword]) => keyword);
}

function profileCompleteness(company: CompanyProfile): {
  score: number;
  missing: MatchProfileMissingItem[];
} {
  const href = `/app/companies/${company.id}`;
  const fields: Array<{
    key: MatchProfileMissingItem["key"];
    label: string;
    description: string;
    weight: number;
    ready: boolean;
  }> = [
    { key: "industry", label: "업종", description: "업종별 지원대상 판별에 필요합니다.", weight: 18, ready: Boolean(company.industry) },
    { key: "businessCondition", label: "업태·종목", description: "세부 산업·제품 적합도를 높일 수 있습니다.", weight: 10, ready: Boolean(company.businessCondition) },
    { key: "region", label: "소재지", description: "지역 제한 공고의 지원 가능 여부를 확인합니다.", weight: 15, ready: Boolean(company.region) },
    { key: "foundedDate", label: "설립일", description: "창업·업력 조건 판별에 필요합니다.", weight: 15, ready: Boolean(company.foundedDate) },
    { key: "revenue", label: "연 매출", description: "기업 규모와 매출 상한 조건을 확인합니다.", weight: 13, ready: company.revenue !== null },
    { key: "headcount", label: "상시 인원", description: "고용·기업 규모 조건을 확인합니다.", weight: 10, ready: company.headcount !== null },
    { key: "conditionTags", label: "관심분야·전략품목", description: "성장 목표와 기술분야 추천 정확도를 높입니다.", weight: 19, ready: company.conditionTags.length > 0 },
  ];

  return {
    score: fields.reduce((score, field) => score + (field.ready ? field.weight : 0), 0),
    missing: fields
      .filter((field) => !field.ready)
      .map(({ key, label, description }) => ({ key, label, description, href })),
  };
}

function preferenceMap(rows: SourcePreference[]): SourcePreferenceMap {
  return new Map(rows.map((row) => [`${row.source_kind}:${row.source_id}`, row]));
}

function includedFor(
  preferences: SourcePreferenceMap,
  kind: MatchProfileSourceKind,
  id: string,
): boolean {
  return preferences.get(`${kind}:${id}`)?.included ?? true;
}

function withMatchText(source: MatchProfileSource, matchText: string): MatchProfileSource {
  Object.defineProperty(source, "matchText", {
    value: matchText,
    enumerable: false,
  });
  return source;
}

function extractionStatus(value: string | undefined): MatchProfileSource["analysisStatus"] {
  if (value === "ready" || value === "failed" || value === "skipped") return value;
  return "pending";
}

function shortExtractionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

/**
 * 등록 문서의 본문을 기업 매칭 근거 캐시에 저장한다.
 * 문서 자체는 immutable에 가까워 created_at이 같으면 기존 추출값을 재사용한다.
 */
export async function refreshCompanyDocumentMatchFacts(
  supabase: Supabase,
  tenantId: string,
  companyId: string,
  force = false,
): Promise<DocumentFactsRefreshResult> {
  const [documentsResult, reportsResult, sourcesResult] = await Promise.all([
    supabase
      .from("document")
      .select("id, name, doc_category, version, file_type, storage_url, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("meeting_report")
      .select("output_document_id, summary_output_document_id")
      .eq("company_id", companyId),
    supabase
      .from("company_match_profile_source")
      .select(
        "source_kind, source_id, included, facts_text, extraction_status, extraction_error, source_updated_at",
      )
      .eq("company_id", companyId)
      .eq("source_kind", "document"),
  ]);
  const firstError = documentsResult.error ?? reportsResult.error ?? sourcesResult.error;
  if (firstError) {
    throw new Error(`등록 문서 분석 대상을 불러오지 못했습니다: ${firstError.message}`);
  }

  const generatedDocumentIds = new Set(
    (reportsResult.data ?? []).flatMap((report) =>
      [report.output_document_id, report.summary_output_document_id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
  const existing = preferenceMap((sourcesResult.data ?? []) as SourcePreference[]);
  const documents = (documentsResult.data ?? []).filter(
    (document) => !generatedDocumentIds.has(document.id),
  );

  const rows: Database["public"]["Tables"]["company_match_profile_source"]["Insert"][] = [];
  let ready = 0;
  let failed = 0;
  let skipped = 0;

  // 큰 PDF가 섞여 있어도 한 파일이 전체 분석을 막지 않도록 작은 묶음으로 처리한다.
  for (let index = 0; index < documents.length; index += 4) {
    const batch = documents.slice(index, index + 4);
    const batchRows = await Promise.all(
      batch.map(async (document) => {
        const cached = existing.get(`document:${document.id}`);
        const included = cached?.included ?? true;
        const base = {
          tenant_id: tenantId,
          company_id: companyId,
          source_kind: "document",
          source_id: document.id,
          label: document.name,
          included,
          source_updated_at: document.created_at,
        };

        if (!included) {
          skipped += 1;
          return {
            ...base,
            facts_text: cached?.facts_text ?? null,
            extraction_status: cached?.extraction_status ?? "skipped",
            extraction_error: cached?.extraction_error ?? null,
          };
        }

        if (!isReportSourceSupported(document.file_type)) {
          skipped += 1;
          return {
            ...base,
            facts_text: null,
            extraction_status: "skipped",
            extraction_error: `${normalizeReportFileType(document.file_type) || "알 수 없는"} 형식은 본문 분석을 지원하지 않습니다.`,
          };
        }

        if (
          !force &&
          cached?.extraction_status === "ready" &&
          cached.source_updated_at === document.created_at &&
          cached.facts_text
        ) {
          ready += 1;
          return {
            ...base,
            facts_text: cached.facts_text,
            extraction_status: "ready",
            extraction_error: null,
          };
        }

        try {
          const factsText = await extractDocumentText(supabase, document);
          ready += 1;
          return {
            ...base,
            facts_text: factsText,
            extraction_status: "ready",
            extraction_error: null,
          };
        } catch (error) {
          failed += 1;
          return {
            ...base,
            facts_text: null,
            extraction_status: "failed",
            extraction_error: shortExtractionError(error),
          };
        }
      }),
    );
    rows.push(...batchRows);
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("company_match_profile_source")
      .upsert(rows, { onConflict: "tenant_id,company_id,source_kind,source_id" });
    if (error) throw new Error(`문서 분석 결과를 저장하지 못했습니다: ${error.message}`);
  }

  return { processed: documents.length, ready, failed, skipped };
}

export async function buildCompanyMatchProfile(
  supabase: Supabase,
  company: CompanyProfile,
): Promise<CompanyMatchProfile> {
  const companyId = company.id;
  const [credentials, ipRights, tasks, reports, documents, sourcePreferences] =
    await Promise.all([
      supabase
        .from("credential")
        .select("id, type, issued_date, expires_date, memo, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ip_right")
        .select("id, kind, title, status, applied_date, registered_date, memo, updated_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("task")
        .select("id, title, stage, work_status, due_date, memo, updated_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("meeting_report")
        .select(
          "id, title, summary, report_json, summary_report_json, status, generated_at, updated_at, output_document_id, summary_output_document_id",
        )
        .eq("company_id", companyId)
        .eq("status", "succeeded")
        .order("updated_at", { ascending: false }),
      supabase
        .from("document")
        .select("id, name, doc_category, version, file_type, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("company_match_profile_source")
        .select(
          "source_kind, source_id, included, facts_text, extraction_status, extraction_error, source_updated_at",
        )
        .eq("company_id", companyId),
    ]);

  const firstError =
    credentials.error ??
    ipRights.error ??
    tasks.error ??
    reports.error ??
    documents.error ??
    sourcePreferences.error;
  if (firstError) {
    throw new Error(`매칭 프로필을 구성하지 못했습니다: ${firstError.message}`);
  }

  const preferences = preferenceMap(sourcePreferences.data ?? []);
  const generatedDocumentIds = new Set(
    (reports.data ?? []).flatMap((report) =>
      [report.output_document_id, report.summary_output_document_id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
  const sources: MatchProfileSource[] = [
    {
      kind: "company",
      id: company.id,
      label: `${company.name} 기본정보`,
      detail: [
        company.industry,
        company.businessCondition,
        company.region,
        company.foundedDate,
        company.revenue !== null ? `매출 ${company.revenue}원` : null,
        company.headcount !== null ? `인원 ${company.headcount}명` : null,
        ...company.conditionTags,
        company.memo,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/app/companies/${company.id}`,
      included: true,
      updatedAt: null,
    },
    ...(credentials.data ?? []).map((item): MatchProfileSource => ({
      kind: "credential",
      id: item.id,
      label: item.type,
      detail: [item.memo, item.issued_date ? `취득 ${item.issued_date}` : null, item.expires_date ? `만료 ${item.expires_date}` : null]
        .filter(Boolean)
        .join(" · "),
      href: `/app/companies/${company.id}?tab=cert`,
      included: includedFor(preferences, "credential", item.id),
      updatedAt: item.created_at,
    })),
    ...(ipRights.data ?? []).map((item): MatchProfileSource => ({
      kind: "ip_right",
      id: item.id,
      label: item.title,
      detail: [item.kind, item.status, item.memo].filter(Boolean).join(" · "),
      href: `/app/companies/${company.id}?tab=ip`,
      included: includedFor(preferences, "ip_right", item.id),
      updatedAt: item.updated_at,
    })),
    ...(tasks.data ?? []).map((item): MatchProfileSource => ({
      kind: "task",
      id: item.id,
      label: item.title,
      detail: [item.stage, item.work_status, item.memo].filter(Boolean).join(" · "),
      href: `/app/companies/${company.id}?tab=tasks`,
      included: includedFor(preferences, "task", item.id),
      updatedAt: item.updated_at,
    })),
    ...(reports.data ?? []).map((item): MatchProfileSource =>
      withMatchText(
        {
          kind: "meeting_report",
          id: item.id,
          label: item.title,
          detail: item.summary ?? "미팅 보고서",
          href: `/app/companies/${company.id}`,
          included: includedFor(preferences, "meeting_report", item.id),
          updatedAt: item.updated_at,
        },
        [
          item.summary,
          item.report_json ? JSON.stringify(item.report_json) : null,
          item.summary_report_json ? JSON.stringify(item.summary_report_json) : null,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 80_000),
      ),
    ),
    ...(documents.data ?? [])
      .filter((item) => !generatedDocumentIds.has(item.id))
      .map((item): MatchProfileSource => {
        const preference = preferences.get(`document:${item.id}`);
        const status = extractionStatus(preference?.extraction_status);
        const metadata = [item.doc_category, item.file_type, `버전 ${item.version}`]
          .filter(Boolean)
          .join(" · ");
        const statusLabel =
          status === "ready"
            ? "본문 분석 완료"
            : status === "failed"
              ? "본문 분석 실패"
              : status === "skipped"
                ? "파일명·분류만 반영"
                : "본문 분석 대기";
        return withMatchText(
          {
            kind: "document",
            id: item.id,
            label: item.name,
            detail: [metadata, statusLabel].filter(Boolean).join(" · "),
            href: `/app/companies/${company.id}?tab=files`,
            included: includedFor(preferences, "document", item.id),
            updatedAt: item.created_at,
            analysisStatus: status,
          },
          [metadata, preference?.facts_text].filter(Boolean).join(" "),
        );
      }),
  ];

  const counts: Record<MatchProfileSourceKind, number> = {
    company: 1,
    credential: 0,
    ip_right: 0,
    task: 0,
    meeting_report: 0,
    document: 0,
  };
  for (const source of sources) {
    if (source.included) counts[source.kind] += source.kind === "company" ? 0 : 1;
  }

  const completeness = profileCompleteness(company);
  const fingerprint = smallHash(
    JSON.stringify(
      sources.map((source) => [
        source.kind,
        source.id,
        source.included,
        source.updatedAt,
        source.detail,
        source.matchText ? smallHash(source.matchText) : null,
      ]),
    ),
  );

  return {
    company,
    completeness: completeness.score,
    missingInformation: completeness.missing,
    sourceCounts: counts,
    sources,
    keywords: buildKeywords(sources),
    fingerprint,
    analyzedAt: new Date().toISOString(),
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  requirePermission,
  type ActionResult,
} from "@/lib/actions/shared";
import {
  aiCompanyToDraftRow,
  aiImportEnabled,
  AiParseError,
  parseSheetsWithGemini,
} from "@/lib/import/ai-parse";
import {
  bizNoDigits,
  normalizeCompanyName,
  validateDraftRows,
} from "@/lib/import/validate";
import type {
  DraftCompanyRow,
  ImportCategoryOption,
  ImportExistingCompany,
  ImportRowResult,
} from "@/lib/import/types";
import { IMPORT_MAX_ROWS } from "@/lib/import/types";
import type { Supabase } from "@/lib/actions/shared";

/** AI 시트 텍스트 서버측 상한 (클라이언트 200KB 제한의 재검증) */
const AI_SHEETS_MAX_BYTES = 250_000;

async function loadCategories(
  supabase: Supabase,
): Promise<{ categories: ImportCategoryOption[] } | { error: string }> {
  const categoryRes = await supabase.from("category").select("id, name");
  if (categoryRes.error) {
    console.error("[import:loadValidateContext:category]", categoryRes.error.message);
    return { error: `분류 조회에 실패했습니다: ${categoryRes.error.message}` };
  }
  return { categories: categoryRes.data ?? [] };
}

async function loadExistingCandidates(
  supabase: Supabase,
  rows: DraftCompanyRow[],
): Promise<{ existing: ImportExistingCompany[] } | { error: string }> {
  const normalizedNames = [
    ...new Set(rows.map((row) => normalizeCompanyName(row.name)).filter(Boolean)),
  ];
  const businessNumbers = [
    ...new Set(
      rows
        .map((row) => bizNoDigits(row.bizNo))
        .filter((digits) => digits.length === 10),
    ),
  ];
  if (normalizedNames.length === 0 && businessNumbers.length === 0) {
    return { existing: [] };
  }

  const companyRes = await supabase.rpc(
    "get_company_import_duplicate_candidates",
    {
      p_normalized_names: normalizedNames,
      p_biz_no_digits: businessNumbers,
    },
  );
  if (companyRes.error) {
    console.error("[import:loadValidateContext:company]", companyRes.error.message);
    return { error: `기존 기업 조회에 실패했습니다: ${companyRes.error.message}` };
  }
  return {
    existing: (companyRes.data ?? []).map((company) => ({
      name: company.name,
      bizNo: company.biz_no,
    })),
  };
}

async function loadValidateContext(
  supabase: Supabase,
  rows: DraftCompanyRow[],
): Promise<
  | { existing: ImportExistingCompany[]; categories: ImportCategoryOption[] }
  | { error: string }
> {
  const [categories, companies] = await Promise.all([
    loadCategories(supabase),
    loadExistingCandidates(supabase, rows),
  ]);
  if ("error" in categories) return categories;
  if ("error" in companies) return companies;
  return { categories: categories.categories, existing: companies.existing };
}

export type ParseImportResult = ActionResult & { rows?: DraftCompanyRow[] };

/** AI 파싱 — 클라이언트가 추출한 시트별 CSV 텍스트를 Gemini로 구조화한다 */
export async function parseImportSheetsWithAI(input: {
  sheets: { name: string; csv: string }[];
}): Promise<ParseImportResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (!aiImportEnabled()) {
    return { ok: false, error: "AI 가져오기가 설정되지 않았습니다(GEMINI_API_KEY). 관리자에게 문의해 주세요." };
  }

  const sheets = (input.sheets ?? [])
    .map((s) => ({ name: String(s.name ?? "").slice(0, 100), csv: String(s.csv ?? "") }))
    .filter((s) => s.csv.trim() !== "");
  if (sheets.length === 0) {
    return { ok: false, error: "읽을 수 있는 시트가 없습니다." };
  }
  const totalBytes = sheets.reduce(
    (sum, s) => sum + Buffer.byteLength(s.csv, "utf8"),
    0,
  );
  if (totalBytes > AI_SHEETS_MAX_BYTES) {
    return { ok: false, error: "파일이 너무 큽니다. 나눠서 업로드해 주세요." };
  }

  const categoryContext = await loadCategories(supabase);
  if ("error" in categoryContext) {
    return { ok: false, error: categoryContext.error };
  }

  try {
    const companies = await parseSheetsWithGemini(
      sheets,
      categoryContext.categories.map((c) => c.name),
    );
    if (companies.length === 0) {
      return { ok: false, error: "파일에서 기업 정보를 찾지 못했습니다. 파일 내용을 확인해 주세요." };
    }
    const draftRows = companies.map((company, index) =>
      aiCompanyToDraftRow(company, index),
    );
    const companyContext = await loadExistingCandidates(supabase, draftRows);
    if ("error" in companyContext) {
      return { ok: false, error: companyContext.error };
    }
    const rows = validateDraftRows(draftRows, {
      categories: categoryContext.categories,
      existing: companyContext.existing,
    });
    return { ok: true, error: null, rows };
  } catch (error) {
    if (error instanceof AiParseError) {
      return { ok: false, error: error.message };
    }
    console.error("[parseImportSheetsWithAI]", error);
    return { ok: false, error: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export type BulkImportResult = ActionResult & {
  results: ImportRowResult[];
  created: number;
  failed: number;
};

/** 검증된 초안 행들을 단일 RPC로 등록 — 행별 부분 실패 리포트 */
export async function bulkImportCompanies(payload: {
  rows: DraftCompanyRow[];
}): Promise<BulkImportResult> {
  const empty = { results: [], created: 0, failed: 0 };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR, ...empty };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error, ...empty };

  const inputRows = payload.rows ?? [];
  if (inputRows.length === 0) {
    return { ok: false, error: "등록할 기업이 없습니다.", ...empty };
  }
  if (inputRows.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `한 번에 최대 ${IMPORT_MAX_ROWS}개까지 등록할 수 있습니다. 나눠서 등록해 주세요.`,
      ...empty,
    };
  }

  const ctx = await loadValidateContext(supabase, inputRows);
  if ("error" in ctx) return { ok: false, error: ctx.error, ...empty };

  // 서버 액션은 공개 엔드포인트 — 클라이언트 검증을 신뢰하지 않고 재검증한다
  // (categoryId도 서버 기준으로 재해석되고, 파일 내 중복·DB 중복도 다시 잡힌다)
  const rows = validateDraftRows(inputRows, ctx);

  const results: Array<ImportRowResult | undefined> = new Array(rows.length);
  const registrable: Array<{ sourceIndex: number; row: DraftCompanyRow }> = [];

  rows.forEach((row, sourceIndex) => {
    const base = { rowId: row.rowId, name: row.name || row.sourceRef };

    if (row.errors.length > 0) {
      results[sourceIndex] = { ...base, ok: false, error: row.errors.join(" ") };
      return;
    }
    if (row.duplicateName && !row.confirmDuplicate) {
      results[sourceIndex] = {
        ...base,
        ok: false,
        error: `이미 등록된 기업과 겹칩니다: ${row.duplicateName}. 중복이 아니라면 미리보기에서 "중복 아님"을 체크해 주세요.`,
      };
      return;
    }

    registrable.push({ sourceIndex, row });
  });

  if (registrable.length > 0) {
    const rpcRows = registrable.map(({ row }) => ({
      row_id: row.rowId,
      name: row.name,
      biz_no: row.bizNo,
      industry: row.industry,
      business_condition: row.businessCondition,
      region: row.region,
      founded_date: row.foundedDate,
      revenue:
        row.revenueEok === null ? null : Math.round(row.revenueEok * 100_000_000),
      headcount: row.headcount,
      ceo_name: row.ceoName,
      contact_name: row.contactName,
      contact_phone: row.contactPhone,
      contact_email: row.contactEmail,
      condition_tags: row.conditionTags,
      memo: row.memo,
      credentials: row.credentials.map((credential) => ({
        type: credential.type,
        category_id: credential.categoryId,
        issued_date: credential.issuedDate,
        expires_date: credential.expiresDate,
        memo: credential.memo,
      })),
    }));

    const { data, error } = await supabase.rpc("bulk_import_companies", {
      p_rows: rpcRows,
    });

    if (error) {
      console.error("[bulkImportCompanies:rpc]", error.code, error.message);
      return {
        ok: false,
        error: `기업 일괄 등록에 실패했습니다: ${error.message}`,
        ...empty,
      };
    }

    const rpcResultsByIndex = new Map(
      (data ?? []).map((result) => [result.row_index, result]),
    );
    for (let rpcIndex = 0; rpcIndex < registrable.length; rpcIndex += 1) {
      const { sourceIndex, row } = registrable[rpcIndex];
      const rpcResult = rpcResultsByIndex.get(rpcIndex + 1);
      const base = { rowId: row.rowId, name: row.name || row.sourceRef };

      if (!rpcResult || rpcResult.row_id !== row.rowId) {
        console.error("[bulkImportCompanies:rpc] missing result", rpcIndex + 1, row.rowId);
        results[sourceIndex] = {
          ...base,
          ok: false,
          error: "저장 결과를 확인하지 못했습니다. 관리자에게 문의해 주세요.",
        };
        continue;
      }

      if (!rpcResult.ok) {
        console.error("[bulkImportCompanies:company]", rpcResult.error);
        results[sourceIndex] = {
          ...base,
          ok: false,
          error: rpcResult.error ?? "저장에 실패했습니다.",
        };
        continue;
      }

      if (rpcResult.warning) {
        console.error("[bulkImportCompanies:credential]", rpcResult.warning);
      }
      results[sourceIndex] = {
        ...base,
        ok: true,
        companyId: rpcResult.company_id ?? undefined,
        warning: rpcResult.warning ?? undefined,
      };
    }
  }

  const completedResults = results.filter(
    (result): result is ImportRowResult => result !== undefined,
  );
  const created = completedResults.filter((result) => result.ok).length;
  const failed = completedResults.length - created;

  if (created > 0) {
    revalidatePath("/app/companies");
    revalidatePath("/app");
  }

  return { ok: true, error: null, results: completedResults, created, failed };
}

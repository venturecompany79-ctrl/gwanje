"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  getTenantContext,
  optionalText,
  parseEokToWon,
  parseNonNegativeInt,
  requirePermission,
  type ActionResult,
} from "@/lib/actions/shared";
import {
  COMPANY_DOCUMENTS_BUCKET,
  COMPANY_DOCUMENTS_MAX_BYTES,
  getFileExtension,
  storageUrlFromPath,
} from "@/lib/storage";
import {
  enqueueSyncJob,
  getActiveConnection,
} from "@/lib/google-drive/connections";
import { triggerDriveSyncAfterResponse } from "@/lib/google-drive/trigger";

export type AddCompanyResult = ActionResult & {
  companyId?: string;
  warning?: string;
  /** 상호·사업자번호 중복 의심 — 사용자 확인 후 confirm_duplicate=1로 재제출 (GWJ-016) */
  duplicate?: boolean;
};

/** 공백·대소문자 무시 정규화 (상호 유사중복 비교용) */
function normalizeName(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

// 성장 단계 표기 통일 (GWJ-010) — 변형/오타 라벨을 표준값으로 매핑
const GROWTH_STAGE_CANON: Record<string, string> = {
  얼라스테이징: "초기",
  창업기: "초기",
  초창기: "초기",
  초기단계: "초기",
  성장단계: "성장기",
  성숙단계: "성숙기",
  성숙: "성숙기",
};

function normalizeGrowthStageTag(tag: string): string {
  return GROWTH_STAGE_CANON[tag] ?? tag;
}

function optionalList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function appendLine(lines: string[], label: string, value: string | null) {
  if (value) lines.push(`- ${label}: ${value}`);
}

function getBusinessLicenseFile(formData: FormData): File | null {
  const file = formData.get("business_license");
  if (!(file instanceof File) || file.size <= 0) return null;
  return file;
}

async function saveBusinessLicenseDocument({
  supabase,
  tenantId,
  userId,
  companyId,
  file,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
  tenantId: string;
  userId: string;
  companyId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const extension = getFileExtension(file.name);
  const objectName = `${randomUUID()}${extension ? `.${extension}` : ""}`;
  const path = `${tenantId}/${companyId}/${objectName}`;
  const name = file.name.trim() || "사업자등록증";

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) {
    console.error("[addCompany:businessLicenseUpload]", uploadError.message);
    return { ok: false, error: uploadError.message };
  }

  const { data: inserted, error: documentError } = await supabase
    .from("document")
    .insert({
      tenant_id: tenantId,
      company_id: companyId,
      name,
      doc_category: "기본서류",
      version: 1,
      uploaded_by: "consultant",
      storage_url: storageUrlFromPath(path),
      file_type: (extension ?? file.type) || "file",
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (documentError) {
    console.error(
      "[addCompany:businessLicenseDocument]",
      documentError.code,
      documentError.message,
    );
    return { ok: false, error: documentError.message };
  }

  // Drive 연결 시 동기화 잡 적재(보조 — 실패해도 자료 저장에는 영향 없음)
  const connection = await getActiveConnection(supabase, userId);
  if (connection) {
    const enqueued = await enqueueSyncJob(supabase, {
      tenantId,
      userId,
      documentId: inserted.id,
      storageBucket: COMPANY_DOCUMENTS_BUCKET,
      storagePath: path,
      fileName: name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    });
    // 즉시 트리거(B안) — 응답 후 백그라운드 동기화
    if (enqueued) triggerDriveSyncAfterResponse();
  }

  return { ok: true };
}

export async function addCompany(formData: FormData): Promise<AddCompanyResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "기업명을 입력해 주세요." };

  const revenue = parseEokToWon(formData, "revenue");
  if (!revenue.ok) return { ok: false, error: revenue.error };

  const headcount = parseNonNegativeInt(formData, "headcount", "인원");
  if (!headcount.ok) return { ok: false, error: headcount.error };

  const businessLicenseFile = getBusinessLicenseFile(formData);
  if (businessLicenseFile && businessLicenseFile.size > COMPANY_DOCUMENTS_MAX_BYTES) {
    return { ok: false, error: "사업자등록증 파일은 50MB 이하만 업로드할 수 있습니다." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  // 상호·사업자번호 중복 검사 — 사용자가 확인(재제출)하면 건너뛴다 (GWJ-016)
  const bizNoDigits = (optionalText(formData, "biz_no") ?? "").replace(/\D/g, "");
  const confirmDuplicate = String(formData.get("confirm_duplicate") ?? "") === "1";
  if (!confirmDuplicate) {
    const { data: existing } = await supabase
      .from("company")
      .select("name, biz_no");
    const normName = normalizeName(name);
    const matches = (existing ?? []).filter((c) => {
      const cDigits = (c.biz_no ?? "").replace(/\D/g, "");
      if (bizNoDigits && cDigits && cDigits === bizNoDigits) return true;
      return normalizeName(c.name) === normName;
    });
    if (matches.length > 0) {
      const names = [...new Set(matches.map((m) => m.name))].join(", ");
      return {
        ok: false,
        error: `이미 등록된 기업과 상호·사업자번호가 겹칩니다: ${names}. 중복이 아니라면 한 번 더 눌러 그대로 등록할 수 있습니다.`,
        duplicate: true,
      };
    }
  }

  // 성장 단계는 표준 select 값으로 받고, 자유 태그와 합쳐 condition_tags에 저장 (GWJ-010)
  const growthStage = optionalText(formData, "growth_stage");
  const freeTags = (optionalText(formData, "condition_tags") ?? "")
    .split(",")
    .map((tag) => normalizeGrowthStageTag(tag.trim()))
    .filter(Boolean);
  const conditionTags = [...new Set([growthStage, ...freeTags].filter(Boolean))] as string[];

  const matchingProfileLines: string[] = [];
  appendLine(
    matchingProfileLines,
    "전략품목 및 기술",
    optionalList(formData, "technologies").join(", "),
  );
  appendLine(
    matchingProfileLines,
    "추가 기술",
    optionalText(formData, "technology_keywords"),
  );
  // 기업인증정보는 아래에서 credential(자격·인증) 레코드로 생성하므로 메모에는 중복 기재하지 않음
  appendLine(
    matchingProfileLines,
    "관심사업분야",
    optionalList(formData, "interest_areas").join(", "),
  );
  appendLine(
    matchingProfileLines,
    "추가 관심분야",
    optionalText(formData, "interest_keywords"),
  );
  appendLine(
    matchingProfileLines,
    "사업자등록증",
    optionalText(formData, "business_license_status"),
  );

  const memo = optionalText(formData, "memo");
  const matchingMemo =
    matchingProfileLines.length > 0
      ? `지원사업 매칭 입력 정보\n${matchingProfileLines.join("\n")}`
      : null;
  const combinedMemo = [memo, matchingMemo].filter(Boolean).join("\n\n") || null;

  const { data, error } = await supabase
    .from("company")
    .insert({
      tenant_id: ctx.tenantId,
      name,
      biz_no: optionalText(formData, "biz_no"),
      industry: optionalText(formData, "industry"),
      business_condition: optionalText(formData, "business_condition"),
      region: optionalText(formData, "region"),
      founded_date: optionalText(formData, "founded_date"),
      revenue: revenue.value,
      headcount: headcount.value,
      ceo_name: optionalText(formData, "ceo_name"),
      contact_name: optionalText(formData, "contact_name"),
      contact_phone: optionalText(formData, "contact_phone"),
      contact_email: optionalText(formData, "contact_email"),
      condition_tags: conditionTags,
      memo: combinedMemo,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[addCompany]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  const warnings: string[] = [];

  // 선택한 기업인증정보 → 자격·인증(credential) 레코드 생성 (만료일은 미입력 상태)
  const certifications = optionalList(formData, "certifications");
  if (certifications.length > 0) {
    const { error: certError } = await supabase.from("credential").insert(
      certifications.map((type) => ({
        tenant_id: ctx.tenantId,
        company_id: data.id,
        type,
      })),
    );
    if (certError) {
      console.error("[addCompany:certifications]", certError.code, certError.message);
      warnings.push(
        `기업 정보는 저장됐지만 기업인증정보 자격 생성에 실패했습니다: ${certError.message}`,
      );
    }
  }

  if (businessLicenseFile) {
    const saved = await saveBusinessLicenseDocument({
      supabase,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      companyId: data.id,
      file: businessLicenseFile,
    });
    if (!saved.ok) {
      warnings.push(
        `기업 정보는 저장됐지만 사업자등록증 파일 저장에 실패했습니다: ${saved.error}`,
      );
    }
  }

  const warning = warnings.length > 0 ? warnings.join("\n") : undefined;

  revalidatePath("/app/companies");
  revalidatePath(`/app/companies/${data.id}`);
  revalidatePath("/app");
  return { ok: true, error: null, companyId: data.id, warning };
}

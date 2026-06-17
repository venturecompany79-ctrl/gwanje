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
  type ActionResult,
} from "@/lib/actions/shared";
import {
  COMPANY_DOCUMENTS_BUCKET,
  COMPANY_DOCUMENTS_MAX_BYTES,
  getFileExtension,
  storageUrlFromPath,
} from "@/lib/storage";

export type AddCompanyResult = ActionResult & {
  companyId?: string;
  warning?: string;
};

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
  companyId,
  file,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
  tenantId: string;
  companyId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const extension = getFileExtension(file.name);
  const objectName = `${randomUUID()}${extension ? `.${extension}` : ""}`;
  const path = `${tenantId}/${companyId}/${objectName}`;

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

  const { error: documentError } = await supabase.from("document").insert({
    tenant_id: tenantId,
    company_id: companyId,
    name: file.name.trim() || "사업자등록증",
    doc_category: "기본서류",
    version: 1,
    uploaded_by: "consultant",
    storage_url: storageUrlFromPath(path),
    file_type: (extension ?? file.type) || "file",
    size_bytes: file.size,
  });
  if (documentError) {
    console.error(
      "[addCompany:businessLicenseDocument]",
      documentError.code,
      documentError.message,
    );
    return { ok: false, error: documentError.message };
  }

  return { ok: true };
}

export async function addCompany(formData: FormData): Promise<AddCompanyResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

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

  const conditionTags = (optionalText(formData, "condition_tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const matchingProfileLines: string[] = [];
  appendLine(matchingProfileLines, "업종 경로", optionalText(formData, "industry_path"));
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
  appendLine(
    matchingProfileLines,
    "기업인증정보",
    optionalList(formData, "certifications").join(", "),
  );
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

  let warning: string | undefined;
  if (businessLicenseFile) {
    const saved = await saveBusinessLicenseDocument({
      supabase,
      tenantId: ctx.tenantId,
      companyId: data.id,
      file: businessLicenseFile,
    });
    if (!saved.ok) {
      warning = `기업 정보는 저장됐지만 사업자등록증 파일 저장에 실패했습니다: ${saved.error}`;
    }
  }

  revalidatePath("/app/companies");
  revalidatePath(`/app/companies/${data.id}`);
  revalidatePath("/app");
  return { ok: true, error: null, companyId: data.id, warning };
}

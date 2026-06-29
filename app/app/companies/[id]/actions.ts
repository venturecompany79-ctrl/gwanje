"use server";

// 기업 상세 전용 서버 액션 — 자격·기업 정보.
// 과제(관리포인트) 액션은 보드와 공용이라 lib/actions/tasks.ts에 있다.
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
  parseCompanyDocumentStorageUrl,
  storageUrlFromPath,
} from "@/lib/storage";
import {
  enqueueSyncJob,
  getActiveConnection,
} from "@/lib/google-drive/connections";
import { triggerDriveSyncAfterResponse } from "@/lib/google-drive/trigger";

function revalidateCompany(companyId: string) {
  revalidatePath(`/app/companies/${companyId}`);
  revalidatePath("/app/companies");
  revalidatePath("/app");
}

async function assertCompanyAccess(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  companyId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("company")
    .select("id")
    .eq("id", companyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[assertCompanyAccess]", error.code, error.message);
    return { ok: false, error: `기업 확인에 실패했습니다: ${error.message}` };
  }
  if (!data) return { ok: false, error: "기업을 찾을 수 없습니다." };
  return { ok: true };
}

export async function prepareDocumentUpload(
  companyId: string,
  file: { name: string; size: number },
): Promise<ActionResult & { bucket?: string; path?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return access;

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "업로드할 파일을 선택해 주세요." };
  }
  if (size > COMPANY_DOCUMENTS_MAX_BYTES) {
    return { ok: false, error: "파일은 50MB 이하만 업로드할 수 있습니다." };
  }

  const extension = getFileExtension(file.name);
  const objectName = `${randomUUID()}${extension ? `.${extension}` : ""}`;

  const path = `${ctx.tenantId}/${companyId}/${objectName}`;
  return { ok: true, error: null, bucket: COMPANY_DOCUMENTS_BUCKET, path };
}

export async function registerUploadedDocument(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return access;

  const name = String(formData.get("name") ?? "").trim();
  const path = String(formData.get("path") ?? "").trim();
  const sizeText = String(formData.get("size_bytes") ?? "").trim();
  const sizeBytes = sizeText === "" ? null : Number(sizeText);
  if (!name) return { ok: false, error: "자료명을 입력해 주세요." };
  if (!path.startsWith(`${ctx.tenantId}/${companyId}/`)) {
    return { ok: false, error: "업로드 경로가 올바르지 않습니다." };
  }
  if (sizeBytes !== null && (!Number.isFinite(sizeBytes) || sizeBytes < 0)) {
    return { ok: false, error: "파일 크기 정보가 올바르지 않습니다." };
  }

  const { data: latest, error: latestError } = await supabase
    .from("document")
    .select("version")
    .eq("company_id", companyId)
    .eq("name", name)
    .order("version", { ascending: false })
    .limit(1);
  if (latestError) {
    console.error("[registerUploadedDocument:latest]", latestError.code, latestError.message);
    return { ok: false, error: `버전 확인에 실패했습니다: ${latestError.message}` };
  }

  const version = (latest?.[0]?.version ?? 0) + 1;
  const fileType =
    optionalText(formData, "file_type") ?? getFileExtension(name) ?? "file";

  const { data: inserted, error } = await supabase
    .from("document")
    .insert({
      tenant_id: ctx.tenantId,
      company_id: companyId,
      name,
      doc_category: optionalText(formData, "doc_category"),
      version,
      uploaded_by: "consultant",
      storage_url: storageUrlFromPath(path),
      file_type: fileType,
      size_bytes: sizeBytes,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[registerUploadedDocument]", error.code, error.message);
    return { ok: false, error: `자료 저장에 실패했습니다: ${error.message}` };
  }

  // Supabase 저장 성공이 1차 완료 — 이 사용자가 Drive를 연결했다면 동기화 잡을 적재한다.
  // 적재 실패는 자료 저장 결과에 영향을 주지 않는다(보조 기능).
  const connection = await getActiveConnection(supabase, ctx.userId);
  if (connection) {
    const enqueued = await enqueueSyncJob(supabase, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      documentId: inserted.id,
      storageBucket: COMPANY_DOCUMENTS_BUCKET,
      storagePath: path,
      fileName: name,
      mimeType: optionalText(formData, "mime_type"),
      sizeBytes,
    });
    // 즉시 트리거(B안) — 응답 후 백그라운드로 동기화 1회 실행해 체감 지연을 없앤다.
    if (enqueued) triggerDriveSyncAfterResponse();
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

export async function createDocumentDownloadUrl(
  documentId: string,
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.read");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: document, error } = await supabase
    .from("document")
    .select("storage_url")
    .eq("id", documentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (error) {
    console.error("[createDocumentDownloadUrl:document]", error.code, error.message);
    return { ok: false, error: `자료 확인에 실패했습니다: ${error.message}` };
  }
  if (!document) return { ok: false, error: "자료를 찾을 수 없습니다." };

  const storage = parseCompanyDocumentStorageUrl(document.storage_url);
  if (!storage) return { ok: false, error: "다운로드할 파일 경로가 없습니다." };

  const { data, error: signedError } = await supabase.storage
    .from(storage.bucket)
    .createSignedUrl(storage.path, 60 * 5);
  if (signedError) {
    console.error("[createDocumentDownloadUrl:signed]", signedError.message);
    return { ok: false, error: `다운로드 링크 생성에 실패했습니다: ${signedError.message}` };
  }

  return { ok: true, error: null, url: data.signedUrl };
}

export async function addCredential(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const type = String(formData.get("type") ?? "").trim();
  if (!type) return { ok: false, error: "자격종류를 입력해 주세요." };

  const leadText = optionalText(formData, "renew_lead_days");
  const renewLeadDays = leadText === null ? 60 : Number.parseInt(leadText, 10);
  if (!Number.isFinite(renewLeadDays) || renewLeadDays < 0) {
    return { ok: false, error: "갱신 준비 기간은 0 이상의 숫자(일)로 입력해 주세요." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase.from("credential").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    type,
    category_id: optionalText(formData, "category_id"),
    issued_date: optionalText(formData, "issued_date"),
    expires_date: optionalText(formData, "expires_date"),
    renew_lead_days: renewLeadDays,
    memo: optionalText(formData, "memo"),
  });
  if (error) {
    console.error("[addCredential]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

/** 기존 자격 수정 — 나중에 만료일·발급일 등을 채워 넣을 때 사용 (자격·인증 탭 액션) */
export async function updateCredential(
  companyId: string,
  credentialId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const type = String(formData.get("type") ?? "").trim();
  if (!type) return { ok: false, error: "자격종류를 입력해 주세요." };

  const leadText = optionalText(formData, "renew_lead_days");
  const renewLeadDays = leadText === null ? 60 : Number.parseInt(leadText, 10);
  if (!Number.isFinite(renewLeadDays) || renewLeadDays < 0) {
    return { ok: false, error: "갱신 준비 기간은 0 이상의 숫자(일)로 입력해 주세요." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase
    .from("credential")
    .update({
      type,
      category_id: optionalText(formData, "category_id"),
      issued_date: optionalText(formData, "issued_date"),
      expires_date: optionalText(formData, "expires_date"),
      renew_lead_days: renewLeadDays,
      memo: optionalText(formData, "memo"),
    })
    .eq("id", credentialId)
    .eq("company_id", companyId);
  if (error) {
    console.error("[updateCredential]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

/** 자격 삭제 — 잘못 등록한 자격 제거 (연결된 갱신 과제의 출처는 on delete set null로 끊김) */
export async function deleteCredential(
  companyId: string,
  credentialId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!credentialId) return { ok: false, error: "자격을 찾을 수 없습니다." };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const { error } = await supabase
    .from("credential")
    .delete()
    .eq("id", credentialId)
    .eq("company_id", companyId);
  if (error) {
    console.error("[deleteCredential]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

/** 임박 자격 → 갱신 과제 자동 생성 (자격·인증 탭 액션) */
export async function createRenewalTask(
  companyId: string,
  credentialId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: credential, error: credentialError } = await supabase
    .from("credential")
    .select("type, category_id, expires_date")
    .eq("id", credentialId)
    .maybeSingle();
  if (credentialError || !credential) {
    return { ok: false, error: "자격 정보를 찾을 수 없습니다." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("task")
    .select("id")
    .eq("source_credential_id", credentialId)
    .limit(1);
  if (existingError) {
    console.error("[createRenewalTask:check]", existingError.code, existingError.message);
    return { ok: false, error: `확인에 실패했습니다: ${existingError.message}` };
  }
  if (existing && existing.length > 0) {
    return { ok: false, error: "이미 이 자격의 갱신 과제가 있습니다." };
  }

  const { error } = await supabase.from("task").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    title: `${credential.type} 갱신`,
    category_id: credential.category_id,
    stage: "diagnosis",
    due_date: credential.expires_date,
    assignee_id: ctx.userId,
    source_credential_id: credentialId,
  });
  if (error) {
    // task_source_credential_unique 위반(동시요청 경합)도 여기로 — 친절한 메시지로 변환
    if (error.code === "23505") {
      return { ok: false, error: "이미 이 자격의 갱신 과제가 있습니다." };
    }
    console.error("[createRenewalTask:insert]", error.code, error.message);
    return { ok: false, error: `생성에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  revalidatePath("/app/board");
  return { ok: true, error: null };
}

const SCHEDULE_TYPES = ["expiry", "deadline", "meeting", "renewal", "etc"] as const;
type ScheduleTypeValue = (typeof SCHEDULE_TYPES)[number];

function isScheduleType(value: string): value is ScheduleTypeValue {
  return (SCHEDULE_TYPES as readonly string[]).includes(value);
}

/** 일정 추가 (일정 탭 — GWJ-021) */
export async function addSchedule(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "일정명을 입력해 주세요." };

  const date = optionalText(formData, "date");
  if (!date) return { ok: false, error: "날짜를 선택해 주세요." };

  const typeRaw = String(formData.get("type") ?? "etc");
  const type: ScheduleTypeValue = isScheduleType(typeRaw) ? typeRaw : "etc";

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await supabase.from("schedule").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    title,
    date,
    type,
    memo: optionalText(formData, "memo"),
  });
  if (error) {
    console.error("[addSchedule]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

export async function updateCompany(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
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

  const conditionTags = (optionalText(formData, "condition_tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("company")
    .update({
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
      memo: optionalText(formData, "memo"),
    })
    .eq("id", companyId);
  if (error) {
    console.error("[updateCompany]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

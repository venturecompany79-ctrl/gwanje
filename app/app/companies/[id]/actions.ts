"use server";

// 기업 상세 전용 서버 액션 — 자격·기업 정보.
// 과제(관리포인트) 액션은 보드와 공용이라 lib/actions/tasks.ts에 있다.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  IpDeadlineType,
  IpRightKind,
  IpRightStatus,
} from "@/lib/database.types";
import {
  DEMO_ERROR,
  getTenantContext,
  optionalText,
  parseEokToWon,
  parseNonNegativeInt,
  parseOptionalDate,
  parseRequiredDate,
  requirePermission,
  type ActionResult,
  validateDateOrder,
} from "@/lib/actions/shared";
import {
  COMPANY_DOCUMENTS_BUCKET,
  COMPANY_DOCUMENTS_MAX_BYTES,
  getFileExtension,
  normalizeCompanyDocumentMimeType,
  parseCompanyDocumentStorageUrl,
  storageUrlFromPath,
} from "@/lib/storage";
import {
  enqueueSyncJob,
  getActiveConnection,
} from "@/lib/google-drive/connections";
import { triggerDriveSyncAfterResponse } from "@/lib/google-drive/trigger";
import { normalizeConditionTags } from "@/lib/company-tags";

type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type DocumentInsertResult =
  | { ok: true; error: null; documentId: string }
  | { ok: false; error: string };

const DOCUMENT_VERSION_INSERT_ATTEMPTS = 3;

function revalidateCompany(companyId: string) {
  revalidatePath(`/app/companies/${companyId}`);
  revalidatePath("/app/companies");
  revalidatePath("/app");
  revalidatePath("/app/notifications");
}

async function assertCompanyAccess(
  supabase: Supabase,
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

async function nextDocumentVersion(
  supabase: Supabase,
  companyId: string,
  name: string,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("document")
    .select("version")
    .eq("company_id", companyId)
    .eq("name", name)
    .order("version", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[registerUploadedDocument:latest]", error.code, error.message);
    return { ok: false, error: `버전 확인에 실패했습니다: ${error.message}` };
  }
  return { ok: true, version: (data?.[0]?.version ?? 0) + 1 };
}

async function insertDocumentWithVersionRetry(
  supabase: Supabase,
  input: {
    tenantId: string;
    companyId: string;
    credentialId: string | null;
    ipRightId: string | null;
    name: string;
    docCategory: string | null;
    storagePath: string;
    fileType: string;
    sizeBytes: number | null;
  },
): Promise<DocumentInsertResult> {
  for (let attempt = 0; attempt < DOCUMENT_VERSION_INSERT_ATTEMPTS; attempt += 1) {
    const next = await nextDocumentVersion(supabase, input.companyId, input.name);
    if (!next.ok) return { ok: false, error: next.error };

    const { data, error } = await supabase
      .from("document")
      .insert({
        tenant_id: input.tenantId,
        company_id: input.companyId,
        credential_id: input.credentialId,
        ip_right_id: input.ipRightId,
        name: input.name,
        doc_category: input.docCategory,
        version: next.version,
        uploaded_by: "consultant",
        storage_url: storageUrlFromPath(input.storagePath),
        file_type: input.fileType,
        size_bytes: input.sizeBytes,
      })
      .select("id")
      .single();

    if (!error) return { ok: true, error: null, documentId: data.id };
    if (error.code === "23505" && attempt < DOCUMENT_VERSION_INSERT_ATTEMPTS - 1) {
      continue;
    }

    console.error("[registerUploadedDocument]", error.code, error.message);
    return { ok: false, error: `자료 저장에 실패했습니다: ${error.message}` };
  }

  return {
    ok: false,
    error: "동시에 같은 자료명이 등록되고 있습니다. 잠시 후 다시 시도해 주세요.",
  };
}

export async function prepareDocumentUpload(
  companyId: string,
  file: { name: string; size: number; type?: string },
): Promise<ActionResult & { bucket?: string; path?: string; contentType?: string }> {
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
  const contentType = normalizeCompanyDocumentMimeType(file.name, file.type);
  if (!contentType) {
    return {
      ok: false,
      error: "지원하지 않는 파일 형식입니다. PDF, 이미지, Office, HWP/HWPX, CSV 파일만 업로드할 수 있습니다.",
    };
  }

  const extension = getFileExtension(file.name);
  const objectName = `${randomUUID()}${extension ? `.${extension}` : ""}`;

  const path = `${ctx.tenantId}/${companyId}/${objectName}`;
  return {
    ok: true,
    error: null,
    bucket: COMPANY_DOCUMENTS_BUCKET,
    path,
    contentType,
  };
}

export async function registerUploadedDocument(
  companyId: string,
  formData: FormData,
): Promise<ActionResult & { documentId?: string }> {
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

  // 자격 첨부면 credential_id로 명시 연결한다. 해당 자격이 같은 기업 소속인지 검증.
  const credentialId = optionalText(formData, "credential_id");
  if (credentialId) {
    const { data: cred, error: credError } = await supabase
      .from("credential")
      .select("id")
      .eq("id", credentialId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (credError) {
      console.error("[registerUploadedDocument:credential]", credError.code, credError.message);
      return { ok: false, error: `자격 확인에 실패했습니다: ${credError.message}` };
    }
    if (!cred) return { ok: false, error: "연결할 자격을 찾을 수 없습니다." };
  }
  const ipRightId = optionalText(formData, "ip_right_id");
  if (credentialId && ipRightId) {
    return { ok: false, error: "자격과 지식재산권 자료 연결은 동시에 설정할 수 없습니다." };
  }
  if (ipRightId) {
    const { data: right, error: rightError } = await supabase
      .from("ip_right")
      .select("id")
      .eq("id", ipRightId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (rightError) {
      console.error("[registerUploadedDocument:ip_right]", rightError.code, rightError.message);
      return { ok: false, error: `지식재산권 확인에 실패했습니다: ${rightError.message}` };
    }
    if (!right) return { ok: false, error: "연결할 지식재산권을 찾을 수 없습니다." };
  }

  const fileType =
    optionalText(formData, "file_type") ?? getFileExtension(name) ?? "file";

  const inserted = await insertDocumentWithVersionRetry(supabase, {
    tenantId: ctx.tenantId,
    companyId,
    credentialId,
    ipRightId,
    name,
    docCategory: optionalText(formData, "doc_category"),
    storagePath: path,
    fileType,
    sizeBytes,
  });
  if (!inserted.ok) return inserted;

  // Supabase 저장 성공이 1차 완료 — 이 사용자가 Drive를 연결했다면 동기화 잡을 적재한다.
  // 적재 실패는 자료 저장 결과에 영향을 주지 않는다(보조 기능).
  const connection = await getActiveConnection(supabase, ctx.userId);
  if (connection) {
    const enqueued = await enqueueSyncJob(supabase, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      documentId: inserted.documentId,
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
  return { ok: true, error: null, documentId: inserted.documentId };
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

/**
 * 자료(document) 삭제 — DB 행 + Storage 파일 본체 제거.
 * google_drive_sync_jobs는 document FK on delete cascade로 함께 정리된다.
 * (이미 구글 드라이브에 백업된 파일 자체는 사용자 드라이브에 남는다 — 그건 사용자 소유.)
 */
export async function deleteDocument(
  companyId: string,
  documentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: document, error: fetchError } = await supabase
    .from("document")
    .select("storage_url")
    .eq("id", documentId)
    .eq("company_id", companyId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (fetchError) {
    console.error("[deleteDocument:fetch]", fetchError.code, fetchError.message);
    return { ok: false, error: `자료 확인에 실패했습니다: ${fetchError.message}` };
  }
  if (!document) return { ok: false, error: "자료를 찾을 수 없습니다." };

  // Storage 파일 먼저 제거 (실패해도 DB 삭제는 진행 — 고아 행보다 고아 파일이 안전)
  const storage = parseCompanyDocumentStorageUrl(document.storage_url);
  if (storage) {
    const { error: removeError } = await supabase.storage
      .from(storage.bucket)
      .remove([storage.path]);
    if (removeError) {
      console.error("[deleteDocument:storage]", removeError.message);
    }
  }

  const { error } = await supabase
    .from("document")
    .delete()
    .eq("id", documentId)
    .eq("company_id", companyId);
  if (error) {
    console.error("[deleteDocument]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
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

  const issuedDate = parseOptionalDate(formData, "issued_date", "발급일");
  if (!issuedDate.ok) return { ok: false, error: issuedDate.error };
  const expiresDate = parseOptionalDate(formData, "expires_date", "만료일");
  if (!expiresDate.ok) return { ok: false, error: expiresDate.error };
  const dateOrder = validateDateOrder(
    issuedDate.value,
    expiresDate.value,
    "발급일",
    "만료일",
  );
  if (!dateOrder.ok) return dateOrder;

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return access;

  const { error } = await supabase.from("credential").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    type,
    category_id: optionalText(formData, "category_id"),
    issued_date: issuedDate.value,
    expires_date: expiresDate.value,
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

  const issuedDate = parseOptionalDate(formData, "issued_date", "발급일");
  if (!issuedDate.ok) return { ok: false, error: issuedDate.error };
  const expiresDate = parseOptionalDate(formData, "expires_date", "만료일");
  if (!expiresDate.ok) return { ok: false, error: expiresDate.error };
  const dateOrder = validateDateOrder(
    issuedDate.value,
    expiresDate.value,
    "발급일",
    "만료일",
  );
  if (!dateOrder.ok) return dateOrder;

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase
    .from("credential")
    .update({
      type,
      category_id: optionalText(formData, "category_id"),
      issued_date: issuedDate.value,
      expires_date: expiresDate.value,
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

const IP_RIGHT_KINDS: IpRightKind[] = ["patent", "trademark"];
const IP_RIGHT_STATUSES: IpRightStatus[] = [
  "preparing",
  "filed",
  "examining",
  "office_action",
  "registered",
  "rejected",
  "abandoned",
  "expired",
];
const IP_DEADLINE_TYPES: IpDeadlineType[] = [
  "office_action",
  "registration_fee",
  "renewal",
  "annuity",
  "etc",
];

function readIpRightForm(formData: FormData):
  | {
      ok: true;
      value: {
        kind: IpRightKind;
        title: string;
        applicationNo: string | null;
        registrationNo: string | null;
        agentName: string | null;
        status: IpRightStatus;
        appliedDate: string | null;
        registeredDate: string | null;
        memo: string | null;
      };
    }
  | { ok: false; error: string } {
  const kindRaw = String(formData.get("kind") ?? "");
  if (!IP_RIGHT_KINDS.includes(kindRaw as IpRightKind)) {
    return { ok: false, error: "구분을 선택해 주세요." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "명칭을 입력해 주세요." };

  const statusRaw = String(formData.get("status") ?? "preparing");
  if (!IP_RIGHT_STATUSES.includes(statusRaw as IpRightStatus)) {
    return { ok: false, error: "진행상태 값이 올바르지 않습니다." };
  }

  const appliedDate = parseOptionalDate(formData, "applied_date", "출원일");
  if (!appliedDate.ok) return { ok: false, error: appliedDate.error };
  const registeredDate = parseOptionalDate(formData, "registered_date", "등록일");
  if (!registeredDate.ok) return { ok: false, error: registeredDate.error };
  const dateOrder = validateDateOrder(
    appliedDate.value,
    registeredDate.value,
    "출원일",
    "등록일",
  );
  if (!dateOrder.ok) return dateOrder;

  return {
    ok: true,
    value: {
      kind: kindRaw as IpRightKind,
      title,
      applicationNo: optionalText(formData, "application_no"),
      registrationNo: optionalText(formData, "registration_no"),
      agentName: optionalText(formData, "agent_name"),
      status: statusRaw as IpRightStatus,
      appliedDate: appliedDate.value,
      registeredDate: registeredDate.value,
      memo: optionalText(formData, "memo"),
    },
  };
}

function readIpDeadlineForm(formData: FormData):
  | {
      ok: true;
      value: {
        id: string | null;
        type: IpDeadlineType;
        title: string | null;
        dueDate: string | null;
        isDone: boolean;
        memo: string | null;
      };
    }
  | { ok: false; error: string } {
  const typeRaw = String(formData.get("deadline_type") ?? "etc");
  if (!IP_DEADLINE_TYPES.includes(typeRaw as IpDeadlineType)) {
    return { ok: false, error: "기한 유형 값이 올바르지 않습니다." };
  }

  const title = optionalText(formData, "deadline_title");
  const dueDate = parseOptionalDate(formData, "deadline_due_date", "기한일");
  if (!dueDate.ok) return { ok: false, error: dueDate.error };
  if (title && !dueDate.value) return { ok: false, error: "기한일을 선택해 주세요." };
  if (dueDate.value && !title) return { ok: false, error: "기한명을 입력해 주세요." };

  return {
    ok: true,
    value: {
      id: optionalText(formData, "deadline_id"),
      type: typeRaw as IpDeadlineType,
      title,
      dueDate: dueDate.value,
      isDone: formData.get("deadline_is_done") === "on",
      memo: optionalText(formData, "deadline_memo"),
    },
  };
}

async function savePrimaryIpDeadline(
  supabase: Supabase,
  input: {
    tenantId: string;
    companyId: string;
    ipRightId: string;
    deadline: {
      id: string | null;
      type: IpDeadlineType;
      title: string | null;
      dueDate: string | null;
      isDone: boolean;
      memo: string | null;
    };
  },
): Promise<ActionResult> {
  const { deadline } = input;
  if (!deadline.title || !deadline.dueDate) {
    if (!deadline.id) return { ok: true, error: null };
    const { error } = await supabase
      .from("ip_deadline")
      .delete()
      .eq("id", deadline.id)
      .eq("ip_right_id", input.ipRightId)
      .eq("company_id", input.companyId);
    if (error) {
      console.error("[savePrimaryIpDeadline:delete]", error.code, error.message);
      return { ok: false, error: `기한 삭제에 실패했습니다: ${error.message}` };
    }
    return { ok: true, error: null };
  }

  if (deadline.id) {
    const { error } = await supabase
      .from("ip_deadline")
      .update({
        type: deadline.type,
        title: deadline.title,
        due_date: deadline.dueDate,
        is_done: deadline.isDone,
        memo: deadline.memo,
      })
      .eq("id", deadline.id)
      .eq("ip_right_id", input.ipRightId)
      .eq("company_id", input.companyId);
    if (error) {
      console.error("[savePrimaryIpDeadline:update]", error.code, error.message);
      return { ok: false, error: `기한 저장에 실패했습니다: ${error.message}` };
    }
    return { ok: true, error: null };
  }

  const { error } = await supabase.from("ip_deadline").insert({
    tenant_id: input.tenantId,
    company_id: input.companyId,
    ip_right_id: input.ipRightId,
    type: deadline.type,
    title: deadline.title,
    due_date: deadline.dueDate,
    is_done: deadline.isDone,
    memo: deadline.memo,
  });
  if (error) {
    console.error("[savePrimaryIpDeadline:insert]", error.code, error.message);
    return { ok: false, error: `기한 저장에 실패했습니다: ${error.message}` };
  }
  return { ok: true, error: null };
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

  const date = parseRequiredDate(formData, "date", "날짜");
  if (!date.ok) return { ok: false, error: date.error };

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
    date: date.value,
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

export async function addIpRight(
  companyId: string,
  formData: FormData,
): Promise<ActionResult & { ipRightId?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const right = readIpRightForm(formData);
  if (!right.ok) return { ok: false, error: right.error };
  const deadline = readIpDeadlineForm(formData);
  if (!deadline.ok) return { ok: false, error: deadline.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return { ok: false, error: access.error };

  const { data: inserted, error } = await supabase
    .from("ip_right")
    .insert({
      tenant_id: ctx.tenantId,
      company_id: companyId,
      kind: right.value.kind,
      title: right.value.title,
      application_no: right.value.applicationNo,
      registration_no: right.value.registrationNo,
      agent_name: right.value.agentName,
      status: right.value.status,
      applied_date: right.value.appliedDate,
      registered_date: right.value.registeredDate,
      memo: right.value.memo,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[addIpRight]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  const deadlineResult = await savePrimaryIpDeadline(supabase, {
    tenantId: ctx.tenantId,
    companyId,
    ipRightId: inserted.id,
    deadline: deadline.value,
  });
  if (!deadlineResult.ok) return deadlineResult;

  revalidateCompany(companyId);
  return { ok: true, error: null, ipRightId: inserted.id };
}

export async function updateIpRight(
  companyId: string,
  ipRightId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const right = readIpRightForm(formData);
  if (!right.ok) return { ok: false, error: right.error };
  const deadline = readIpDeadlineForm(formData);
  if (!deadline.ok) return { ok: false, error: deadline.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await supabase
    .from("ip_right")
    .update({
      kind: right.value.kind,
      title: right.value.title,
      application_no: right.value.applicationNo,
      registration_no: right.value.registrationNo,
      agent_name: right.value.agentName,
      status: right.value.status,
      applied_date: right.value.appliedDate,
      registered_date: right.value.registeredDate,
      memo: right.value.memo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ipRightId)
    .eq("company_id", companyId);
  if (error) {
    console.error("[updateIpRight]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  const deadlineResult = await savePrimaryIpDeadline(supabase, {
    tenantId: ctx.tenantId,
    companyId,
    ipRightId,
    deadline: deadline.value,
  });
  if (!deadlineResult.ok) return deadlineResult;

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

export async function deleteIpRight(
  companyId: string,
  ipRightId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!ipRightId) return { ok: false, error: "지식재산권을 찾을 수 없습니다." };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const { error } = await supabase
    .from("ip_right")
    .delete()
    .eq("id", ipRightId)
    .eq("company_id", companyId);
  if (error) {
    console.error("[deleteIpRight]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

export async function createIpTask(
  companyId: string,
  ipRightId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return { ok: false, error: access.error };

  const { data: right, error: rightError } = await supabase
    .from("ip_right")
    .select("id, title")
    .eq("id", ipRightId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (rightError) {
    console.error("[createIpTask:right]", rightError.code, rightError.message);
    return { ok: false, error: `지식재산권 확인에 실패했습니다: ${rightError.message}` };
  }
  if (!right) return { ok: false, error: "지식재산권을 찾을 수 없습니다." };

  const { data: deadlines, error: deadlineError } = await supabase
    .from("ip_deadline")
    .select("title, due_date")
    .eq("ip_right_id", ipRightId)
    .eq("company_id", companyId)
    .eq("is_done", false)
    .order("due_date", { ascending: true })
    .limit(1);
  if (deadlineError) {
    console.error("[createIpTask:deadline]", deadlineError.code, deadlineError.message);
    return { ok: false, error: `기한 확인에 실패했습니다: ${deadlineError.message}` };
  }

  const nextDeadline = deadlines?.[0] ?? null;
  const taskTitle = nextDeadline
    ? `${right.title} · ${nextDeadline.title}`
    : `${right.title} 지식재산권 관리`;
  const dueDate = nextDeadline?.due_date ?? null;

  let existingQuery = supabase
    .from("task")
    .select("id")
    .eq("company_id", companyId)
    .eq("title", taskTitle)
    .neq("stage", "result")
    .limit(1);
  existingQuery =
    dueDate === null
      ? existingQuery.is("due_date", null)
      : existingQuery.eq("due_date", dueDate);
  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) {
    console.error("[createIpTask:existing]", existingError.code, existingError.message);
    return { ok: false, error: `중복 확인에 실패했습니다: ${existingError.message}` };
  }
  if (existing && existing.length > 0) {
    return { ok: false, error: "이미 같은 내용의 진행 중 Task가 있습니다." };
  }

  const { error } = await supabase.from("task").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    title: taskTitle,
    stage: "diagnosis",
    due_date: dueDate,
    assignee_id: ctx.userId,
  });
  if (error) {
    console.error("[createIpTask]", error.code, error.message);
    return { ok: false, error: `과제 생성에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  revalidatePath("/app/board");
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

  const foundedDate = parseOptionalDate(formData, "founded_date", "설립일");
  if (!foundedDate.ok) return { ok: false, error: foundedDate.error };
  const contractStartDate = parseOptionalDate(
    formData,
    "contract_start_date",
    "계약 시작일",
  );
  if (!contractStartDate.ok) {
    return { ok: false, error: contractStartDate.error };
  }
  const contractEndDate = parseOptionalDate(
    formData,
    "contract_end_date",
    "계약 종료일",
  );
  if (!contractEndDate.ok) return { ok: false, error: contractEndDate.error };
  const contractOrder = validateDateOrder(
    contractStartDate.value,
    contractEndDate.value,
    "계약 시작일",
    "계약 종료일",
  );
  if (!contractOrder.ok) return contractOrder;

  const conditionTags = normalizeConditionTags(optionalText(formData, "condition_tags"));

  const { error } = await supabase
    .from("company")
    .update({
      name,
      biz_no: optionalText(formData, "biz_no"),
      industry: optionalText(formData, "industry"),
      business_condition: optionalText(formData, "business_condition"),
      region: optionalText(formData, "region"),
      founded_date: foundedDate.value,
      revenue: revenue.value,
      headcount: headcount.value,
      ceo_name: optionalText(formData, "ceo_name"),
      contact_name: optionalText(formData, "contact_name"),
      contact_phone: optionalText(formData, "contact_phone"),
      contact_email: optionalText(formData, "contact_email"),
      condition_tags: conditionTags,
      contract_start_date: contractStartDate.value,
      contract_end_date: contractEndDate.value,
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

/**
 * 관리 종료(아카이브) — 데이터는 보존하고 status만 'ended'로 전환한다.
 * deadline_item 뷰가 종료 기업을 제외하므로 대시보드·목록 D-day 집계에서 자동으로 빠진다.
 */
export async function endCompany(
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
  if (!access.ok) return { ok: false, error: access.error };

  const endedDate = parseOptionalDate(formData, "ended_date", "종료일");
  if (!endedDate.ok) return { ok: false, error: endedDate.error };
  const endedAt = endedDate.value
    ? new Date(`${endedDate.value}T00:00:00+09:00`).toISOString()
    : new Date().toISOString();

  const { error } = await supabase
    .from("company")
    .update({
      status: "ended",
      ended_at: endedAt,
      ended_reason: optionalText(formData, "ended_reason"),
      // 종료일을 입력했다면 계약 종료일도 함께 채워 기록을 일관되게 유지
      ...(endedDate.value ? { contract_end_date: endedDate.value } : {}),
    })
    .eq("id", companyId)
    .eq("tenant_id", ctx.tenantId);
  if (error) {
    console.error("[endCompany]", error.code, error.message);
    return { ok: false, error: `관리 종료 처리에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

/** 관리 재개 — 종료된 기업을 다시 활성(관리중) 상태로 되돌린다. */
export async function reactivateCompany(
  companyId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await supabase
    .from("company")
    .update({ status: "active", ended_at: null, ended_reason: null })
    .eq("id", companyId)
    .eq("tenant_id", ctx.tenantId);
  if (error) {
    console.error("[reactivateCompany]", error.code, error.message);
    return { ok: false, error: `관리 재개에 실패했습니다: ${error.message}` };
  }

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

/**
 * 완전 삭제(하드) — 잘못 등록한 기업을 자식 데이터까지 영구 삭제한다.
 * FK on delete cascade로 credential·task·schedule·document·ip_right·notification 행이 함께 지워지고,
 * document의 Storage 파일 본체는 cascade 대상이 아니므로 삭제 전에 best-effort로 정리한다.
 * confirmName으로 기업명을 한 번 더 확인해 오삭제를 막는다.
 */
export async function deleteCompany(
  companyId: string,
  confirmName: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: company, error: fetchError } = await supabase
    .from("company")
    .select("id, name")
    .eq("id", companyId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (fetchError) {
    console.error("[deleteCompany:fetch]", fetchError.code, fetchError.message);
    return { ok: false, error: `기업 확인에 실패했습니다: ${fetchError.message}` };
  }
  if (!company) return { ok: false, error: "기업을 찾을 수 없습니다." };

  if (confirmName.trim() !== company.name.trim()) {
    return { ok: false, error: "확인을 위해 기업명을 정확히 입력해 주세요." };
  }

  // Storage 파일 정리 (DB cascade 대상이 아님) — 실패해도 삭제는 계속(고아 파일이 고아 행보다 안전)
  const { data: docs } = await supabase
    .from("document")
    .select("storage_url")
    .eq("company_id", companyId)
    .eq("tenant_id", ctx.tenantId);
  const paths = (docs ?? [])
    .map((doc) => parseCompanyDocumentStorageUrl(doc.storage_url)?.path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .remove(paths);
    if (removeError) {
      console.error("[deleteCompany:storage]", removeError.message);
    }
  }

  const { error } = await supabase
    .from("company")
    .delete()
    .eq("id", companyId)
    .eq("tenant_id", ctx.tenantId);
  if (error) {
    console.error("[deleteCompany]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/companies");
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  return { ok: true, error: null };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  COMPANY_DOCUMENTS_BUCKET,
  normalizeCompanyDocumentMimeType,
  parseCompanyDocumentStorageUrl,
} from "@/lib/storage";

type Service = SupabaseClient<Database>;

export interface EnqueueReportBackupInput {
  tenantId: string;
  userId: string;
  documentIds: string[];
  /** OAuth 재연결 시 실패·유실된 기존 잡도 다시 pending으로 되돌린다. */
  resetExisting?: boolean;
}

/**
 * 생성된 보고서 문서를 요청자의 Google Drive 백업 큐에 등록한다.
 * 보고서 생성의 보조 동작이므로 호출자는 실패를 보고서 실패로 전파하지 않는다.
 */
export async function enqueueReportDocumentBackups(
  service: Service,
  input: EnqueueReportBackupInput,
): Promise<number> {
  const documentIds = [...new Set(input.documentIds.filter(Boolean))];
  if (documentIds.length === 0) return 0;

  const { data: connection, error: connectionError } = await service
    .from("google_drive_connections")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (connectionError) {
    console.error(
      "[enqueueReportDocumentBackups:connection]",
      connectionError.code,
      connectionError.message,
    );
    return 0;
  }
  if (!connection) return 0;

  const { data: documents, error: documentError } = await service
    .from("document")
    .select("id, name, storage_url, file_type, size_bytes")
    .eq("tenant_id", input.tenantId)
    .in("id", documentIds);
  if (documentError) {
    console.error(
      "[enqueueReportDocumentBackups:documents]",
      documentError.code,
      documentError.message,
    );
    return 0;
  }

  const rows = (documents ?? []).flatMap((document) => {
    const storage = parseCompanyDocumentStorageUrl(document.storage_url);
    if (!storage || storage.bucket !== COMPANY_DOCUMENTS_BUCKET) return [];
    return [
      {
        tenant_id: input.tenantId,
        user_id: input.userId,
        document_id: document.id,
        storage_bucket: storage.bucket,
        storage_path: storage.path,
        file_name: document.name,
        mime_type:
          normalizeCompanyDocumentMimeType(document.name, null) ??
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes: document.size_bytes,
        status: "pending" as const,
        attempts: 0,
        google_drive_file_id: null,
        google_drive_web_view_link: null,
        last_error: null,
        next_run_at: new Date().toISOString(),
      },
    ];
  });
  if (rows.length === 0) return 0;

  const { error } = input.resetExisting
    ? await service
        .from("google_drive_sync_jobs")
        .upsert(rows, { onConflict: "document_id" })
    : await service
        .from("google_drive_sync_jobs")
        .upsert(rows, { onConflict: "document_id", ignoreDuplicates: true });
  if (error) {
    console.error(
      "[enqueueReportDocumentBackups:upsert]",
      error.code,
      error.message,
    );
    return 0;
  }
  const { data: queued, error: queuedError } = await service
    .from("google_drive_sync_jobs")
    .select("document_id")
    .eq("user_id", input.userId)
    .in(
      "document_id",
      rows.map((row) => row.document_id),
    );
  if (queuedError) {
    console.error(
      "[enqueueReportDocumentBackups:verify]",
      queuedError.code,
      queuedError.message,
    );
    return 0;
  }
  return queued?.length ?? 0;
}

/** OAuth 연결 직후 현재 사용자가 만든 기존 미팅 보고서 산출물을 자동 백필한다. */
export async function enqueueExistingMeetingReportBackups(
  service: Service,
  tenantId: string,
  userId: string,
  options: { resetExisting?: boolean } = {},
): Promise<number> {
  const pageSize = 100;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data: reports, error } = await service
      .from("meeting_report")
      .select("output_document_id, summary_output_document_id")
      .eq("tenant_id", tenantId)
      .eq("requested_by", userId)
      .eq("status", "succeeded")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error(
        "[enqueueExistingMeetingReportBackups]",
        error.code,
        error.message,
      );
      return total;
    }

    const documentIds = (reports ?? []).flatMap((report) =>
      [report.output_document_id, report.summary_output_document_id].filter(
        (id): id is string => Boolean(id),
      ),
    );
    total += await enqueueReportDocumentBackups(service, {
      tenantId,
      userId,
      documentIds,
      resetExisting: options.resetExisting,
    });

    if ((reports ?? []).length < pageSize) return total;
    offset += pageSize;
  }
}

/** Drive cron이 누락된 보고서 백업 잡을 멱등하게 복구한다. */
export async function reconcileMeetingReportBackups(
  service: Service,
): Promise<number> {
  const pageSize = 100;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data: connections, error } = await service
      .from("google_drive_connections")
      .select("tenant_id, user_id")
      .is("revoked_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error(
        "[reconcileMeetingReportBackups]",
        error.code,
        error.message,
      );
      return total;
    }

    for (const connection of connections ?? []) {
      total += await enqueueExistingMeetingReportBackups(
        service,
        connection.tenant_id,
        connection.user_id,
      );
    }

    if ((connections ?? []).length < pageSize) return total;
    offset += pageSize;
  }
}

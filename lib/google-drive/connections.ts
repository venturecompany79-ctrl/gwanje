import type { Supabase } from "@/lib/actions/shared";

// Google Drive 연결 조회 + 동기화 잡 적재 헬퍼.
// 사용자 세션 Supabase 클라이언트(RLS 적용)로 동작한다.

export interface ActiveDriveConnection {
  id: string;
  userId: string;
  googleEmail: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
}

/** 현재 사용자의 유효한(해제되지 않은) Drive 연결. 없으면 null. */
export async function getActiveConnection(
  supabase: Supabase,
  userId: string,
): Promise<ActiveDriveConnection | null> {
  const { data, error } = await supabase
    .from("google_drive_connections")
    .select("id, user_id, google_email, root_folder_id, root_folder_name, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[getActiveConnection]", error.code, error.message);
    return null;
  }
  if (!data || data.revoked_at) return null;
  return {
    id: data.id,
    userId: data.user_id,
    googleEmail: data.google_email,
    rootFolderId: data.root_folder_id,
    rootFolderName: data.root_folder_name,
  };
}

export interface EnqueueJobInput {
  tenantId: string;
  userId: string;
  documentId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

/**
 * 동기화 잡 적재 — document당 1잡(unique document_id)이라 멱등.
 * 이미 잡이 있으면 무시(ignoreDuplicates)한다.
 * 원본 자료 저장의 부수효과이므로, 실패해도 throw하지 않고 false만 반환한다.
 */
export async function enqueueSyncJob(
  supabase: Supabase,
  input: EnqueueJobInput,
): Promise<boolean> {
  const { error } = await supabase
    .from("google_drive_sync_jobs")
    .upsert(
      {
        tenant_id: input.tenantId,
        user_id: input.userId,
        document_id: input.documentId,
        storage_bucket: input.storageBucket,
        storage_path: input.storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        status: "pending",
      },
      { onConflict: "document_id", ignoreDuplicates: true },
    );
  if (error) {
    // 동기화는 보조 기능 — 적재 실패가 자료 저장 실패로 이어지면 안 된다(로그만).
    console.error("[enqueueSyncJob]", error.code, error.message);
    return false;
  }
  return true;
}

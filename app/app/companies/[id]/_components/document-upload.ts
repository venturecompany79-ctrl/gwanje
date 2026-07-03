import { createClient } from "@/lib/supabase/client";
import { prepareDocumentUpload, registerUploadedDocument } from "../actions";

/**
 * 파일 1건을 Storage에 올리고 document 레코드로 등록한다(자료 탭과 공용).
 * displayName이 기존 자료명과 같으면 registerUploadedDocument가 version+1로 처리(= 업데이트).
 * docCategory를 주면 자료의 '분류'로 저장된다(예: 자격·인증 첨부 → "인증").
 * credentialId를 주면 해당 자격에, ipRightId를 주면 해당 지식재산권에 명시 연결된다.
 */
export async function uploadDocumentVersion(
  companyId: string,
  file: File,
  displayName: string,
  options?: { docCategory?: string; credentialId?: string; ipRightId?: string },
): Promise<{ ok: true; documentId?: string } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!supabase) {
    return { ok: false, error: "데모 모드에서는 파일을 업로드할 수 없습니다." };
  }

  const prepared = await prepareDocumentUpload(companyId, {
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (!prepared.ok || !prepared.bucket || !prepared.path || !prepared.contentType) {
    return { ok: false, error: prepared.error ?? "업로드 준비에 실패했습니다." };
  }

  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket)
    .upload(prepared.path, file, {
      contentType: prepared.contentType,
      upsert: false,
    });
  if (uploadError) {
    return { ok: false, error: `파일 업로드에 실패했습니다: ${uploadError.message}` };
  }

  const formData = new FormData();
  formData.set("name", displayName);
  formData.set("path", prepared.path);
  formData.set("size_bytes", String(file.size));
  formData.set("file_type", file.name.split(".").pop()?.toLowerCase() ?? "file");
  formData.set("mime_type", prepared.contentType);
  if (options?.docCategory) formData.set("doc_category", options.docCategory);
  if (options?.credentialId) formData.set("credential_id", options.credentialId);
  if (options?.ipRightId) formData.set("ip_right_id", options.ipRightId);

  const result = await registerUploadedDocument(companyId, formData);
  if (!result.ok) {
    await supabase.storage.from(prepared.bucket).remove([prepared.path]);
    return { ok: false, error: result.error ?? "자료 저장에 실패했습니다." };
  }
  return { ok: true, documentId: result.documentId };
}

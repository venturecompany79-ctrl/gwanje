"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconAlert, IconCalendar, IconDownload, IconFile, IconPlus } from "@/components/ui/icons";
import { DOCUMENT_UPLOADER_LABEL, SCHEDULE_TYPE_LABEL } from "@/lib/labels";
import { formatBytes } from "@/lib/format";
import { formatKstDate } from "@/lib/datetime";
import type { DocumentRow, ScheduleRow } from "@/lib/data/company-detail";
import { createClient } from "@/lib/supabase/client";
import {
  createDocumentDownloadUrl,
  prepareDocumentUpload,
  registerUploadedDocument,
} from "../actions";

export function ScheduleTab({ schedules }: { schedules: ScheduleRow[] }) {
  return (
    <Panel>
      <PanelHead
        title="일정"
        count={schedules.length > 0 ? `${schedules.length}건` : undefined}
      />
      {schedules.length === 0 ? (
        <EmptyState
          bare
          icon={<IconCalendar />}
          title="등록된 일정이 없습니다"
          description="자격 만료·과제 마감·미팅 일정이 이곳에 모입니다. 만료일이 있는 자격을 등록하면 자동으로 추적됩니다."
        />
      ) : (
        <table className="dlist">
          <thead>
            <tr>
              <th>일정</th>
              <th>유형</th>
              <th>날짜</th>
              <th>D-day</th>
              <th>연결 과제</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td className="name">{s.title}</td>
                <td>
                  <Badge tone="neutral">{SCHEDULE_TYPE_LABEL[s.type]}</Badge>
                </td>
                <td className="date num">{s.date}</td>
                <td>
                  {s.daysLeft < 0 ? (
                    <span className="cell-muted">지남</span>
                  ) : (
                    <DdayBadge daysLeft={s.daysLeft} />
                  )}
                </td>
                <td>
                  {s.relatedTaskTitle ? (
                    <CategoryChip name={s.relatedTaskTitle} />
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function UploadDocumentButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPending(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("데모 모드에서는 파일을 업로드할 수 없습니다.");
      setPending(false);
      return;
    }

    const prepared = await prepareDocumentUpload(companyId, {
      name: file.name,
      size: file.size,
    });
    if (!prepared.ok || !prepared.bucket || !prepared.path) {
      setError(prepared.error);
      setPending(false);
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from(prepared.bucket)
      .upload(prepared.path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) {
      setError(`파일 업로드에 실패했습니다: ${uploadError.message}`);
      setPending(false);
      return;
    }

    const formData = new FormData();
    formData.set("name", file.name);
    formData.set("path", prepared.path);
    formData.set("size_bytes", String(file.size));
    formData.set("file_type", file.name.split(".").pop()?.toLowerCase() ?? "file");

    const result = await registerUploadedDocument(companyId, formData);
    if (!result.ok) {
      await supabase.storage.from(prepared.bucket).remove([prepared.path]);
      setError(result.error);
      setPending(false);
      return;
    }

    setPending(false);
    router.refresh();
  }

  return (
    <div className="file-upload-action">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.hwp,.hwpx"
        onChange={handleFileChange}
        aria-label="자료 파일 선택"
      />
      <Button
        type="button"
        variant="cta"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        <IconPlus /> {pending ? "업로드 중..." : "파일 업로드"}
      </Button>
      {error ? (
        <div className="inline-error">
          <IconAlert /> {error}
        </div>
      ) : null}
    </div>
  );
}

function DocumentDownloadButton({ document }: { document: DocumentRow }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setPending(true);
    setError(null);
    const result = await createDocumentDownloadUrl(document.id);
    setPending(false);

    if (!result.ok || !result.url) {
      setError(result.error);
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (!document.storageUrl) return <span className="cell-muted">—</span>;

  return (
    <span className="download-cell">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={pending}
      >
        <IconDownload /> {pending ? "준비 중" : "열기"}
      </Button>
      {error ? <span className="field-error">{error}</span> : null}
    </span>
  );
}

export function FilesTab({
  companyId,
  documents,
}: {
  companyId: string;
  documents: DocumentRow[];
}) {
  return (
    <Panel>
      <PanelHead
        title="자료"
        count={documents.length > 0 ? `${documents.length}건` : undefined}
      >
        <UploadDocumentButton companyId={companyId} />
      </PanelHead>
      {documents.length === 0 ? (
        <EmptyState
          bare
          icon={<IconFile />}
          title="등록된 자료가 없습니다"
          description="재무제표, 인증서 같은 기업 자료가 이곳에 모입니다. 업로드한 파일은 안전하게 보관됩니다."
          action={<UploadDocumentButton companyId={companyId} />}
        />
      ) : (
        <table className="dlist">
          <thead>
            <tr>
              <th>자료명</th>
              <th>분류</th>
              <th className="r">버전</th>
              <th>업로더</th>
              <th className="r">크기</th>
              <th>등록일</th>
              <th className="r">파일</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td className="name">
                  <span
                    style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
                  >
                    <span className="file-type">{d.fileType ?? "—"}</span>
                    {d.name}
                  </span>
                </td>
                <td>
                  {d.docCategory ? (
                    <CategoryChip name={d.docCategory} />
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </td>
                <td className="r num">v{d.version}</td>
                <td>{DOCUMENT_UPLOADER_LABEL[d.uploadedBy]}</td>
                <td className="r num">{formatBytes(d.sizeBytes)}</td>
                <td className="date num">{formatKstDate(d.createdAt)}</td>
                <td className="r">
                  <DocumentDownloadButton document={d} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

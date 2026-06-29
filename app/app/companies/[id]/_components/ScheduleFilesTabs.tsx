"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconAlert, IconCalendar, IconDownload, IconFile, IconLink, IconPlus, IconX } from "@/components/ui/icons";
import { DOCUMENT_UPLOADER_LABEL, SCHEDULE_TYPE_LABEL } from "@/lib/labels";
import { formatBytes } from "@/lib/format";
import { formatKstDate } from "@/lib/datetime";
import type { DocumentRow, ScheduleRow } from "@/lib/data/company-detail";
import { createClient } from "@/lib/supabase/client";
import {
  addSchedule,
  createDocumentDownloadUrl,
  prepareDocumentUpload,
  registerUploadedDocument,
} from "../actions";
import { retryDriveSync } from "@/lib/actions/google-drive";

function AddScheduleSlideOver({
  companyId,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  demo: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addSchedule(companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      showToast("일정을 추가했습니다");
      router.refresh();
    });
  }

  return (
    <div className="slideover-root">
      <div className="slideover-backdrop" onClick={onClose} />
      <aside className="slideover" role="dialog" aria-modal="true" aria-label="일정 추가">
        <div className="slideover-head">
          <h2>일정 추가</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconX />
          </button>
        </div>
        <form className="slideover-form" onSubmit={handleSubmit}>
          <div className="slideover-body">
            {demo ? (
              <div className="auth-notice">
                <b>데모 모드</b> — 입력 내용은 저장되지 않습니다. Supabase
                연결(.env.local) 후 실제 등록이 가능합니다.
              </div>
            ) : null}
            {error ? (
              <div className="auth-error">
                <IconAlert /> {error}
              </div>
            ) : null}
            <InputField
              label="일정명 *"
              name="title"
              required
              placeholder="예: 갱신 서류 제출"
              autoFocus
            />
            <div className="form-grid2">
              <InputField label="날짜 *" name="date" type="date" required />
              <div className="field">
                <label htmlFor="schedule-type">유형</label>
                <select
                  id="schedule-type"
                  name="type"
                  className="input"
                  defaultValue="etc"
                >
                  {Object.entries(SCHEDULE_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="schedule-memo">메모</label>
              <textarea
                id="schedule-memo"
                name="memo"
                className="memo-input"
                placeholder="장소, 준비물 등"
              />
            </div>
          </div>
          <div className="slideover-foot">
            <Button variant="cta" type="submit" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              닫기
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export function ScheduleTab({
  companyId,
  schedules,
  demo,
  showToast,
}: {
  companyId: string;
  schedules: ScheduleRow[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Panel>
      <PanelHead
        title="일정"
        count={schedules.length > 0 ? `${schedules.length}건` : undefined}
      >
        <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
          <IconPlus /> 일정 추가
        </Button>
      </PanelHead>
      {adding ? (
        <AddScheduleSlideOver
          companyId={companyId}
          demo={demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {schedules.length === 0 ? (
        <EmptyState
          bare
          icon={<IconCalendar />}
          title="등록된 일정이 없습니다"
          description="자격 만료·과제 마감·미팅 일정이 이곳에 모입니다. 만료일이 있는 자격을 등록하면 자동으로 추적되고, 직접 일정을 추가할 수도 있습니다."
          action={
            <Button variant="cta" onClick={() => setAdding(true)}>
              <IconPlus /> 일정 추가
            </Button>
          }
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
                  <DdayBadge daysLeft={s.daysLeft} />
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
    // Google Drive 동기화 시 정확한 MIME으로 업로드하기 위해 전달
    formData.set("mime_type", file.type || "application/octet-stream");

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

/** 자료 행의 Drive 동기화 상태 배지 (driveConnected일 때만 노출) */
function DriveSyncBadge({ sync }: { sync: DocumentRow["driveSync"] }) {
  if (!sync) return <span className="cell-muted">—</span>;
  if (sync.status === "succeeded") {
    const badge = <Badge tone="success">백업됨</Badge>;
    return sync.webViewLink ? (
      <a
        className="drive-sync-link"
        href={sync.webViewLink}
        target="_blank"
        rel="noopener noreferrer"
        title="구글 드라이브에서 열기"
      >
        {badge}
      </a>
    ) : (
      badge
    );
  }
  if (sync.status === "failed") return <Badge tone="critical">실패</Badge>;
  return <Badge tone="neutral">동기화 중…</Badge>;
}

/** 상태 배지 + (실패 시) 다시 시도 버튼 */
function DriveSyncCell({
  companyId,
  document,
  showToast,
}: {
  companyId: string;
  document: DocumentRow;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await retryDriveSync(companyId, document.id);
      if (!result.ok) {
        showToast(result.error ?? "다시 시도에 실패했습니다.");
        return;
      }
      showToast("동기화를 다시 시도합니다");
      router.refresh();
    });
  }

  if (document.driveSync?.status === "failed") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Badge tone="critical">실패</Badge>
        <Button variant="ghost" size="sm" onClick={retry} disabled={pending}>
          {pending ? "재시도 중…" : "다시 시도"}
        </Button>
      </span>
    );
  }
  return <DriveSyncBadge sync={document.driveSync} />;
}

/** 미연결 사용자에게 본인 Drive 자동 백업을 권하는 한 줄 배너 */
function DriveConnectPrompt() {
  return (
    <div className="drive-connect-prompt">
      <IconLink />
      <div className="dcp-body">
        <b>구글 드라이브에 자동 백업</b> — 연결해 두면 이 회사에 올린 자료가 본인 구글
        드라이브에도 자동으로 저장됩니다. 한 번만 연결하면 됩니다.
      </div>
      <a className="btn btn--secondary btn--sm" href="/app/settings?section=drive">
        연결하기
      </a>
    </div>
  );
}

export function FilesTab({
  companyId,
  documents,
  driveConnected,
  driveConfigured,
  showToast,
}: {
  companyId: string;
  documents: DocumentRow[];
  driveConnected: boolean;
  driveConfigured: boolean;
  showToast: (message: string) => void;
}) {
  // 연결 가능(환경변수 OK)하지만 아직 미연결일 때만 유도 배너 노출
  const showPrompt = driveConfigured && !driveConnected;
  return (
    <Panel>
      <PanelHead
        title="자료"
        count={documents.length > 0 ? `${documents.length}건` : undefined}
      >
        <UploadDocumentButton companyId={companyId} />
      </PanelHead>
      {showPrompt ? <DriveConnectPrompt /> : null}
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
              {driveConnected ? <th>드라이브</th> : null}
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
                {driveConnected ? (
                  <td>
                    <DriveSyncCell
                      companyId={companyId}
                      document={d}
                      showToast={showToast}
                    />
                  </td>
                ) : null}
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

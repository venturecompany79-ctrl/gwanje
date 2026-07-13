"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ensureReportDriveSync,
  retryDriveSync,
} from "@/lib/actions/google-drive";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  IconAlert,
  IconDownload,
  IconFile,
  IconLink,
  IconPlus,
  IconRefresh,
  IconSparkle,
} from "@/components/ui/icons";
import { formatKstShortDateTime } from "@/lib/datetime";
import type {
  DocumentRow,
  MeetingReportRow,
} from "@/lib/data/company-detail";
import { createDocumentDownloadUrl } from "../actions";
import { createMeetingReport, retryMeetingReport } from "../report-actions";
import { uploadDocumentVersion } from "./document-upload";

const REPORT_SOURCE_ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json";
const REPORT_SOURCE_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json"]);

const STATUS_LABEL: Record<MeetingReportRow["status"], string> = {
  pending: "대기",
  processing: "생성 중",
  succeeded: "완료",
  failed: "오류",
};

const STATUS_TONE: Record<
  MeetingReportRow["status"],
  "neutral" | "attention" | "success" | "critical"
> = {
  pending: "neutral",
  processing: "attention",
  succeeded: "success",
  failed: "critical",
};

const ROLE_LABEL = {
  company_info: "첨부자료",
  meeting_note: "회의록",
} as const;

interface ReportSourceOption {
  id: string;
  name: string;
  fileType: string | null;
  version?: number;
  uploadedNow?: boolean;
}

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

function isSupportedUpload(file: File): boolean {
  return REPORT_SOURCE_EXTENSIONS.has(fileExtension(file.name));
}

function ReportDownloadButton({
  documentId,
  label,
  showToast,
}: {
  documentId: string | null;
  label: string;
  showToast: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);

  async function download() {
    if (!documentId) return;
    setPending(true);
    const result = await createDocumentDownloadUrl(documentId);
    setPending(false);
    if (!result.ok || !result.url) {
      showToast(result.error ?? "다운로드 링크를 만들지 못했습니다.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={download}
      disabled={!documentId || pending}
    >
      <IconDownload /> {pending ? "준비 중" : label}
    </Button>
  );
}

function ReportStatusAction({
  companyId,
  report,
  showToast,
}: {
  companyId: string;
  report: MeetingReportRow;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await retryMeetingReport(companyId, report.id);
      if (!result.ok) {
        showToast(result.error ?? "재시도에 실패했습니다.");
        return;
      }
      showToast("보고서 생성을 다시 시작했습니다");
      router.refresh();
      window.setTimeout(() => router.refresh(), 3000);
    });
  }

  if (report.status === "failed") {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={retry} disabled={pending}>
        <IconRefresh /> {pending ? "재시도 중" : "다시 시도"}
      </Button>
    );
  }
  if (report.status === "pending" || report.status === "processing") {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => router.refresh()}>
        <IconRefresh /> 새로고침
      </Button>
    );
  }
  return <span className="cell-muted">—</span>;
}

function OutputFilesCell({
  report,
  showToast,
}: {
  report: MeetingReportRow;
  showToast: (message: string) => void;
}) {
  const outputs = [
    {
      key: "full",
      label: "전체본",
      documentId: report.outputDocumentId,
      documentName: report.outputDocumentName,
    },
    {
      key: "summary",
      label: "요약본",
      documentId: report.summaryOutputDocumentId,
      documentName: report.summaryOutputDocumentName,
    },
  ] as const;

  return (
    <div className="report-output-list">
      {outputs.map((output) => (
        <div className="report-output-item" key={output.key}>
          <span className="report-output-label">{output.label}</span>
          {output.documentId ? (
            <ReportDownloadButton
              documentId={output.documentId}
              label="열기"
              showToast={showToast}
            />
          ) : (
            <span className="cell-muted" title={output.documentName ?? undefined}>
              미생성
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

type ReportDriveSync = MeetingReportRow["outputDriveSync"];

function DriveSyncStatus({
  companyId,
  documentId,
  sync,
  driveConnected,
  driveConfigured,
  showToast,
}: {
  companyId: string;
  documentId: string | null;
  sync: ReportDriveSync;
  driveConnected: boolean;
  driveConfigured: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function retry() {
    if (!documentId) return;
    startTransition(async () => {
      const result = await retryDriveSync(companyId, documentId);
      if (!result.ok) {
        showToast(result.error ?? "백업 재시도에 실패했습니다.");
        return;
      }
      showToast("Google Drive 백업을 다시 시도합니다");
      router.refresh();
      window.setTimeout(() => router.refresh(), 3000);
    });
  }

  function ensureBackup() {
    if (!documentId) return;
    startTransition(async () => {
      const result = await ensureReportDriveSync(companyId, documentId);
      if (!result.ok) {
        showToast(result.error ?? "백업 작업을 시작하지 못했습니다.");
        return;
      }
      showToast("Google Drive 백업을 시작합니다");
      router.refresh();
      window.setTimeout(() => router.refresh(), 3000);
    });
  }

  if (!documentId) return <span className="cell-muted">—</span>;
  if (!driveConfigured) return <Badge tone="neutral">백업 미설정</Badge>;
  if (!driveConnected) return <Badge tone="attention">미백업</Badge>;
  if (!sync) {
    return (
      <span className="report-drive-retry">
        <Badge tone="neutral">백업 대기</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={ensureBackup}
          disabled={pending}
        >
          {pending ? "시작 중" : "백업 시작"}
        </Button>
      </span>
    );
  }

  if (sync.status === "succeeded") {
    const badge = <Badge tone="success">백업됨</Badge>;
    return sync.webViewLink ? (
      <a
        className="drive-sync-link"
        href={sync.webViewLink}
        target="_blank"
        rel="noopener noreferrer"
        title="Google Drive에서 열기"
      >
        {badge}
      </a>
    ) : (
      badge
    );
  }
  if (sync.status === "failed") {
    return (
      <span className="report-drive-retry">
        <Badge tone="critical">실패</Badge>
        <Button type="button" variant="ghost" size="sm" onClick={retry} disabled={pending}>
          {pending ? "재시도 중" : "다시 시도"}
        </Button>
      </span>
    );
  }
  return <Badge tone="neutral">백업 중</Badge>;
}

function OutputDriveCell({
  companyId,
  report,
  driveConnected,
  driveConfigured,
  showToast,
}: {
  companyId: string;
  report: MeetingReportRow;
  driveConnected: boolean;
  driveConfigured: boolean;
  showToast: (message: string) => void;
}) {
  const outputs = [
    {
      key: "full",
      label: "전체본",
      documentId: report.outputDocumentId,
      sync: report.outputDriveSync,
    },
    {
      key: "summary",
      label: "요약본",
      documentId: report.summaryOutputDocumentId,
      sync: report.summaryOutputDriveSync,
    },
  ] as const;

  return (
    <div className="report-output-list">
      {outputs.map((output) => (
        <div className="report-output-item" key={output.key}>
          <span className="report-output-label">{output.label}</span>
          <DriveSyncStatus
            companyId={companyId}
            documentId={output.documentId}
            sync={output.sync}
            driveConnected={driveConnected}
            driveConfigured={driveConfigured}
            showToast={showToast}
          />
        </div>
      ))}
    </div>
  );
}

function ReportCreateForm({
  companyId,
  companyName,
  documents,
  showToast,
}: {
  companyId: string;
  companyName: string;
  documents: DocumentRow[];
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadedDocuments, setUploadedDocuments] = useState<ReportSourceOption[]>([]);
  const [supportingIds, setSupportingIds] = useState<string[]>([]);
  const [meetingNoteId, setMeetingNoteId] = useState("");
  const [uploadingSupporting, setUploadingSupporting] = useState(false);
  const [uploadingMeetingNote, setUploadingMeetingNote] = useState(false);
  const defaultTitle = `${companyName} 미팅 진단 보고서`;

  const sourceOptions = useMemo(() => {
    const byId = new Map<string, ReportSourceOption>();
    for (const doc of documents) {
      byId.set(doc.id, {
        id: doc.id,
        name: doc.name,
        fileType: doc.fileType,
        version: doc.version,
      });
    }
    for (const doc of uploadedDocuments) byId.set(doc.id, doc);
    return [...byId.values()];
  }, [documents, uploadedDocuments]);

  function toggleSupporting(documentId: string, checked: boolean) {
    setError(null);
    if (checked && supportingIds.length >= 5) {
      setError("첨부자료는 최대 5개까지 선택할 수 있습니다.");
      return;
    }
    setSupportingIds((current) =>
      checked
        ? [...current, documentId]
        : current.filter((id) => id !== documentId),
    );
  }

  async function uploadSupporting(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    if (supportingIds.length + files.length > 5) {
      setError(`첨부자료는 최대 5개입니다. 지금은 ${5 - supportingIds.length}개 더 추가할 수 있습니다.`);
      return;
    }
    const unsupported = files.find((file) => !isSupportedUpload(file));
    if (unsupported) {
      setError(`'${unsupported.name}'은(는) 지원하지 않습니다. PDF, DOCX, TXT, MD, CSV, JSON 파일을 선택해 주세요.`);
      return;
    }

    setError(null);
    setUploadingSupporting(true);
    const uploaded: ReportSourceOption[] = [];
    const failedUploads: string[] = [];
    try {
      for (const file of files) {
        const result = await uploadDocumentVersion(companyId, file, file.name);
        if (!result.ok || !result.documentId) {
          failedUploads.push(
            `${file.name}: ${result.ok ? "자료를 등록하지 못했습니다." : result.error}`,
          );
          continue;
        }
        uploaded.push({
          id: result.documentId,
          name: file.name,
          fileType: fileExtension(file.name),
          uploadedNow: true,
        });
      }
    } catch (uploadFailure) {
      failedUploads.push(
        uploadFailure instanceof Error
          ? `업로드 중 오류: ${uploadFailure.message}`
          : "업로드 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setUploadingSupporting(false);
    }
    if (uploaded.length > 0) {
      setUploadedDocuments((current) => [...current, ...uploaded]);
      setSupportingIds((current) => [
        ...current,
        ...uploaded.map((document) => document.id),
      ]);
      showToast(`${uploaded.length}개 첨부자료를 업로드하고 선택했습니다`);
    }
    if (failedUploads.length > 0) {
      setError(`일부 파일을 업로드하지 못했습니다. ${failedUploads.join(" / ")}`);
    }
  }

  async function uploadMeetingNote(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!isSupportedUpload(file)) {
      setError(`'${file.name}'은(는) 지원하지 않습니다. PDF, DOCX, TXT, MD, CSV, JSON 파일을 선택해 주세요.`);
      return;
    }

    setError(null);
    setUploadingMeetingNote(true);
    try {
      const result = await uploadDocumentVersion(companyId, file, file.name);
      if (!result.ok || !result.documentId) {
        setError(result.ok ? "업로드한 회의록을 등록하지 못했습니다." : result.error);
        return;
      }
      const uploaded = {
        id: result.documentId,
        name: file.name,
        fileType: fileExtension(file.name),
        uploadedNow: true,
      } satisfies ReportSourceOption;
      setUploadedDocuments((current) => [...current, uploaded]);
      setMeetingNoteId(uploaded.id);
      setSupportingIds((current) => current.filter((id) => id !== uploaded.id));
      showToast("회의록을 업로드하고 선택했습니다");
    } catch (uploadFailure) {
      setError(
        uploadFailure instanceof Error
          ? `회의록 업로드 중 오류가 발생했습니다: ${uploadFailure.message}`
          : "회의록 업로드 중 오류가 발생했습니다.",
      );
    } finally {
      setUploadingMeetingNote(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supportingIds.length < 1 || supportingIds.length > 5) {
      setError("첨부자료를 1개 이상 5개 이하로 선택해 주세요.");
      return;
    }
    if (!meetingNoteId) {
      setError("회의록을 1개 선택해 주세요.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      setError(null);
      const result = await createMeetingReport(companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("전체본과 요약본 보고서 생성을 시작했습니다");
      router.refresh();
      window.setTimeout(() => router.refresh(), 3000);
    });
  }

  const uploading = uploadingSupporting || uploadingMeetingNote;

  return (
    <form className="report-create" onSubmit={submit}>
      <div className="report-create-intro">
        <b>회의자료와 회의록으로 보고서 만들기</b>
        <span>전체본과 요약본이 함께 생성되며, 생성 후 Google Drive 백업이 별도로 진행됩니다.</span>
      </div>
      {error ? (
        <div className="inline-error" role="alert">
          <IconAlert /> {error}
        </div>
      ) : null}
      <InputField
        label="보고서명"
        name="title"
        defaultValue={defaultTitle}
        required
      />
      <div className="report-source-grid">
        <fieldset className="report-source-fieldset">
          <legend className="sr-only">첨부자료 선택</legend>
          <div className="report-source-head">
            <span className="report-source-legend">첨부자료 ({supportingIds.length}/5)</span>
            <label
              className={`btn btn--secondary btn--sm report-upload-button${uploading || pending ? " is-disabled" : ""}`}
            >
              <IconPlus /> {uploadingSupporting ? "업로드 중" : "파일 추가"}
              <input
                className="sr-only"
                type="file"
                accept={REPORT_SOURCE_ACCEPT}
                multiple
                onChange={uploadSupporting}
                disabled={uploading || pending}
              />
            </label>
          </div>
          <div className="report-source-checklist">
            {sourceOptions.length === 0 ? (
              <span className="report-source-empty">기존 자료를 선택하거나 파일을 추가해 주세요.</span>
            ) : (
              sourceOptions.map((doc) => (
                <label className="report-source-option" key={doc.id}>
                  <input
                    type="checkbox"
                    name="company_info_document_ids"
                    value={doc.id}
                    checked={supportingIds.includes(doc.id)}
                    disabled={meetingNoteId === doc.id || uploading || pending}
                    onChange={(event) => toggleSupporting(doc.id, event.currentTarget.checked)}
                  />
                  <span className="file-type">{doc.fileType ?? "—"}</span>
                  <span>
                    {doc.name}
                    {doc.version ? ` (v${doc.version})` : ""}
                  </span>
                  {doc.uploadedNow ? <small>방금 업로드</small> : null}
                </label>
              ))
            )}
          </div>
          <small className="field-hint">회의록을 제외한 참고자료를 1~5개 선택합니다.</small>
        </fieldset>

        <fieldset className="report-source-fieldset">
          <legend className="sr-only">회의록 선택</legend>
          <div className="report-source-head">
            <label
              className="report-source-legend"
              htmlFor="meeting-note-document"
            >
              회의록 (1개)
            </label>
            <label
              className={`btn btn--secondary btn--sm report-upload-button${uploading || pending ? " is-disabled" : ""}`}
            >
              <IconPlus /> {uploadingMeetingNote ? "업로드 중" : "파일 추가"}
              <input
                className="sr-only"
                type="file"
                accept={REPORT_SOURCE_ACCEPT}
                onChange={uploadMeetingNote}
                disabled={uploading || pending}
              />
            </label>
          </div>
          <select
            id="meeting-note-document"
            name="meeting_note_document_id"
            className="input"
            value={meetingNoteId}
            onChange={(event) => setMeetingNoteId(event.currentTarget.value)}
            required
            disabled={uploading || pending}
          >
            <option value="">회의록 선택</option>
            {sourceOptions.map((doc) => (
              <option key={doc.id} value={doc.id} disabled={supportingIds.includes(doc.id)}>
                {doc.name}{doc.version ? ` (v${doc.version})` : ""}
              </option>
            ))}
          </select>
          <small className="field-hint">첨부자료와 다른 파일을 회의록으로 지정합니다.</small>
        </fieldset>
      </div>
      <div className="report-create-actions">
        <span>지원 형식: PDF, DOCX, TXT, MD, CSV, JSON</span>
        <Button type="submit" variant="cta" size="sm" disabled={pending || uploading}>
          <IconSparkle /> {pending ? "요청 중..." : "보고서 만들기"}
        </Button>
      </div>
    </form>
  );
}

function sourceLabel(report: MeetingReportRow): string {
  return report.sources
    .map((source) => `${ROLE_LABEL[source.role]}: ${source.documentName}`)
    .join(" / ");
}

function DriveConnectPrompt() {
  return (
    <div className="drive-connect-prompt report-drive-prompt">
      <IconLink />
      <div className="dcp-body">
        <b>Google Drive 자동 백업을 연결해 주세요.</b> 연결 전에도 보고서는 정상 생성되며,
        연결하면 미백업 전체본과 요약본도 자동으로 백업됩니다.
      </div>
      <a className="btn btn--secondary btn--sm" href="/app/settings?section=drive">
        연결하기
      </a>
    </div>
  );
}

export function MeetingReportsPanel({
  companyId,
  companyName,
  documents,
  reports,
  driveConnected,
  driveConfigured,
  showToast,
}: {
  companyId: string;
  companyName: string;
  documents: DocumentRow[];
  reports: MeetingReportRow[];
  driveConnected: boolean;
  driveConfigured: boolean;
  showToast: (message: string) => void;
}) {
  const sourceDocuments = useMemo(
    () => documents.filter((doc) => doc.reportSourceSupported),
    [documents],
  );

  return (
    <Panel className="meeting-reports-panel">
      <PanelHead
        title="미팅 보고서"
        count={reports.length > 0 ? `${reports.length}건` : undefined}
      />
      {driveConfigured && !driveConnected ? <DriveConnectPrompt /> : null}
      <ReportCreateForm
        companyId={companyId}
        companyName={companyName}
        documents={sourceDocuments}
        showToast={showToast}
      />
      {reports.length === 0 ? (
        <EmptyState
          bare
          icon={<IconFile />}
          title="생성된 미팅 보고서가 없습니다"
          description="첨부자료 1~5개와 회의록 1개를 선택하면 전체본과 요약본을 함께 만들 수 있습니다."
        />
      ) : (
        <div className="report-table-scroll">
          <table className="dlist dlist--cards report-table">
          <thead>
            <tr>
              <th>보고서명</th>
              <th>상태</th>
              <th>소스</th>
              <th>파일</th>
              <th>Google Drive</th>
              <th>생성일</th>
              <th className="r">관리</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="name" data-label="보고서명">
                  <div className="report-title-cell">
                    <span>{report.title}</span>
                    {report.summary ? <small>{report.summary}</small> : null}
                    {report.lastError ? <small className="report-error">{report.lastError}</small> : null}
                  </div>
                </td>
                <td data-label="상태">
                  <Badge tone={STATUS_TONE[report.status]}>
                    {STATUS_LABEL[report.status]}
                  </Badge>
                </td>
                <td data-label="소스" className="report-source-cell">
                  {sourceLabel(report) || <span className="cell-muted">—</span>}
                </td>
                <td data-label="파일">
                  <OutputFilesCell report={report} showToast={showToast} />
                </td>
                <td data-label="Google Drive">
                  <OutputDriveCell
                    companyId={companyId}
                    report={report}
                    driveConnected={driveConnected}
                    driveConfigured={driveConfigured}
                    showToast={showToast}
                  />
                </td>
                <td className="date num" data-label="생성일">
                  {formatKstShortDateTime(report.generatedAt ?? report.createdAt)}
                </td>
                <td className="r" data-label="관리">
                  <ReportStatusAction
                    companyId={companyId}
                    report={report}
                    showToast={showToast}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

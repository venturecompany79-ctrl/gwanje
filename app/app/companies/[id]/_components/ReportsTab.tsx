"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  IconAlert,
  IconDownload,
  IconFile,
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
  company_info: "회사정보",
  meeting_note: "회의록",
} as const;

function ReportDownloadButton({
  documentId,
  showToast,
}: {
  documentId: string | null;
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
      <IconDownload /> {pending ? "준비 중" : "열기"}
    </Button>
  );
}

function ReportActionCell({
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
  if (report.status === "succeeded") {
    return (
      <ReportDownloadButton
        documentId={report.outputDocumentId}
        showToast={showToast}
      />
    );
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => router.refresh()}>
      <IconRefresh /> 새로고침
    </Button>
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
  const defaultTitle = `${companyName} 미팅 진단 보고서`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(null);
      const result = await createMeetingReport(companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("보고서 생성을 시작했습니다");
      router.refresh();
      window.setTimeout(() => router.refresh(), 3000);
    });
  }

  return (
    <form className="report-create" onSubmit={submit}>
      {error ? (
        <div className="inline-error">
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
        <div className="field">
          <label htmlFor="company-info-document">회사정보 자료</label>
          <select
            id="company-info-document"
            name="company_info_document_id"
            className="input"
            required
            defaultValue=""
          >
            <option value="" disabled>
              선택
            </option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="meeting-note-document">회의록 자료</label>
          <select
            id="meeting-note-document"
            name="meeting_note_document_id"
            className="input"
            required
            defaultValue=""
          >
            <option value="" disabled>
              선택
            </option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="report-create-actions">
        <Button type="submit" variant="cta" size="sm" disabled={pending}>
          <IconSparkle /> {pending ? "요청 중..." : "보고서 생성"}
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

export function ReportsTab({
  companyId,
  companyName,
  documents,
  reports,
  showToast,
}: {
  companyId: string;
  companyName: string;
  documents: DocumentRow[];
  reports: MeetingReportRow[];
  showToast: (message: string) => void;
}) {
  const sourceDocuments = useMemo(
    () => documents.filter((doc) => doc.reportSourceSupported),
    [documents],
  );

  return (
    <Panel>
      <PanelHead
        title="보고서"
        count={reports.length > 0 ? `${reports.length}건` : undefined}
      />
      {sourceDocuments.length >= 2 ? (
        <ReportCreateForm
          companyId={companyId}
          companyName={companyName}
          documents={sourceDocuments}
          showToast={showToast}
        />
      ) : null}
      {reports.length === 0 ? (
        <EmptyState
          bare
          icon={<IconFile />}
          title="생성된 보고서가 없습니다"
          description="PDF, DOCX, TXT, MD, CSV, JSON 형식의 회사정보와 회의록 자료를 등록하면 미팅 진단 보고서를 만들 수 있습니다."
        />
      ) : (
        <table className="dlist dlist--cards report-table">
          <thead>
            <tr>
              <th>보고서명</th>
              <th>상태</th>
              <th>소스</th>
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
                <td className="date num" data-label="생성일">
                  {formatKstShortDateTime(report.generatedAt ?? report.createdAt)}
                </td>
                <td className="r" data-label="관리">
                  <ReportActionCell
                    companyId={companyId}
                    report={report}
                    showToast={showToast}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

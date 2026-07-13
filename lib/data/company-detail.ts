import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_DETAIL } from "@/lib/demo-data";
import { daysFromToday } from "@/lib/datetime";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import type { CompanyStatus } from "@/lib/labels";
import type {
  CredentialStatus,
  DocumentUploader,
  IpDeadlineType,
  IpRightKind,
  IpRightStatus,
  MeetingReportSourceRole,
  MeetingReportStatus,
  ScheduleType,
  TaskStage,
} from "@/lib/database.types";
import { isReportSourceSupported } from "@/lib/reports/file-types";
import type { ConsultantOption } from "@/lib/data/consultants";

// daysFromToday는 KST 기준 공용 헬퍼(lib/datetime). 보드 등에서 재사용하므로 재노출.
export { daysFromToday };

export interface CompanyProfile {
  id: string;
  name: string;
  bizNo: string | null;
  industry: string | null;
  businessCondition: string | null;
  region: string | null;
  foundedDate: string | null;
  revenue: number | null;
  headcount: number | null;
  ceoName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  conditionTags: string[];
  memo: string | null;
  primaryConsultantId: string | null;
  primaryConsultantName: string | null;
  /** 관리 상태 — active(관리중) / ended(종료) */
  status: CompanyStatus;
  contractStartDate: string | null;
  contractEndDate: string | null;
  /** 계약 종료일까지 남은 일수 (활성·계약종료일 있을 때만) */
  contractDaysLeft: number | null;
  endedAt: string | null;
  endedReason: string | null;
}

/** 자격에 명시 연결(credential_id)된 첨부 자료 — 기업 '자료' 탭의 document와 동일 행 */
export interface CredentialAttachment {
  id: string;
  name: string;
  fileType: string | null;
  sizeBytes: number | null;
}

export interface CredentialRow {
  id: string;
  type: string;
  categoryId: string | null;
  categoryName: string | null;
  issuedDate: string | null;
  expiresDate: string | null;
  renewLeadDays: number;
  /** 만료일 없으면 null */
  daysLeft: number | null;
  /** 만료일 없으면 null — deadline_item 뷰와 동일한 파생 규칙 */
  status: CredentialStatus | null;
  memo: string | null;
  /** 이 자격을 출처로 한 갱신 과제 존재 여부 */
  hasRenewalTask: boolean;
  /** 이 자격에 연결된 첨부 자료(최신순) */
  attachments: CredentialAttachment[];
}

/** 지식재산권에 명시 연결(ip_right_id)된 첨부 자료 — 기업 '자료' 탭의 document와 동일 행 */
export interface IpRightAttachment {
  id: string;
  name: string;
  fileType: string | null;
  sizeBytes: number | null;
}

export interface IpDeadlineRow {
  id: string;
  type: IpDeadlineType;
  title: string;
  dueDate: string;
  daysLeft: number;
  isDone: boolean;
  memo: string | null;
}

export interface IpRightRow {
  id: string;
  kind: IpRightKind;
  title: string;
  applicationNo: string | null;
  registrationNo: string | null;
  agentName: string | null;
  status: IpRightStatus;
  appliedDate: string | null;
  registeredDate: string | null;
  memo: string | null;
  deadlines: IpDeadlineRow[];
  nextDeadline: IpDeadlineRow | null;
  attachments: IpRightAttachment[];
}

export interface TaskRow {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  stage: TaskStage;
  dueDate: string | null;
  daysLeft: number | null;
  assigneeName: string | null;
  memo: string | null;
}

export interface ScheduleRow {
  id: string;
  title: string;
  date: string;
  daysLeft: number;
  type: ScheduleType;
  relatedTaskTitle: string | null;
}

/** Google Drive 동기화 상태 — google_drive_sync_jobs.status (잡 없으면 null) */
export type DriveSyncStatus = "pending" | "processing" | "succeeded" | "failed";

export interface DocumentDriveSync {
  status: DriveSyncStatus;
  /** 동기화 완료 시 Drive 파일 링크 */
  webViewLink: string | null;
}

export interface DocumentRow {
  id: string;
  name: string;
  docCategory: string | null;
  version: number;
  uploadedBy: DocumentUploader;
  credentialId?: string | null;
  ipRightId?: string | null;
  storageUrl?: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** 본인 Drive 연결 시 이 문서의 동기화 상태(잡 없으면 null — 연결 전 업로드분 등) */
  driveSync: DocumentDriveSync | null;
  /** AI 미팅 보고서 소스로 사용할 수 있는 텍스트 추출 지원 형식 */
  reportSourceSupported: boolean;
}

export interface MeetingReportSourceRow {
  role: MeetingReportSourceRole;
  documentId: string;
  documentName: string;
}

export interface MeetingReportRow {
  id: string;
  title: string;
  status: MeetingReportStatus;
  attempts: number;
  summary: string | null;
  lastError: string | null;
  /** 전체본 DOCX. 기존 outputDocument* 이름을 호환 필드로 유지한다. */
  outputDocumentId: string | null;
  outputDocumentName: string | null;
  outputDriveSync: DocumentDriveSync | null;
  /** 요약본 DOCX */
  summaryOutputDocumentId: string | null;
  summaryOutputDocumentName: string | null;
  summaryOutputDriveSync: DocumentDriveSync | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sources: MeetingReportSourceRow[];
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CompanyDetailData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  company: CompanyProfile;
  credentials: CredentialRow[];
  ipRights: IpRightRow[];
  tasks: TaskRow[];
  schedules: ScheduleRow[];
  documents: DocumentRow[];
  meetingReports: MeetingReportRow[];
  categories: CategoryOption[];
  /** 기업 주담당자로 지정 가능한 같은 테넌트의 활성 컨설턴트 */
  consultants: ConsultantOption[];
  /** 서버에 Google OAuth 환경변수가 갖춰졌는지 — false면 연결 유도 배너 숨김 */
  driveConfigured: boolean;
  /** 현재 사용자가 본인 Drive를 연결했는지 — 동기화 컬럼/배너 노출 분기 */
  driveConnected: boolean;
}

/** deadline_item 뷰와 동일한 자격 상태 파생 규칙 */
export function deriveCredentialStatus(
  daysLeft: number | null,
  renewLeadDays: number,
): CredentialStatus | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "expired";
  if (daysLeft <= renewLeadDays) return "expiring";
  return "valid";
}

const STAGE_SORT: Record<TaskStage, number> = {
  diagnosis: 0,
  proposal: 1,
  application: 2,
  result: 3,
};

function logRelatedQueryError(label: string, error: { message: string } | null) {
  if (!error) return;
  console.error(`[getCompanyDetail:${label}]`, error.message);
}

export async function getCompanyDetail(
  companyId: string,
): Promise<CompanyDetailData | null> {
  const supabase = await createClient();
  if (!supabase) return DEMO_COMPANY_DETAIL(companyId);

  const [
    company,
    credentials,
    ipRights,
    ipDeadlines,
    tasks,
    schedules,
    documents,
    reports,
    categories,
    profiles,
    connection,
  ] = await Promise.all([
      supabase
        .from("company")
        .select(
          "id, name, biz_no, industry, business_condition, region, founded_date, revenue, headcount, ceo_name, contact_name, contact_phone, contact_email, condition_tags, memo, primary_consultant_id, status, contract_start_date, contract_end_date, ended_at, ended_reason",
        )
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("credential")
        .select(
          "id, type, category_id, issued_date, expires_date, renew_lead_days, memo",
        )
        .eq("company_id", companyId),
      supabase
        .from("ip_right")
        .select(
          "id, kind, title, application_no, registration_no, agent_name, status, applied_date, registered_date, memo, created_at",
        )
        .eq("company_id", companyId),
      supabase
        .from("ip_deadline")
        .select("id, ip_right_id, type, title, due_date, is_done, memo")
        .eq("company_id", companyId),
      supabase
        .from("task")
        .select(
          "id, title, category_id, stage, due_date, assignee_id, memo, source_credential_id",
        )
        .eq("company_id", companyId),
      supabase
        .from("schedule")
        .select("id, title, date, type, related_task_id")
        .eq("company_id", companyId),
      supabase
        .from("document")
        .select(
          "id, name, doc_category, version, uploaded_by, storage_url, file_type, size_bytes, created_at, credential_id, ip_right_id",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("meeting_report")
        .select(
          "id, title, status, attempts, summary, last_error, output_document_id, summary_output_document_id, generated_at, created_at, updated_at",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase.from("category").select("id, name").order("sort_order"),
      supabase.from("profile").select("id, name, title, status"),
      // 본인 활성 Drive 연결 — RLS가 본인 행으로 한정하므로 user_id 필터 없이 조회(auth.getUser 호출 절약)
      supabase
        .from("google_drive_connections")
        .select("id")
        .is("revoked_at", null)
        .maybeSingle(),
    ]);

  // 잘못된 uuid 형식(22P02)은 '없는 기업'으로 처리 → 404
  if (company.error?.code === "22P02") return null;

  if (company.error) {
    throw new Error(`기업 정보를 불러오지 못했습니다: ${company.error.message}`);
  }
  if (!company.data) return null;

  logRelatedQueryError("credentials", credentials.error);
  logRelatedQueryError("ip_rights", ipRights.error);
  logRelatedQueryError("ip_deadlines", ipDeadlines.error);
  logRelatedQueryError("tasks", tasks.error);
  logRelatedQueryError("schedules", schedules.error);
  logRelatedQueryError("documents", documents.error);
  logRelatedQueryError("meeting_reports", reports.error);
  logRelatedQueryError("categories", categories.error);
  logRelatedQueryError("profiles", profiles.error);

  const credentialData = credentials.error ? [] : (credentials.data ?? []);
  const ipRightData = ipRights.error ? [] : (ipRights.data ?? []);
  const ipDeadlineData = ipDeadlines.error ? [] : (ipDeadlines.data ?? []);
  const taskData = tasks.error ? [] : (tasks.data ?? []);
  const scheduleData = schedules.error ? [] : (schedules.data ?? []);
  const documentData = documents.error ? [] : (documents.data ?? []);
  const reportData = reports.error ? [] : (reports.data ?? []);
  const categoryData = categories.error ? [] : (categories.data ?? []);
  const profileData = profiles.error ? [] : (profiles.data ?? []);

  const reportOutputDocumentIds = Array.from(
    new Set(
      reportData.flatMap((report) =>
        [report.output_document_id, report.summary_output_document_id].filter(
          (id): id is string => id !== null,
        ),
      ),
    ),
  );
  const documentIds = new Set(documentData.map((document) => document.id));
  const missingReportOutputIds = reportOutputDocumentIds.filter(
    (id) => !documentIds.has(id),
  );
  let missingReportOutputDocuments: { id: string; name: string }[] = [];
  if (missingReportOutputIds.length > 0) {
    const { data: outputDocuments, error: outputDocumentsError } = await supabase
      .from("document")
      .select("id, name")
      .eq("company_id", companyId)
      .in("id", missingReportOutputIds);
    logRelatedQueryError("meeting_report_output_documents", outputDocumentsError);
    missingReportOutputDocuments = outputDocumentsError
      ? []
      : (outputDocuments ?? []);
  }

  // 본인 Drive 연결 시, 일반 문서와 보고서 전체본/요약본의 동기화 잡을 함께 매핑한다.
  const driveConnected = Boolean(connection.data);
  const driveSyncByDoc = new Map<string, DocumentDriveSync>();
  const driveDocumentIds = Array.from(
    new Set([...documentData.map((document) => document.id), ...reportOutputDocumentIds]),
  );
  if (driveConnected && driveDocumentIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from("google_drive_sync_jobs")
      .select("document_id, status, google_drive_web_view_link")
      .in("document_id", driveDocumentIds);
    logRelatedQueryError("drive_sync_jobs", jobsError);
    for (const job of jobs ?? []) {
      driveSyncByDoc.set(job.document_id, {
        status: job.status as DriveSyncStatus,
        webViewLink: job.google_drive_web_view_link,
      });
    }
  }

  const categoryName = new Map(
    categoryData.map((c) => [c.id, c.name]),
  );
  const profileName = new Map(
    profileData.map((p) => [p.id, p.name]),
  );
  const taskTitle = new Map(taskData.map((t) => [t.id, t.title]));
  const documentName = new Map([
    ...documentData.map((document) => [document.id, document.name] as const),
    ...missingReportOutputDocuments.map(
      (document) => [document.id, document.name] as const,
    ),
  ]);
  // 자격별 첨부 자료 — documentData는 created_at desc 정렬이라 최신순으로 쌓인다.
  const attachmentsByCredential = new Map<string, CredentialAttachment[]>();
  const attachmentsByIpRight = new Map<string, IpRightAttachment[]>();
  for (const d of documentData) {
    if (d.credential_id) {
      const list = attachmentsByCredential.get(d.credential_id) ?? [];
      list.push({
        id: d.id,
        name: d.name,
        fileType: d.file_type,
        sizeBytes: d.size_bytes,
      });
      attachmentsByCredential.set(d.credential_id, list);
    }
    if (d.ip_right_id) {
      const list = attachmentsByIpRight.get(d.ip_right_id) ?? [];
      list.push({
        id: d.id,
        name: d.name,
        fileType: d.file_type,
        sizeBytes: d.size_bytes,
      });
      attachmentsByIpRight.set(d.ip_right_id, list);
    }
  }
  const renewalSources = new Set(
    taskData
      .map((t) => t.source_credential_id)
      .filter((id): id is string => id !== null),
  );

  const credentialRows: CredentialRow[] = credentialData
    .map((c) => {
      const daysLeft = c.expires_date ? daysFromToday(c.expires_date) : null;
      return {
        id: c.id,
        type: c.type,
        categoryId: c.category_id,
        categoryName: c.category_id
          ? (categoryName.get(c.category_id) ?? null)
          : null,
        issuedDate: c.issued_date,
        expiresDate: c.expires_date,
        renewLeadDays: c.renew_lead_days,
        daysLeft,
        status: deriveCredentialStatus(daysLeft, c.renew_lead_days),
        memo: c.memo,
        hasRenewalTask: renewalSources.has(c.id),
        attachments: attachmentsByCredential.get(c.id) ?? [],
      };
    })
    // 임박한 것 먼저, 만료일 없는 것 마지막
    .sort(
      (a, b) =>
        (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.daysLeft ?? Number.MAX_SAFE_INTEGER),
    );

  const deadlinesByIpRight = new Map<string, IpDeadlineRow[]>();
  for (const d of ipDeadlineData) {
    const list = deadlinesByIpRight.get(d.ip_right_id) ?? [];
    list.push({
      id: d.id,
      type: d.type,
      title: d.title,
      dueDate: d.due_date,
      daysLeft: daysFromToday(d.due_date),
      isDone: d.is_done,
      memo: d.memo,
    });
    deadlinesByIpRight.set(d.ip_right_id, list);
  }
  for (const list of deadlinesByIpRight.values()) {
    list.sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return a.daysLeft - b.daysLeft;
    });
  }

  const ipRightRows: IpRightRow[] = ipRightData
    .map((r) => {
      const deadlines = deadlinesByIpRight.get(r.id) ?? [];
      const nextDeadline = deadlines.find((d) => !d.isDone) ?? null;
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        applicationNo: r.application_no,
        registrationNo: r.registration_no,
        agentName: r.agent_name,
        status: r.status,
        appliedDate: r.applied_date,
        registeredDate: r.registered_date,
        memo: r.memo,
        deadlines,
        nextDeadline,
        attachments: attachmentsByIpRight.get(r.id) ?? [],
      };
    })
    .sort((a, b) => {
      const aDue = a.nextDeadline?.daysLeft ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.nextDeadline?.daysLeft ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return a.title.localeCompare(b.title, "ko");
    });

  const taskRows: TaskRow[] = taskData
    .map((t) => ({
      id: t.id,
      title: t.title,
      categoryId: t.category_id,
      categoryName: t.category_id
        ? (categoryName.get(t.category_id) ?? null)
        : null,
      stage: t.stage,
      dueDate: t.due_date,
      daysLeft: t.due_date ? daysFromToday(t.due_date) : null,
      assigneeName: t.assignee_id
        ? (profileName.get(t.assignee_id) ?? null)
        : null,
      memo: t.memo,
    }))
    // 진행 중(마감 임박순) 먼저, 결과(완료) 단계는 마지막
    .sort((a, b) => {
      const doneA = a.stage === "result" ? 1 : 0;
      const doneB = b.stage === "result" ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      if (doneA === 1) return STAGE_SORT[a.stage] - STAGE_SORT[b.stage];
      return (
        (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
      );
    });

  const scheduleRows: ScheduleRow[] = scheduleData
    .map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      daysLeft: daysFromToday(s.date),
      type: s.type,
      relatedTaskTitle: s.related_task_id
        ? (taskTitle.get(s.related_task_id) ?? null)
        : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sourcesByReport = new Map<string, MeetingReportSourceRow[]>();
  if (reportData.length > 0) {
    const { data: reportSources, error: reportSourceError } = await supabase
      .from("meeting_report_source")
      .select("report_id, role, document_id")
      .in(
        "report_id",
        reportData.map((r) => r.id),
      );
    logRelatedQueryError("meeting_report_sources", reportSourceError);
    for (const source of reportSources ?? []) {
      const list = sourcesByReport.get(source.report_id) ?? [];
      list.push({
        role: source.role,
        documentId: source.document_id,
        documentName: documentName.get(source.document_id) ?? "삭제된 자료",
      });
      sourcesByReport.set(source.report_id, list);
    }
  }

  return {
    demo: false,
    company: {
      id: company.data.id,
      name: company.data.name,
      bizNo: company.data.biz_no,
      industry: company.data.industry,
      businessCondition: company.data.business_condition,
      region: company.data.region,
      foundedDate: company.data.founded_date,
      revenue: company.data.revenue,
      headcount: company.data.headcount,
      ceoName: company.data.ceo_name,
      contactName: company.data.contact_name,
      contactPhone: company.data.contact_phone,
      contactEmail: company.data.contact_email,
      conditionTags: company.data.condition_tags ?? [],
      memo: company.data.memo,
      primaryConsultantId: company.data.primary_consultant_id,
      primaryConsultantName: company.data.primary_consultant_id
        ? (profileName.get(company.data.primary_consultant_id) ?? null)
        : null,
      status: (company.data.status as CompanyStatus) ?? "active",
      contractStartDate: company.data.contract_start_date,
      contractEndDate: company.data.contract_end_date,
      contractDaysLeft:
        company.data.status === "active" && company.data.contract_end_date
          ? daysFromToday(company.data.contract_end_date)
          : null,
      endedAt: company.data.ended_at,
      endedReason: company.data.ended_reason,
    },
    credentials: credentialRows,
    ipRights: ipRightRows,
    tasks: taskRows,
    schedules: scheduleRows,
    documents: documentData.map((d) => ({
      id: d.id,
      name: d.name,
      docCategory: d.doc_category,
      version: d.version,
      uploadedBy: d.uploaded_by,
      credentialId: d.credential_id,
      ipRightId: d.ip_right_id,
      storageUrl: d.storage_url,
      fileType: d.file_type,
      sizeBytes: d.size_bytes,
      createdAt: d.created_at,
      driveSync: driveSyncByDoc.get(d.id) ?? null,
      reportSourceSupported:
        d.doc_category !== "보고서" && isReportSourceSupported(d.file_type),
    })),
    meetingReports: reportData.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      attempts: r.attempts,
      summary: r.summary,
      lastError: r.last_error,
      outputDocumentId: r.output_document_id,
      outputDocumentName: r.output_document_id
        ? (documentName.get(r.output_document_id) ?? null)
        : null,
      outputDriveSync: r.output_document_id
        ? (driveSyncByDoc.get(r.output_document_id) ?? null)
        : null,
      summaryOutputDocumentId: r.summary_output_document_id,
      summaryOutputDocumentName: r.summary_output_document_id
        ? (documentName.get(r.summary_output_document_id) ?? null)
        : null,
      summaryOutputDriveSync: r.summary_output_document_id
        ? (driveSyncByDoc.get(r.summary_output_document_id) ?? null)
        : null,
      generatedAt: r.generated_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      sources: sourcesByReport.get(r.id) ?? [],
    })),
    categories: categoryData,
    consultants: profileData
      .filter((profile) => profile.status === "active")
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        title: profile.title,
      }))
      .sort((a, b) => {
        const name = a.name.localeCompare(b.name, "ko");
        return name !== 0 ? name : a.id.localeCompare(b.id);
      }),
    driveConfigured: isGoogleDriveConfigured(),
    driveConnected,
  };
}

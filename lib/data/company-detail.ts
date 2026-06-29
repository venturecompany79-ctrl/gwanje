import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_DETAIL } from "@/lib/demo-data";
import { daysFromToday } from "@/lib/datetime";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import type {
  CredentialStatus,
  DocumentUploader,
  ScheduleType,
  TaskStage,
} from "@/lib/database.types";

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
  storageUrl?: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** 본인 Drive 연결 시 이 문서의 동기화 상태(잡 없으면 null — 연결 전 업로드분 등) */
  driveSync: DocumentDriveSync | null;
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
  tasks: TaskRow[];
  schedules: ScheduleRow[];
  documents: DocumentRow[];
  categories: CategoryOption[];
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

  const [company, credentials, tasks, schedules, documents, categories, profiles, connection] =
    await Promise.all([
      supabase
        .from("company")
        .select(
          "id, name, biz_no, industry, business_condition, region, founded_date, revenue, headcount, ceo_name, contact_name, contact_phone, contact_email, condition_tags, memo",
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
          "id, name, doc_category, version, uploaded_by, storage_url, file_type, size_bytes, created_at",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase.from("category").select("id, name").order("sort_order"),
      supabase.from("profile").select("id, name"),
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
  logRelatedQueryError("tasks", tasks.error);
  logRelatedQueryError("schedules", schedules.error);
  logRelatedQueryError("documents", documents.error);
  logRelatedQueryError("categories", categories.error);
  logRelatedQueryError("profiles", profiles.error);

  const credentialData = credentials.error ? [] : (credentials.data ?? []);
  const taskData = tasks.error ? [] : (tasks.data ?? []);
  const scheduleData = schedules.error ? [] : (schedules.data ?? []);
  const documentData = documents.error ? [] : (documents.data ?? []);
  const categoryData = categories.error ? [] : (categories.data ?? []);
  const profileData = profiles.error ? [] : (profiles.data ?? []);

  // 본인 Drive 연결 시, 이 회사 문서들의 동기화 잡 상태를 문서별로 매핑(RLS로 본인 잡만).
  const driveConnected = Boolean(connection.data);
  const driveSyncByDoc = new Map<string, DocumentDriveSync>();
  if (driveConnected && documentData.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from("google_drive_sync_jobs")
      .select("document_id, status, google_drive_web_view_link")
      .in(
        "document_id",
        documentData.map((d) => d.id),
      );
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
      };
    })
    // 임박한 것 먼저, 만료일 없는 것 마지막
    .sort(
      (a, b) =>
        (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.daysLeft ?? Number.MAX_SAFE_INTEGER),
    );

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
    },
    credentials: credentialRows,
    tasks: taskRows,
    schedules: scheduleRows,
    documents: documentData.map((d) => ({
      id: d.id,
      name: d.name,
      docCategory: d.doc_category,
      version: d.version,
      uploadedBy: d.uploaded_by,
      storageUrl: d.storage_url,
      fileType: d.file_type,
      sizeBytes: d.size_bytes,
      createdAt: d.created_at,
      driveSync: driveSyncByDoc.get(d.id) ?? null,
    })),
    categories: categoryData,
    driveConfigured: isGoogleDriveConfigured(),
    driveConnected,
  };
}

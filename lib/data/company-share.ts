// 기업별 공유 대시보드 데이터 레이어.
// ⚠️ service role 사용 파일 — 공개 페이지는 인증 세션이 없어 RLS를 탈 수 없다.
//    tenant_id/company_id는 반드시 share 행(getShareByToken)에서만 도출하고,
//    요청 파라미터의 companyId를 직접 신뢰하지 않는다.
//    service client로 task/company를 조회하는 코드는 이 파일 밖에 두지 말 것.
import { createServiceClient } from "@/lib/supabase/service";
import { DEMO_CATEGORY_COLORS } from "@/lib/data/categoryColors";
import { DEMO_COMPANY_DETAIL } from "@/lib/demo-data";
import { daysFromToday } from "@/lib/datetime";
import { TASK_STAGE_ORDER, type CompanyStatus } from "@/lib/labels";
import type { Supabase } from "@/lib/actions/shared";
import type { TaskStage } from "@/lib/database.types";

export interface ShareGateInfo {
  id: string;
  tenantId: string;
  companyId: string;
  token: string;
  enabled: boolean;
  hasPassword: boolean;
  sessionVersion: number;
  failedAttempts: number;
  /** ISO — 이 시각 전까지 비밀번호 입력 잠금 */
  lockedUntil: string | null;
}

export interface SharedTaskRow {
  id: string;
  title: string;
  categoryName: string | null;
  stage: TaskStage;
  dueDate: string | null;
  daysLeft: number | null;
  updatedAt: string;
}

export interface SharedDashboardData {
  demo: boolean;
  companyName: string;
  industry: string | null;
  ceoName: string | null;
  status: CompanyStatus;
  tasks: SharedTaskRow[];
  kpi: {
    total: number;
    inProgress: number;
    done: number;
    progressPct: number;
    byStage: Record<TaskStage, number>;
  };
  /** updated_at 최신순 상위 5건 */
  recentUpdates: SharedTaskRow[];
  /** 카테고리 칩 색 주입용 — 색이 지정된 카테고리만 */
  categoryColors: { name: string; color: string }[];
  /** ISO — 화면 "기준 시각" 표기용 */
  generatedAt: string;
}

/** 토큰으로 공유 설정 조회 — tenant/company 스코프의 유일한 출처. */
export async function getShareByToken(
  token: string,
): Promise<ShareGateInfo | null> {
  const service = createServiceClient();
  if (!service) return null;

  const { data, error } = await service
    .from("company_share")
    .select(
      "id, tenant_id, company_id, token, enabled, password_hash, session_version, failed_attempts, locked_until",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[getShareByToken]", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    tenantId: data.tenant_id,
    companyId: data.company_id,
    token: data.token,
    enabled: data.enabled,
    hasPassword: data.password_hash !== null,
    sessionVersion: data.session_version,
    failedAttempts: data.failed_attempts,
    lockedUntil: data.locked_until,
  };
}

function buildKpi(tasks: SharedTaskRow[]): SharedDashboardData["kpi"] {
  const byStage = Object.fromEntries(
    TASK_STAGE_ORDER.map((s) => [s, 0]),
  ) as Record<TaskStage, number>;
  for (const t of tasks) byStage[t.stage] += 1;
  const total = tasks.length;
  const done = byStage.result;
  return {
    total,
    inProgress: total - done,
    done,
    progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    byStage,
  };
}

function sortSharedTasks(tasks: SharedTaskRow[]): SharedTaskRow[] {
  // 진행 중(마감 임박순) 먼저, 완료(결과)는 최근 업데이트순으로 마지막
  // — 기업 상세 Task 탭과 동일 규칙(완료 구간만 결정적 정렬로 보강)
  return [...tasks].sort((a, b) => {
    const doneA = a.stage === "result" ? 1 : 0;
    const doneB = b.stage === "result" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    if (doneA === 1) return b.updatedAt.localeCompare(a.updatedAt);
    return (
      (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
      (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

function buildDashboard(
  demo: boolean,
  company: {
    name: string;
    industry: string | null;
    ceoName: string | null;
    status: CompanyStatus;
  },
  /** updated_at 최신순으로 정렬된 rows */
  tasksByRecency: SharedTaskRow[],
  categoryColors: { name: string; color: string }[],
): SharedDashboardData {
  return {
    demo,
    companyName: company.name,
    industry: company.industry,
    ceoName: company.ceoName,
    status: company.status,
    tasks: sortSharedTasks(tasksByRecency),
    kpi: buildKpi(tasksByRecency),
    recentUpdates: tasksByRecency.slice(0, 5),
    categoryColors,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 공유 대시보드 데이터 — service role 조회.
 * 노출 필드 화이트리스트: task의 memo(내부 메모)·assignee는 select에서 제외하고,
 * 자격/일정/문서/IP 등 다른 테이블은 조회하지 않는다.
 */
export async function getSharedDashboard(
  share: ShareGateInfo,
): Promise<SharedDashboardData | null> {
  const service = createServiceClient();
  if (!service) return null;

  const [company, tasks, categories] = await Promise.all([
    service
      .from("company")
      .select("name, industry, ceo_name, status")
      .eq("tenant_id", share.tenantId)
      .eq("id", share.companyId)
      .maybeSingle(),
    service
      .from("task")
      .select("id, title, category_id, stage, due_date, updated_at")
      .eq("tenant_id", share.tenantId)
      .eq("company_id", share.companyId)
      .order("updated_at", { ascending: false }),
    service
      .from("category")
      .select("id, name, color")
      .eq("tenant_id", share.tenantId),
  ]);

  if (company.error || !company.data) {
    if (company.error) console.error("[getSharedDashboard]", company.error.message);
    return null;
  }
  if (tasks.error) {
    console.error("[getSharedDashboard:tasks]", tasks.error.message);
    return null;
  }

  const categoryData = categories.error ? [] : (categories.data ?? []);
  const categoryName = new Map(categoryData.map((c) => [c.id, c.name]));
  const categoryColors = categoryData
    .filter((c): c is typeof c & { color: string } => c.color !== null)
    .map((c) => ({ name: c.name, color: c.color }));

  const rows: SharedTaskRow[] = (tasks.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    categoryName: t.category_id
      ? (categoryName.get(t.category_id) ?? null)
      : null,
    stage: t.stage,
    dueDate: t.due_date,
    daysLeft: t.due_date ? daysFromToday(t.due_date) : null,
    updatedAt: t.updated_at,
  }));

  return buildDashboard(
    false,
    {
      name: company.data.name,
      industry: company.data.industry,
      ceoName: company.data.ceo_name,
      status: (company.data.status as CompanyStatus) ?? "active",
    },
    rows,
    categoryColors,
  );
}

/** 데모 모드(.env 없음) — 테크노바 기업 상세 데모의 task를 재매핑. */
export function getDemoSharedDashboard(): SharedDashboardData {
  const detail = DEMO_COMPANY_DETAIL("00000000-0000-0000-0000-0000000000c1");
  const tasks: SharedTaskRow[] = (detail?.tasks ?? []).map((t, i) => ({
    id: t.id,
    title: t.title,
    categoryName: t.categoryName,
    stage: t.stage,
    dueDate: t.dueDate,
    daysLeft: t.daysLeft,
    // 데모 데이터에는 updated_at이 없어 순서 기반 가짜 시각 생성(최신순 유지)
    updatedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }));
  return buildDashboard(
    true,
    {
      name: detail?.company.name ?? "(주)테크노바",
      industry: detail?.company.industry ?? "정보통신업",
      ceoName: detail?.company.ceoName ?? null,
      status: detail?.company.status ?? "active",
    },
    tasks,
    DEMO_CATEGORY_COLORS,
  );
}

export interface CompanyShareSettings {
  token: string;
  enabled: boolean;
  hasPassword: boolean;
  rotatedAt: string | null;
  createdAt: string;
}

/** 컨설턴트용 공유 설정 조회 — authenticated client(RLS 경유). */
export async function getCompanyShareSettings(
  supabase: Supabase,
  companyId: string,
): Promise<CompanyShareSettings | null> {
  const { data, error } = await supabase
    .from("company_share")
    .select("token, enabled, password_hash, rotated_at, created_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[getCompanyShareSettings]", error.message);
    return null;
  }
  if (!data) return null;

  return {
    token: data.token,
    enabled: data.enabled,
    hasPassword: data.password_hash !== null,
    rotatedAt: data.rotated_at,
    createdAt: data.created_at,
  };
}

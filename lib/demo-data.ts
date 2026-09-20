// Supabase env 미설정 시 화면 확인용 데모 데이터 (와이어프레임 시나리오와 동일).
// 날짜는 오늘 기준 상대값으로 생성해 D-day가 항상 자연스럽게 보인다.
import type {
  DeadlineItem,
  IpDeadlineType,
  TaskStage,
  TaskWorkStatus,
} from "@/lib/database.types";
import type { DashboardData } from "@/lib/data/dashboard";
import type { CompaniesData, CompanyListRow } from "@/lib/data/companies";
import type {
  CategoryOption,
  CompanyDetailData,
  CredentialRow,
  IpRightRow,
} from "@/lib/data/company-detail";
import type { BoardData, BoardTask } from "@/lib/data/board";
import type {
  CampaignDetailData,
  CampaignsData,
  RecipientRow,
  SegmentCompaniesData,
} from "@/lib/data/campaigns";
import type {
  RawNotification,
  RawNotificationsData,
} from "@/lib/data/notifications";
import type { NotificationType } from "@/lib/database.types";
import type { SettingsData } from "@/lib/data/settings";
import { DEMO_CONSULTANTS } from "@/lib/data/consultants";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000000";

function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateTimeAfter(days: number, time: string): string {
  return `${dateAfter(days)}T${time}:00`;
}

function demoDeadline(
  n: number,
  companyName: string,
  title: string,
  categoryName: string,
  daysLeft: number,
  source: DeadlineItem["source"],
  status: DeadlineItem["status"],
): DeadlineItem {
  return {
    source,
    id: `00000000-0000-0000-0000-00000000000${n}`,
    tenant_id: DEMO_TENANT,
    company_id: `00000000-0000-0000-0000-0000000000c${n}`,
    company_name: companyName,
    title,
    category_id: null,
    category_name: categoryName,
    due_date: dateAfter(daysLeft),
    days_left: daysLeft,
    status,
  };
}

export function DEMO_DASHBOARD(
  filter: "due7" | "expire30" | null = null,
): DashboardData {
  const allDeadlines = [
    demoDeadline(1, "(주)테크노바", "벤처기업확인 만료", "벤처기업확인", 2, "credential", "expiring"),
    demoDeadline(2, "한빛정밀", "R&D 세액공제 신청마감", "세액공제", 5, "task", "application"),
    demoDeadline(3, "그린에너지솔루션", "기업부설연구소 갱신", "기업부설연구소", 7, "credential", "expiring"),
    demoDeadline(4, "메디케어랩", "정책자금 상환일", "정책자금", 9, "task", "application"),
    demoDeadline(5, "스마트팩토리(주)", "이노비즈 인증 갱신", "정부지원사업", 14, "credential", "expiring"),
    demoDeadline(6, "블루오션테크", "디딤돌 과제 중간보고", "정부지원사업", 21, "task", "diagnosis"),
  ];
  const deadlines =
    filter === "due7"
      ? allDeadlines.filter((d) => d.days_left <= 7)
      : filter === "expire30"
        ? allDeadlines.filter(
            (d) => d.source === "credential" && d.days_left <= 30,
          )
        : allDeadlines;
  return {
    demo: true,
    kpi: { companyCount: 14, due7: 5, expire30: 3, activeTasks: 22 },
    deadlines,
    overdue: [
      demoDeadline(7, "메디케어랩", "벤처기업확인 만료", "벤처기업확인", -12, "credential", "expired"),
    ],
    alerts: [
      {
        id: "demo-a1",
        type: "expiry",
        urgent: true,
        title: "테크노바 벤처확인 D-2",
        sub: "만료 임박 · 갱신 과제 생성 필요",
        timeAgo: "방금",
        companyId: "00000000-0000-0000-0000-0000000000c1",
        refTable: "credential",
        refId: "00000000-0000-0000-0000-0000000000d1",
      },
      {
        id: "demo-a2",
        type: "deadline",
        urgent: false,
        title: "한빛정밀 자료 미제출",
        sub: "세액공제 증빙 서류 요청 중",
        timeAgo: "1시간",
        companyId: "00000000-0000-0000-0000-0000000000c2",
        refTable: "task",
        refId: "00000000-0000-0000-0000-0000000000t2",
      },
      {
        id: "demo-a3",
        type: "expiry",
        urgent: false,
        title: "그린에너지솔루션 갱신 D-7",
        sub: "기업부설연구소 갱신 마감 주의",
        timeAgo: "3시간",
        companyId: "00000000-0000-0000-0000-0000000000c3",
        refTable: "credential",
        refId: "00000000-0000-0000-0000-0000000000d3",
      },
    ],
    files: [
      {
        id: "demo-f1",
        fileType: "pdf",
        name: "사업자등록증.pdf",
        companyId: "00000000-0000-0000-0000-0000000000c4",
        companyName: "메디케어랩",
        when: "09:24",
      },
      {
        id: "demo-f2",
        fileType: "xls",
        name: "재무제표_2025.xlsx",
        companyId: "00000000-0000-0000-0000-0000000000c5",
        companyName: "스마트팩토리(주)",
        when: "어제 18:40",
      },
    ],
    unreadCount: 3,
  };
}

function demoCompany(
  n: number,
  name: string,
  industry: string,
  foundedDate: string,
  revenue: number,
  headcount: number,
  conditionTags: string[],
  credentialTypes: string[],
  nearestDaysLeft: number | null,
  upcomingCount: number,
  expiredCount: number,
  createdDaysAgo: number,
): CompanyListRow {
  // 데모 "외 N건" 툴팁용 — nearest부터 7일 간격으로 임박 항목을 합성 (GWJ-020)
  const upcomingItems =
    nearestDaysLeft === null
      ? []
      : Array.from({ length: upcomingCount }, (_, i) => ({
          source: i === 0 ? ("task" as const) : ("credential" as const),
          title: credentialTypes[i]
            ? `${credentialTypes[i]} 갱신`
            : "다가오는 마감",
          daysLeft: nearestDaysLeft + i * 7,
        }));
  const companyId = `00000000-0000-0000-0000-0000000000c${n}`;
  const companyTasks = DEMO_TASKS().filter((task) => task.companyId === companyId);
  const activeTasks = companyTasks.filter(
    (task) => task.workStatus !== "completed",
  );
  const priorityTask =
    [...activeTasks].sort((a, b) => {
      const overdueA = a.daysLeft !== null && a.daysLeft < 0 ? 0 : 1;
      const overdueB = b.daysLeft !== null && b.daysLeft < 0 ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      const holdA = a.workStatus === "on_hold" ? 0 : 1;
      const holdB = b.workStatus === "on_hold" ? 0 : 1;
      if (holdA !== holdB) return holdA - holdB;
      return (
        (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
      );
    })[0] ?? null;
  return {
    id: companyId,
    name,
    industry,
    foundedDate,
    revenue,
    headcount,
    conditionTags,
    createdAt: dateAfter(-createdDaysAgo),
    primaryConsultantId: DEMO_CONSULTANTS[0].id,
    primaryConsultantName: DEMO_CONSULTANTS[0].name,
    status: "active",
    contractEndDate: null,
    contractDaysLeft: null,
    endedAt: null,
    endedReason: null,
    credentialTypes,
    nearestDaysLeft,
    upcomingCount,
    upcomingItems,
    expiredCount,
    activeTaskCount: activeTasks.length,
    overdueTaskCount: activeTasks.filter(
      (task) => task.daysLeft !== null && task.daysLeft < 0,
    ).length,
    due7TaskCount: activeTasks.filter(
      (task) =>
        task.daysLeft !== null && task.daysLeft >= 0 && task.daysLeft <= 7,
    ).length,
    unassignedTaskCount: activeTasks.filter(
      (task) => task.assigneeName === null,
    ).length,
    stageCounts: {
      diagnosis: activeTasks.filter((task) => task.stage === "diagnosis").length,
      proposal: activeTasks.filter((task) => task.stage === "proposal").length,
      application: activeTasks.filter((task) => task.stage === "application").length,
      result: activeTasks.filter((task) => task.stage === "result").length,
    },
    workStatusCounts: {
      planned: companyTasks.filter((task) => task.workStatus === "planned").length,
      in_progress: companyTasks.filter(
        (task) => task.workStatus === "in_progress",
      ).length,
      waiting: companyTasks.filter((task) => task.workStatus === "waiting").length,
      on_hold: companyTasks.filter((task) => task.workStatus === "on_hold").length,
      completed: companyTasks.filter(
        (task) => task.workStatus === "completed",
      ).length,
    },
    priorityTask: priorityTask
      ? {
          id: priorityTask.id,
          title: priorityTask.title,
          categoryId: priorityTask.categoryId,
          categoryName: priorityTask.categoryName,
          stage: priorityTask.stage,
          workStatus: priorityTask.workStatus,
          dueDate: priorityTask.dueDate,
          daysLeft: priorityTask.daysLeft,
          assigneeId: DEMO_CONSULTANTS[0].id,
          assigneeName: priorityTask.assigneeName,
          updatedAt: priorityTask.updatedAt,
        }
      : null,
    latestTaskUpdatedAt:
      companyTasks
        .map((task) => task.updatedAt)
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
  };
}

export const DEMO_CATEGORIES: CategoryOption[] = [
  { id: "00000000-0000-0000-0000-0000000000a1", name: "정부지원사업" },
  { id: "00000000-0000-0000-0000-0000000000a2", name: "벤처기업확인" },
  { id: "00000000-0000-0000-0000-0000000000a3", name: "기업부설연구소" },
  { id: "00000000-0000-0000-0000-0000000000a4", name: "세액공제" },
  { id: "00000000-0000-0000-0000-0000000000a5", name: "정책자금" },
];

function demoCredential(
  n: number,
  type: string,
  categoryIdx: number | null,
  issuedDate: string | null,
  expiresInDays: number | null,
  renewLeadDays: number,
  hasRenewalTask: boolean,
): CredentialRow {
  const daysLeft = expiresInDays;
  return {
    id: `00000000-0000-0000-0000-0000000000d${n}`,
    type,
    categoryId: categoryIdx === null ? null : DEMO_CATEGORIES[categoryIdx].id,
    categoryName:
      categoryIdx === null ? null : DEMO_CATEGORIES[categoryIdx].name,
    issuedDate,
    expiresDate: expiresInDays === null ? null : dateAfter(expiresInDays),
    renewLeadDays,
    daysLeft,
    status:
      daysLeft === null
        ? null
        : daysLeft < 0
          ? "expired"
          : daysLeft <= renewLeadDays
            ? "expiring"
            : "valid",
    memo: null,
    hasRenewalTask,
    attachments: [],
  };
}

function demoIpRight(
  n: number,
  kind: IpRightRow["kind"],
  title: string,
  status: IpRightRow["status"],
  deadlineTitle: string | null,
  deadlineType: IpDeadlineType,
  deadlineInDays: number | null,
): IpRightRow {
  const deadline =
    deadlineTitle && deadlineInDays !== null
      ? {
          id: `00000000-0000-0000-0000-0000000000i${n}`,
          type: deadlineType,
          title: deadlineTitle,
          dueDate: dateAfter(deadlineInDays),
          daysLeft: deadlineInDays,
          isDone: false,
          memo: null,
        }
      : null;
  return {
    id: `00000000-0000-0000-0000-0000000000p${n}`,
    kind,
    title,
    applicationNo: kind === "patent" ? `10-2026-000${n}234` : `40-2026-000${n}234`,
    registrationNo: status === "registered" ? `${kind === "patent" ? "10" : "40"}-234${n}567` : null,
    agentName: "김변리사",
    status,
    appliedDate: dateAfter(-120 - n * 12),
    registeredDate: status === "registered" ? dateAfter(-30) : null,
    memo: null,
    deadlines: deadline ? [deadline] : [],
    nextDeadline: deadline,
    attachments: [],
  };
}

function demoTask(
  n: number,
  companyN: number,
  companyName: string,
  title: string,
  categoryIdx: number | null,
  stage: TaskStage,
  dueInDays: number | null,
  memo: string | null,
): BoardTask {
  const workStatus: TaskWorkStatus =
    stage === "result"
      ? "completed"
      : n === 2
        ? "waiting"
        : n === 7
          ? "on_hold"
          : n === 9
            ? "planned"
            : "in_progress";
  return {
    id: `00000000-0000-0000-0000-0000000000e${n}`,
    title,
    categoryId: categoryIdx === null ? null : DEMO_CATEGORIES[categoryIdx].id,
    categoryName:
      categoryIdx === null ? null : DEMO_CATEGORIES[categoryIdx].name,
    stage,
    workStatus,
    dueDate: dueInDays === null ? null : dateAfter(dueInDays),
    daysLeft: dueInDays,
    assigneeId: DEMO_CONSULTANTS[0].id,
    assigneeName: "김컨설턴트",
    memo,
    updatedAt: dateTimeAfter(-Math.min(n, 6), `${9 + (n % 8)}`.padStart(2, "0") + ":20"),
    companyId: `00000000-0000-0000-0000-0000000000c${companyN}`,
    companyName,
  };
}

// 전 기업 공용 과제 풀 — 보드 칸반과 기업 상세 관리포인트 탭이 같은 데이터를 본다.
// c7(누리푸드)은 빈 상태 확인용으로 과제 없음.
function DEMO_TASKS(): BoardTask[] {
  return [
    demoTask(
      1, 1, "(주)테크노바", "벤처기업확인 갱신", 1, "application", 2,
      "벤처기업확인 유효기간 만료 임박. 갱신 신청서·재무제표 준비 완료, 제출 예정.",
    ),
    demoTask(2, 1, "(주)테크노바", "디딤돌 R&D 과제 신청", 0, "proposal", 18, null),
    demoTask(3, 1, "(주)테크노바", "R&D 세액공제 경정청구", 3, "diagnosis", 40, null),
    demoTask(4, 1, "(주)테크노바", "정책자금(운전) 신청", 4, "result", -10, "한도 5억 승인 완료."),
    demoTask(5, 2, "한빛정밀", "R&D 세액공제 신청", 3, "application", 5, null),
    demoTask(6, 3, "그린에너지솔루션", "기업부설연구소 갱신", 2, "application", 7, null),
    demoTask(7, 4, "메디케어랩", "정책자금(운전) 신청검토", 4, "diagnosis", 12, null),
    demoTask(8, 5, "스마트팩토리(주)", "이노비즈 인증 갱신", 0, "proposal", 14, null),
    demoTask(9, 6, "블루오션테크", "창업도약패키지 지원", 0, "proposal", 21, null),
    demoTask(10, 8, "대성물류", "AEO 인증 갱신", 0, "result", -25, "갱신 심사 통과."),
  ];
}

export function DEMO_BOARD(): BoardData {
  return {
    demo: true,
    tasks: DEMO_TASKS(),
    companies: DEMO_COMPANIES().companies.map((co) => ({
      id: co.id,
      name: co.name,
    })),
    categories: DEMO_CATEGORIES,
    canWriteTasks: true,
    currentProfileId: DEMO_CONSULTANTS[0].id,
    canViewTeam: true,
    consultants: DEMO_CONSULTANTS,
  };
}

// 기업 상세 데모 — (주)테크노바(c1)는 와이어프레임 시나리오 풀 세트,
// 그 외 기업은 목록 데이터와 일치하는 자격만 (탭별 빈 상태 확인용)
export function DEMO_COMPANY_DETAIL(id: string): CompanyDetailData | null {
  const base = DEMO_COMPANIES().companies.find((co) => co.id === id);
  if (!base) return null;

  const isTechnova = id.endsWith("c1");
  const company = {
    id: base.id,
    name: base.name,
    bizNo: isTechnova ? "123-45-67890" : null,
    industry: base.industry,
    businessCondition: isTechnova ? "정보통신업" : null,
    region: isTechnova ? "서울특별시 강남구" : null,
    foundedDate: base.foundedDate,
    revenue: base.revenue,
    headcount: base.headcount,
    ceoName: isTechnova ? "김도현" : null,
    contactName: isTechnova ? "박지훈" : null,
    contactPhone: isTechnova ? "010-1234-5678" : null,
    contactEmail: isTechnova ? "jihoon@technova.co.kr" : null,
    conditionTags: base.conditionTags,
    memo: isTechnova
      ? "벤처확인 갱신이 최우선. 2026년 디딤돌 R&D 신규 과제 희망."
      : null,
    primaryConsultantId: DEMO_CONSULTANTS[0].id,
    primaryConsultantName: DEMO_CONSULTANTS[0].name,
    status: base.status,
    contractStartDate: base.contractEndDate ? dateAfter(-365) : null,
    contractEndDate: base.contractEndDate,
    contractDaysLeft: base.contractDaysLeft,
    endedAt: base.endedAt,
    endedReason: base.endedReason,
  };

  const companyTasks = DEMO_TASKS().filter((t) => t.companyId === id);

  if (!isTechnova) {
    // 목록의 credentialTypes·nearestDaysLeft·expiredCount와 일치하도록 생성
    const nearest = base.nearestDaysLeft ?? 200;
    const credentials = base.credentialTypes.map((type, i) =>
      demoCredential(
        i + 1,
        type,
        i % DEMO_CATEGORIES.length,
        dateAfter(-(365 * 2 + i * 90)),
        base.expiredCount > 0 && i === 0 ? -30 : nearest + i * 90,
        60,
        false,
      ),
    );
    return {
      demo: true,
      canWriteTasks: true,
      company,
      credentials,
      ipRights: [],
      tasks: companyTasks,
      schedules: [],
      documents: [],
      meetingReports: [],
      categories: DEMO_CATEGORIES,
      consultants: DEMO_CONSULTANTS,
      driveConfigured: false,
      driveConnected: false,
    };
  }

  return {
    demo: true,
    canWriteTasks: true,
    company,
    credentials: [
      demoCredential(1, "벤처기업확인", 1, "2023-06-13", 2, 60, true),
      demoCredential(2, "기업부설연구소", 2, "2022-09-01", 83, 60, false),
      demoCredential(3, "연구개발 세액공제", 3, "2025-03-01", -102, 30, false),
      demoCredential(4, "이노비즈 인증", 0, "2024-07-20", 771, 90, false),
    ],
    ipRights: [
      demoIpRight(
        1,
        "patent",
        "AI 기반 기업지원사업 매칭 방법",
        "examining",
        "의견제출통지 대응",
        "office_action",
        6,
      ),
      demoIpRight(
        2,
        "trademark",
        "관제",
        "registered",
        "상표권 갱신 준비",
        "renewal",
        48,
      ),
    ],
    tasks: companyTasks,
    schedules: [
      {
        id: "00000000-0000-0000-0000-0000000000f1",
        title: "벤처확인 갱신 서류 제출",
        date: dateAfter(2),
        daysLeft: 2,
        type: "deadline",
        relatedTaskTitle: "벤처기업확인 갱신",
      },
      {
        id: "00000000-0000-0000-0000-0000000000f2",
        title: "디딤돌 과제 사전 미팅",
        date: dateAfter(7),
        daysLeft: 7,
        type: "meeting",
        relatedTaskTitle: "디딤돌 R&D 과제 신청",
      },
      {
        id: "00000000-0000-0000-0000-0000000000f3",
        title: "기업부설연구소 갱신",
        date: dateAfter(83),
        daysLeft: 83,
        type: "renewal",
        relatedTaskTitle: null,
      },
    ],
    documents: [
      {
        id: "00000000-0000-0000-0000-0000000000g1",
        name: "벤처확인_갱신신청서_v2.pdf",
        docCategory: "인증",
        version: 2,
        uploadedBy: "consultant",
        fileType: "pdf",
        sizeBytes: 1_258_291,
        createdAt: dateAfter(-1),
        driveSync: null,
        reportSourceSupported: true,
      },
      {
        id: "00000000-0000-0000-0000-0000000000g2",
        name: "재무제표_2025.xlsx",
        docCategory: "재무",
        version: 1,
        uploadedBy: "client",
        fileType: "xlsx",
        sizeBytes: 482_304,
        createdAt: dateAfter(-3),
        driveSync: null,
        reportSourceSupported: false,
      },
      {
        id: "00000000-0000-0000-0000-0000000000g3",
        name: "사업자등록증.pdf",
        docCategory: "기본",
        version: 1,
        uploadedBy: "client",
        fileType: "pdf",
        sizeBytes: 210_835,
        createdAt: dateAfter(-120),
        driveSync: null,
        reportSourceSupported: true,
      },
    ],
    meetingReports: [],
    categories: DEMO_CATEGORIES,
    consultants: DEMO_CONSULTANTS,
    driveConfigured: false,
    driveConnected: false,
  };
}

// ---- 일괄안내(캠페인) 데모 — 세그먼트·집계는 기존 8개사 풀 재사용 ----

export function DEMO_SEGMENT_COMPANIES(): SegmentCompaniesData {
  return {
    demo: true,
    companies: DEMO_COMPANIES().companies.map((co) => ({
      id: co.id,
      name: co.name,
      industry: co.industry,
      revenue: co.revenue,
      conditionTags: co.conditionTags,
      credentialTypes: co.credentialTypes,
      nearestDaysLeft: co.nearestDaysLeft,
      // 기업 상세 데모와 동일 — 담당자 연락처는 테크노바만 보유
      contactName: co.id.endsWith("c1") ? "박지훈" : null,
      contactPhone: co.id.endsWith("c1") ? "010-1234-5678" : null,
    })),
  };
}

function demoRecipient(
  n: number,
  companyN: number,
  companyName: string,
  delivered: boolean,
  responseNote: string | null,
  respondedAt: string | null,
): RecipientRow {
  return {
    id: `00000000-0000-0000-0000-0000000000r${n}`,
    companyId: `00000000-0000-0000-0000-0000000000c${companyN}`,
    companyName,
    delivered,
    status: delivered ? "delivered" : "sent",
    errorMessage: null,
    responded: responseNote !== null,
    responseNote,
    respondedAt,
  };
}

// 캠페인 4종: 발송완료 2 + 예약 1 + 임시저장 1 (목록 상태 배지 3종 확인용)
const CAMPAIGN_IDS = {
  renewal: "00000000-0000-0000-0000-0000000000b1",
  taxCredit: "00000000-0000-0000-0000-0000000000b2",
  didimdol: "00000000-0000-0000-0000-0000000000b3",
  fund: "00000000-0000-0000-0000-0000000000b4",
};

export function DEMO_CAMPAIGNS(): CampaignsData {
  return {
    demo: true,
    hasMore: false,
    campaigns: [
      {
        id: CAMPAIGN_IDS.renewal,
        title: "만료 임박 자격 갱신 안내",
        status: "sent",
        segmentSummary: "마감 30일 이내",
        recipientCount: 6,
        sentAt: dateTimeAfter(-7, "10:00"),
        scheduledAt: null,
        responseRate: 67,
        failedCount: 0,
      },
      {
        id: CAMPAIGN_IDS.taxCredit,
        title: "R&D 세액공제 마감 리마인드",
        status: "sent",
        segmentSummary: "벤처기업확인 보유",
        recipientCount: 2,
        sentAt: dateTimeAfter(-10, "14:00"),
        scheduledAt: null,
        responseRate: 50,
        failedCount: 0,
      },
      {
        id: CAMPAIGN_IDS.didimdol,
        title: "디딤돌 과제 공고 안내",
        status: "scheduled",
        segmentSummary: "컨디션=성장기",
        recipientCount: 3,
        sentAt: null,
        scheduledAt: dateTimeAfter(3, "09:00"),
        responseRate: null,
        failedCount: 0,
      },
      {
        id: CAMPAIGN_IDS.fund,
        title: "정책자금 신규상품 안내",
        status: "draft",
        segmentSummary: null,
        recipientCount: null,
        sentAt: null,
        scheduledAt: null,
        responseRate: null,
        failedCount: 0,
      },
    ],
  };
}

export function DEMO_CAMPAIGN_DETAIL(id: string): CampaignDetailData | null {
  const row = DEMO_CAMPAIGNS().campaigns.find((c) => c.id === id);
  if (!row) return null;

  const recipientsById: Record<string, RecipientRow[]> = {
    [CAMPAIGN_IDS.renewal]: [
      demoRecipient(1, 1, "(주)테크노바", true, "확인했습니다, 진행 부탁드려요", dateTimeAfter(-7, "10:12")),
      demoRecipient(2, 2, "한빛정밀", true, "일정 가능합니다", dateTimeAfter(-7, "11:40")),
      demoRecipient(3, 3, "그린에너지솔루션", true, "자료 준비 중", dateTimeAfter(-7, "14:03")),
      demoRecipient(4, 6, "블루오션테크", true, "참여하겠습니다", dateTimeAfter(-6, "09:25")),
      demoRecipient(5, 4, "메디케어랩", true, null, null),
      demoRecipient(6, 5, "스마트팩토리(주)", false, null, null),
    ],
    [CAMPAIGN_IDS.taxCredit]: [
      demoRecipient(7, 1, "(주)테크노바", true, "서류 송부했습니다", dateTimeAfter(-10, "15:20")),
      demoRecipient(8, 4, "메디케어랩", true, null, null),
    ],
    [CAMPAIGN_IDS.didimdol]: [
      demoRecipient(9, 1, "(주)테크노바", false, null, null),
      demoRecipient(10, 3, "그린에너지솔루션", false, null, null),
      demoRecipient(11, 6, "블루오션테크", false, null, null),
    ],
    [CAMPAIGN_IDS.fund]: [],
  };

  return {
    demo: true,
    campaign: {
      id: row.id,
      title: row.title,
      body:
        row.status === "draft"
          ? null
          : "안녕하세요 {기업명} {담당자명}님,\n보유하신 자격·인증의 유효기간 만료가 다가옵니다.\n갱신 신청 절차를 안내드리니 아래 버튼에서 확인 부탁드립니다.\n\n— 관제 by Growth Partners",
      channel: "alimtalk",
      status: row.status,
      segmentSummary: row.segmentSummary,
      sentAt: row.sentAt,
      scheduledAt: row.scheduledAt,
    },
    recipients: recipientsById[id] ?? [],
  };
}

// ---- 알림 센터 데모 — 와이어프레임 시나리오 9건 (안읽음 3 = 셸 배지와 일치) ----

function demoNotification(
  n: number,
  type: NotificationType,
  urgent: boolean,
  read: boolean,
  title: string,
  companyN: number,
  companyName: string,
  daysLeft: number | null,
  createdDaysAgo: number,
  time: string,
): RawNotification {
  return {
    id: `00000000-0000-0000-0000-0000000000n${n}`,
    type,
    title,
    isUrgent: urgent,
    isRead: read,
    companyId: `00000000-0000-0000-0000-0000000000c${companyN}`,
    companyName,
    refTable: type === "expiry" ? "credential" : type === "deadline" ? "task" : null,
    refId: null,
    daysLeft,
    createdAt: dateTimeAfter(-createdDaysAgo, time),
  };
}

export function DEMO_NOTIFICATIONS(): RawNotificationsData {
  return {
    demo: true,
    notifications: [
      // 오늘 — 안읽음 3 + 읽음 1
      demoNotification(1, "expiry", true, false, "벤처기업확인 만료", 1, "(주)테크노바", 2, 0, "09:12"),
      demoNotification(2, "deadline", true, false, "기업부설연구소 설립 신청", 4, "메디케어랩", 3, 0, "09:12"),
      demoNotification(3, "program_match", false, false, "'창업도약패키지' 공고가 매칭됨", 6, "블루오션테크", null, 0, "08:40"),
      demoNotification(4, "deadline", false, true, "R&D 세액공제 신청", 2, "한빛정밀", 5, 0, "08:40"),
      // 어제
      demoNotification(5, "expiry", false, true, "기업부설연구소 갱신", 3, "그린에너지솔루션", 7, 1, "17:30"),
      demoNotification(6, "deadline", false, true, "디딤돌 R&D 과제 중간보고", 3, "그린에너지솔루션", 18, 1, "11:05"),
      demoNotification(7, "program_match", false, true, "'소재부품 기술개발' 공고가 매칭됨", 2, "한빛정밀", null, 1, "10:20"),
      // 이전
      demoNotification(8, "deadline", false, true, "이노비즈 인증 갱신", 5, "스마트팩토리(주)", 14, 4, "15:40"),
      demoNotification(9, "expiry", false, true, "정책자금 상환일", 4, "메디케어랩", 9, 5, "10:00"),
    ],
    companies: DEMO_COMPANIES().companies.map((co) => ({
      id: co.id,
      name: co.name,
    })),
  };
}

// seed.sql 시나리오와 동일한 6개사 + 상태 다양성용 2개사(자격 없음 / 임박 없음)
export function DEMO_COMPANIES(): CompaniesData {
  return {
    demo: true,
    hasMore: false,
    currentProfileId: DEMO_CONSULTANTS[0].id,
    canViewTeam: true,
    canWriteTasks: true,
    consultants: DEMO_CONSULTANTS,
    categories: DEMO_CATEGORIES,
    companies: [
      demoCompany(1, "(주)테크노바", "IT·소프트웨어", "2019-03-12", 4_200_000_000, 28, ["성장기"], ["벤처기업확인"], 2, 2, 0, 120),
      demoCompany(2, "한빛정밀", "정밀기계 제조", "2012-07-01", 18_500_000_000, 64, ["성숙기"], ["ISO 9001"], 5, 3, 0, 300),
      demoCompany(3, "그린에너지솔루션", "신재생에너지", "2017-11-20", 7_800_000_000, 35, ["성장기"], ["기업부설연구소"], 4, 3, 0, 200),
      demoCompany(4, "메디케어랩", "바이오·헬스케어", "2020-05-08", 2_100_000_000, 17, ["초기"], ["벤처기업확인"], 9, 1, 1, 60),
      demoCompany(5, "스마트팩토리(주)", "스마트제조", "2015-01-15", 12_300_000_000, 52, ["성숙기"], ["이노비즈 인증"], 14, 2, 0, 250),
      demoCompany(6, "블루오션테크", "해양플랜트", "2018-09-03", 5_600_000_000, 31, ["성장기"], [], 21, 1, 0, 90),
      demoCompany(7, "누리푸드", "식품 제조", "2021-02-18", 900_000_000, 9, ["초기"], [], null, 0, 0, 14),
      demoCompany(8, "대성물류", "물류·운송", "2008-04-22", 34_000_000_000, 120, ["성숙기"], ["ISO 9001", "ISO 14001", "AEO 인증"], 45, 1, 0, 400),
    ],
  };
}

// 설정 — 셸(getShellData) 데모 프로필과 동일 인물 기준
export function DEMO_SETTINGS(): SettingsData {
  return {
    demo: true,
    profile: {
      name: "김컨설턴트",
      title: "경영컨설턴트",
      phone: "010-2345-6789",
      email: "kim@growthpartners.co.kr",
      senderName: "관제 by Growth Partners",
      senderPhone: "1666-0000",
      notifyLeadDays: [7, 3],
      notifyChannels: ["email", "alimtalk"],
      notifyMatch: true,
      dailySummaryAt: "09:00",
    },
    categories: DEMO_CATEGORIES.map((c, i) => ({
      id: c.id,
      name: c.name,
      color: null,
      sortOrder: i + 1,
    })),
    drive: { configured: false, connection: null, failedCount: 0 },
    alimtalk: {
      configured: false,
      connected: false,
      connection: null,
      templates: [],
    },
    currentMember: {
      id: "00000000-0000-0000-0000-0000000000u1",
      role: "owner",
      permissions: [
        "companies.read",
        "companies.write",
        "tasks.read",
        "tasks.write",
        "campaigns.read",
        "campaigns.write",
        "notifications.read",
        "settings.categories.write",
        "settings.rules.write",
        "settings.drive.write",
        "billing.manage",
      ],
      status: "active",
      canManageTeam: true,
    },
    teamMembers: [
      {
        id: "00000000-0000-0000-0000-0000000000u1",
        name: "김컨설턴트",
        title: "대표 컨설턴트",
        email: "kim@growthpartners.co.kr",
        role: "owner",
        permissions: [
          "companies.read",
          "companies.write",
          "tasks.read",
          "tasks.write",
          "campaigns.read",
          "campaigns.write",
          "notifications.read",
          "settings.categories.write",
          "settings.rules.write",
          "settings.drive.write",
          "billing.manage",
        ],
        status: "active",
        invitedAt: dateTimeAfter(-20, "09:00"),
        acceptedAt: dateTimeAfter(-20, "09:10"),
        disabledAt: null,
        isCurrentUser: true,
      },
      {
        id: "00000000-0000-0000-0000-0000000000u2",
        name: "박매니저",
        title: "선임 컨설턴트",
        email: "manager@growthpartners.co.kr",
        role: "manager",
        permissions: [
          "companies.read",
          "companies.write",
          "tasks.read",
          "tasks.write",
          "campaigns.read",
          "campaigns.write",
          "notifications.read",
          "settings.categories.write",
          "settings.rules.write",
        ],
        status: "active",
        invitedAt: dateTimeAfter(-8, "11:00"),
        acceptedAt: dateTimeAfter(-8, "11:20"),
        disabledAt: null,
        isCurrentUser: false,
      },
      {
        id: "00000000-0000-0000-0000-0000000000u3",
        name: "이팀원",
        title: "주니어 컨설턴트",
        email: "member@growthpartners.co.kr",
        role: "member",
        permissions: [
          "companies.read",
          "tasks.read",
          "tasks.write",
          "notifications.read",
        ],
        status: "invited",
        invitedAt: dateTimeAfter(-1, "15:00"),
        acceptedAt: null,
        disabledAt: null,
        isCurrentUser: false,
      },
    ],
  };
}

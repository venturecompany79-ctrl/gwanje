// Supabase env 미설정 시 화면 확인용 데모 데이터 (와이어프레임 시나리오와 동일).
// 날짜는 오늘 기준 상대값으로 생성해 D-day가 항상 자연스럽게 보인다.
import type { DeadlineItem, TaskStage } from "@/lib/database.types";
import type { DashboardData } from "@/lib/data/dashboard";
import type { CompaniesData, CompanyListRow } from "@/lib/data/companies";
import type {
  CategoryOption,
  CompanyDetailData,
  CredentialRow,
} from "@/lib/data/company-detail";
import type { BoardData, BoardTask } from "@/lib/data/board";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000000";

function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function demoDeadline(
  n: number,
  companyName: string,
  title: string,
  categoryName: string,
  daysLeft: number,
  source: DeadlineItem["source"],
  status: string,
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

export function DEMO_DASHBOARD(): DashboardData {
  return {
    demo: true,
    kpi: { companyCount: 14, due7: 5, expire30: 3, activeTasks: 22 },
    deadlines: [
      demoDeadline(1, "(주)테크노바", "벤처기업확인 만료", "벤처기업확인", 2, "credential", "expiring"),
      demoDeadline(2, "한빛정밀", "R&D 세액공제 신청마감", "세액공제", 5, "task", "application"),
      demoDeadline(3, "그린에너지솔루션", "기업부설연구소 갱신", "기업부설연구소", 7, "credential", "expiring"),
      demoDeadline(4, "메디케어랩", "정책자금 상환일", "정책자금", 9, "task", "application"),
      demoDeadline(5, "스마트팩토리(주)", "이노비즈 인증 갱신", "정부지원사업", 14, "credential", "expiring"),
      demoDeadline(6, "블루오션테크", "디딤돌 과제 중간보고", "정부지원사업", 21, "task", "diagnosis"),
    ],
    alerts: [
      {
        id: "demo-a1",
        type: "expiry",
        urgent: true,
        title: "테크노바 벤처확인 D-2",
        sub: "만료 임박 · 갱신 과제 생성 필요",
        timeAgo: "방금",
      },
      {
        id: "demo-a2",
        type: "deadline",
        urgent: false,
        title: "한빛정밀 자료 미제출",
        sub: "세액공제 증빙 서류 요청 중",
        timeAgo: "1시간",
      },
      {
        id: "demo-a3",
        type: "expiry",
        urgent: false,
        title: "그린에너지솔루션 갱신 D-7",
        sub: "기업부설연구소 갱신 마감 주의",
        timeAgo: "3시간",
      },
    ],
    files: [
      {
        id: "demo-f1",
        fileType: "pdf",
        name: "사업자등록증.pdf",
        companyName: "메디케어랩",
        when: "09:24",
      },
      {
        id: "demo-f2",
        fileType: "xls",
        name: "재무제표_2025.xlsx",
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
  return {
    id: `00000000-0000-0000-0000-0000000000c${n}`,
    name,
    industry,
    foundedDate,
    revenue,
    headcount,
    conditionTags,
    createdAt: dateAfter(-createdDaysAgo),
    credentialTypes,
    nearestDaysLeft,
    upcomingCount,
    expiredCount,
  };
}

const DEMO_CATEGORIES: CategoryOption[] = [
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
    hasRenewalTask,
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
  return {
    id: `00000000-0000-0000-0000-0000000000e${n}`,
    title,
    categoryId: categoryIdx === null ? null : DEMO_CATEGORIES[categoryIdx].id,
    categoryName:
      categoryIdx === null ? null : DEMO_CATEGORIES[categoryIdx].name,
    stage,
    dueDate: dueInDays === null ? null : dateAfter(dueInDays),
    daysLeft: dueInDays,
    assigneeName: "김컨설턴트",
    memo,
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
      company,
      credentials,
      tasks: companyTasks,
      schedules: [],
      documents: [],
      categories: DEMO_CATEGORIES,
    };
  }

  return {
    demo: true,
    company,
    credentials: [
      demoCredential(1, "벤처기업확인", 1, "2023-06-13", 2, 60, true),
      demoCredential(2, "기업부설연구소", 2, "2022-09-01", 83, 60, false),
      demoCredential(3, "연구개발 세액공제", 3, "2025-03-01", -102, 30, false),
      demoCredential(4, "이노비즈 인증", 0, "2024-07-20", 771, 90, false),
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
      },
    ],
    categories: DEMO_CATEGORIES,
  };
}

// seed.sql 시나리오와 동일한 6개사 + 상태 다양성용 2개사(자격 없음 / 임박 없음)
export function DEMO_COMPANIES(): CompaniesData {
  return {
    demo: true,
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

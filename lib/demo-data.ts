// Supabase env 미설정 시 화면 확인용 데모 데이터 (와이어프레임 시나리오와 동일).
// 날짜는 오늘 기준 상대값으로 생성해 D-day가 항상 자연스럽게 보인다.
import type { DeadlineItem } from "@/lib/database.types";
import type { DashboardData } from "@/lib/data/dashboard";
import type { CompaniesData, CompanyListRow } from "@/lib/data/companies";

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

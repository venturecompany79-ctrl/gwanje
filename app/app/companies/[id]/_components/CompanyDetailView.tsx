"use client";

import { useCallback, useState } from "react";
import { Toast, useToast } from "@/components/ui/Toast";
import { formatRevenue } from "@/lib/format";
import type { CompanyDetailData, CompanyProfile } from "@/lib/data/company-detail";
import { CertsTab } from "./CertsTab";
import { TasksTab } from "./TasksTab";
import { ScheduleTab, FilesTab } from "./ScheduleFilesTabs";
import { EditCompanyButton } from "./EditCompanySlideOver";
import { OverviewTab } from "./OverviewTab";

type TabKey = "overview" | "cert" | "tasks" | "schedule" | "files";

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "개요/프로파일" },
  { key: "cert", label: "자격·인증" },
  { key: "tasks", label: "과제" },
  { key: "schedule", label: "일정" },
  { key: "files", label: "자료" },
];

// ?tab= 별칭 — 자연스러운 표기(docs)도 허용 (GWJ-012)
const TAB_ALIASES: Record<string, TabKey> = { docs: "files" };

function resolveTab(value: string): TabKey {
  if (TAB_DEFS.some((t) => t.key === value)) return value as TabKey;
  return TAB_ALIASES[value] ?? "overview";
}

function CompanyHeader({
  company,
  demo,
  showToast,
}: {
  company: CompanyProfile;
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const stats: [string, string][] = [
    ["설립", company.foundedDate ? company.foundedDate.slice(0, 4) : "—"],
    ["매출", formatRevenue(company.revenue)],
    ["인원", company.headcount !== null ? `${company.headcount}명` : "—"],
    ["대표", company.ceoName ?? "—"],
  ];
  return (
    <div className="co-header">
      <div className="co-top">
        <div className="co-id">
          <h1>{company.name}</h1>
          {company.industry ? (
            <span className="ind">{company.industry}</span>
          ) : null}
          {company.conditionTags.map((tag) => (
            <span key={tag} className="cond">
              <span className="gd" />
              {tag}
            </span>
          ))}
        </div>
        <div className="spacer" />
        <EditCompanyButton company={company} demo={demo} showToast={showToast} />
      </div>
      <div className="co-summary">
        {stats.map(([k, v]) => (
          <div key={k} className="stat">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyDetailView({
  data,
  initialTab,
}: {
  data: CompanyDetailData;
  initialTab: string;
}) {
  const [tab, setTab] = useState<TabKey>(() => resolveTab(initialTab));
  const { toast, showToast } = useToast();
  const company = data.company;

  // 탭 전환 시 데이터는 이미 모두 로드돼 있으므로 즉시 전환하고,
  // URL ?tab= 만 갱신해 새로고침·공유 시 상태를 복원한다 (GWJ-012, 보드와 동일하게 URL 보존)
  const selectTab = useCallback(
    (key: TabKey) => {
      setTab(key);
      const url =
        key === "overview"
          ? `/app/companies/${company.id}`
          : `/app/companies/${company.id}?tab=${key}`;
      window.history.replaceState(null, "", url);
    },
    [company.id],
  );

  return (
    <>
      <CompanyHeader company={company} demo={data.demo} showToast={showToast} />

      <div className="tabs" role="tablist" aria-label="기업 상세 탭">
        {TAB_DEFS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`pill-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => selectTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        {/* 추천 — Phase2 자리만 (CLAUDE.md 11절) */}
        <button type="button" className="pill-tab" disabled>
          추천
          <span className="tab-badge">Phase2 준비 중</span>
        </button>
      </div>

      {tab === "overview" ? <OverviewTab company={company} /> : null}
      {tab === "cert" ? (
        <CertsTab
          companyId={company.id}
          credentials={data.credentials}
          categories={data.categories}
          demo={data.demo}
          showToast={showToast}
        />
      ) : null}
      {tab === "tasks" ? (
        <TasksTab
          companyId={company.id}
          tasks={data.tasks}
          categories={data.categories}
          demo={data.demo}
          showToast={showToast}
        />
      ) : null}
      {tab === "schedule" ? <ScheduleTab schedules={data.schedules} /> : null}
      {tab === "files" ? (
        <FilesTab companyId={company.id} documents={data.documents} />
      ) : null}

      <Toast message={toast} />
    </>
  );
}

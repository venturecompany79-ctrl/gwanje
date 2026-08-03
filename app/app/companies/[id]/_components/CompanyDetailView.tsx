"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Toast, useToast } from "@/components/ui/Toast";
import { formatRevenue } from "@/lib/format";
import type { CompanyDetailData, CompanyProfile } from "@/lib/data/company-detail";
import type { CompanyShareSettings } from "@/lib/data/company-share";
import { ShareSettingsButton } from "./ShareSettingsSlideOver";
import { EditCompanyButton } from "./EditCompanySlideOver";
import {
  EndCompanyButton,
  EndedCompanyBanner,
} from "./CompanyLifecycleControls";
import { OverviewTab } from "./OverviewTab";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { IconSparkle } from "@/components/ui/icons";

function TabLoading({ title }: { title: string }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      <div className="panel-loading">불러오는 중...</div>
    </div>
  );
}

const CertsTab = dynamic(
  () => import("./CertsTab").then((mod) => mod.CertsTab),
  { loading: () => <TabLoading title="자격·인증" /> },
);

const IpTab = dynamic(() => import("./IpTab").then((mod) => mod.IpTab), {
  loading: () => <TabLoading title="특허·상표" />,
});

const TasksTab = dynamic(
  () => import("./TasksTab").then((mod) => mod.TasksTab),
  { loading: () => <TabLoading title="Task" /> },
);

const ScheduleTab = dynamic(
  () => import("./ScheduleFilesTabs").then((mod) => mod.ScheduleTab),
  { loading: () => <TabLoading title="일정" /> },
);

const FilesTab = dynamic(
  () => import("./ScheduleFilesTabs").then((mod) => mod.FilesTab),
  { loading: () => <TabLoading title="자료" /> },
);

type TabKey =
  | "overview"
  | "cert"
  | "ip"
  | "tasks"
  | "schedule"
  | "files";

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "개요/프로파일" },
  { key: "cert", label: "자격·인증" },
  { key: "ip", label: "특허·상표" },
  { key: "tasks", label: "Task" },
  { key: "schedule", label: "일정" },
  { key: "files", label: "자료" },
];

// ?tab= 별칭 — 자연스러운 표기(docs)도 허용 (GWJ-012)
const TAB_ALIASES: Record<string, TabKey> = {
  docs: "files",
  reports: "overview",
};

function resolveTab(value: string): TabKey {
  if (TAB_DEFS.some((t) => t.key === value)) return value as TabKey;
  return TAB_ALIASES[value] ?? "overview";
}

function CompanyHeader({
  company,
  consultants,
  demo,
  showToast,
  share,
  shareConfigured,
}: {
  company: CompanyProfile;
  consultants: CompanyDetailData["consultants"];
  demo: boolean;
  showToast: (message: string) => void;
  share: CompanyShareSettings | null;
  shareConfigured: boolean;
}) {
  const isEnded = company.status === "ended";
  const contractDays = company.contractDaysLeft;
  const stats: [string, string][] = [
    ["설립", company.foundedDate ? company.foundedDate.slice(0, 4) : "—"],
    ["매출", formatRevenue(company.revenue)],
    ["인원", company.headcount !== null ? `${company.headcount}명` : "—"],
    ["대표", company.ceoName ?? "—"],
    ["주담당", company.primaryConsultantName ?? "미배정"],
  ];
  return (
    <div className="co-header">
      <div className="co-top">
        <div className="co-id">
          <h1>{company.name}</h1>
          {isEnded ? <Badge tone="neutral">종료</Badge> : null}
          {!isEnded && contractDays !== null ? (
            <Badge tone={contractDays < 0 ? "critical" : contractDays <= 30 ? "attention" : "neutral"}>
              {contractDays < 0
                ? `계약만료 D+${-contractDays}`
                : `계약 ${contractDays === 0 ? "D-day" : `D-${contractDays}`}`}
            </Badge>
          ) : null}
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
        <LinkButton
          variant="cta"
          size="sm"
          href={`/app/companies/${company.id}/gov-programs`}
        >
          <IconSparkle /> 맞춤 지원사업
        </LinkButton>
        <ShareSettingsButton
          companyId={company.id}
          share={share}
          shareConfigured={shareConfigured}
          demo={demo}
          showToast={showToast}
        />
        <EditCompanyButton
          company={company}
          consultants={consultants}
          demo={demo}
          showToast={showToast}
        />
        {isEnded ? null : (
          <EndCompanyButton company={company} demo={demo} showToast={showToast} />
        )}
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
  share,
  shareConfigured,
}: {
  data: CompanyDetailData;
  initialTab: string;
  share: CompanyShareSettings | null;
  shareConfigured: boolean;
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
      <CompanyHeader
        company={company}
        consultants={data.consultants}
        demo={data.demo}
        showToast={showToast}
        share={share}
        shareConfigured={shareConfigured}
      />

      {company.status === "ended" ? (
        <EndedCompanyBanner
          company={company}
          demo={data.demo}
          showToast={showToast}
        />
      ) : null}

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
      </div>

      {tab === "overview" ? (
        <OverviewTab
          company={company}
          documents={data.documents}
          reports={data.meetingReports}
          driveConnected={data.driveConnected}
          driveConfigured={data.driveConfigured}
          showToast={showToast}
        />
      ) : null}
      {tab === "cert" ? (
        <CertsTab
          companyId={company.id}
          credentials={data.credentials}
          categories={data.categories}
          demo={data.demo}
          showToast={showToast}
        />
      ) : null}
      {tab === "ip" ? (
        <IpTab
          companyId={company.id}
          ipRights={data.ipRights}
          demo={data.demo}
          showToast={showToast}
        />
      ) : null}
      {tab === "tasks" ? (
        <TasksTab
          companyId={company.id}
          companyName={company.name}
          tasks={data.tasks}
          categories={data.categories}
          demo={data.demo}
          canWriteTasks={data.canWriteTasks}
          companyStatus={company.status}
          showToast={showToast}
        />
      ) : null}
      {tab === "schedule" ? (
        <ScheduleTab
          companyId={company.id}
          schedules={data.schedules}
          demo={data.demo}
          showToast={showToast}
        />
      ) : null}
      {tab === "files" ? (
        <FilesTab
          companyId={company.id}
          documents={data.documents}
          driveConnected={data.driveConnected}
          driveConfigured={data.driveConfigured}
          showToast={showToast}
        />
      ) : null}
      <Toast message={toast} />
    </>
  );
}

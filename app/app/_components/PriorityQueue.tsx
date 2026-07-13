"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import {
  IconAlert,
  IconCheck,
  IconKanban,
  IconList,
} from "@/components/ui/icons";
import type {
  DashboardQueueFilter,
  DashboardQueueItem,
  DashboardScope,
} from "@/lib/data/dashboard";

type SourceFilter = "all" | DashboardQueueItem["source"];

const RISK_OPTIONS: Array<{ value: DashboardQueueFilter; label: string }> = [
  { value: "all", label: "전체 위험" },
  { value: "overdue", label: "기한 지남" },
  { value: "due7", label: "7일 내 마감" },
  { value: "unassigned", label: "미배정 과제" },
  { value: "active", label: "진행 중 과제" },
];

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "전체 업무 유형" },
  { value: "task", label: "과제" },
  { value: "credential", label: "자격·인증" },
  { value: "schedule", label: "일정" },
  { value: "ip_deadline", label: "지식재산" },
];

const SOURCE_LABEL: Record<DashboardQueueItem["source"], string> = {
  task: "과제",
  credential: "자격·인증",
  schedule: "일정",
  ip_deadline: "지식재산",
};

const SEVERITY_LABEL: Record<DashboardQueueItem["severity"], string> = {
  critical: "긴급",
  warning: "주의",
  attention: "확인",
  neutral: "일반",
};

function SeverityBadge({ severity }: { severity: DashboardQueueItem["severity"] }) {
  return (
    <span className={`monitor-severity monitor-severity--${severity}`}>
      {severity === "neutral" ? <IconCheck /> : <IconAlert />}
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function Assignee({ name, unassignedLabel }: { name: string | null; unassignedLabel: string }) {
  if (!name) {
    return <span className="monitor-unassigned">{unassignedLabel}</span>;
  }
  return (
    <span className="monitor-person">
      <span className="avatar" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <span>{name}</span>
    </span>
  );
}

export function PriorityQueue({
  items,
  scope,
  queueFilter,
  consultantId,
  consultants,
}: {
  items: DashboardQueueItem[];
  scope: DashboardScope;
  queueFilter: DashboardQueueFilter;
  consultantId: string | "unassigned" | null;
  consultants: Array<{ id: string; name: string; title: string | null }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const visibleItems = useMemo(
    () =>
      sourceFilter === "all"
        ? items
        : items.filter((item) => item.source === sourceFilter),
    [items, sourceFilter],
  );

  function updateQuery(key: "risk" | "consultant", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("due");
    next.delete("expire");
    if (value === "all" || value === "") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`/app?${next.toString()}`, { scroll: false }));
  }

  return (
    <section className="panel monitor-queue" aria-labelledby="priority-queue-title">
      <header className="monitor-section-head">
        <div className="monitor-section-title">
          <span className="monitor-section-icon monitor-section-icon--critical">
            <IconList />
          </span>
          <div>
            <h2 id="priority-queue-title">우선 처리 큐</h2>
            <p>위험도와 기한을 기준으로 지금 조치할 업무를 정렬했습니다.</p>
          </div>
        </div>
        <div className="monitor-section-actions">
          <span className="monitor-count num" aria-live="polite">
            {visibleItems.length}건
          </span>
          <Link href="/app/board" className="monitor-board-link">
            <IconKanban /> Task 보드
          </Link>
        </div>
      </header>

      <div className="monitor-filter-bar" aria-busy={isPending}>
        <label>
          <span className="sr-only">관제 상태 필터</span>
          <select
            value={queueFilter}
            onChange={(event) => updateQuery("risk", event.target.value)}
            disabled={isPending}
          >
            {RISK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">업무 유형 필터</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {scope === "team" ? (
          <label>
            <span className="sr-only">주담당 컨설턴트 필터</span>
            <select
              value={consultantId ?? "all"}
              onChange={(event) => updateQuery("consultant", event.target.value)}
              disabled={isPending}
            >
              <option value="all">전체 컨설턴트</option>
              <option value="unassigned">주담당 미배정</option>
              {consultants.map((consultant) => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.name}
                  {consultant.title ? ` · ${consultant.title}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {isPending ? <span className="monitor-filter-status">필터 적용 중…</span> : null}
      </div>

      {visibleItems.length === 0 ? (
        <div className="monitor-empty-state">
          <IconCheck />
          <strong>해당 조건의 관제 항목이 없습니다</strong>
          <p>필터를 변경하거나 Task 보드에서 전체 업무를 확인해 주세요.</p>
        </div>
      ) : (
        <div className="monitor-table-wrap">
          <table className="monitor-queue-table">
            <thead>
              <tr>
                <th>위험</th>
                <th>기업 / 업무</th>
                <th>유형</th>
                <th>주담당</th>
                <th>과제 담당</th>
                <th className="r">기한</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={`${item.source}-${item.id}`}
                  className={`monitor-queue-row monitor-queue-row--${item.severity}`}
                >
                  <td data-label="위험">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td data-label="기업 / 업무" className="monitor-queue-work">
                    {item.href ? (
                      <Link href={item.href} className="monitor-queue-work-link">
                        <strong>{item.companyName ?? "기업 미지정"}</strong>
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <>
                        <strong>{item.companyName ?? "기업 미지정"}</strong>
                        <span>{item.title}</span>
                      </>
                    )}
                  </td>
                  <td data-label="유형">
                    <div className="monitor-type-cell">
                      <span>{SOURCE_LABEL[item.source]}</span>
                      <CategoryChip name={item.categoryName} />
                    </div>
                  </td>
                  <td data-label="주담당">
                    <Assignee
                      name={item.primaryConsultantName}
                      unassignedLabel="주담당 미배정"
                    />
                  </td>
                  <td data-label="과제 담당">
                    {item.source === "task" ? (
                      <Assignee name={item.assigneeName} unassignedLabel="과제 미배정" />
                    ) : (
                      <span className="monitor-cell-muted">해당 없음</span>
                    )}
                  </td>
                  <td data-label="기한" className="r monitor-due-cell">
                    {item.daysLeft !== null ? (
                      <DdayBadge daysLeft={item.daysLeft} />
                    ) : (
                      <span className="monitor-no-date">기한 미지정</span>
                    )}
                    {item.dueDate ? <span className="num">{item.dueDate}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

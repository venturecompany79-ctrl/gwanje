"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { Panel } from "@/components/ui/Panel";
import { IconSearch } from "@/components/ui/icons";
import { formatDotDateString } from "@/lib/datetime";
import { formatDday, formatRevenue } from "@/lib/format";
import type { CompanyListRow } from "@/lib/data/companies";

type SortKey = "urgent" | "name" | "recent";
type StatusTab = "active" | "ended";

/** 계약 종료일 D-day 배지 — 임박(≤30일)=attention, 만료(≤0)=critical */
function ContractBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) {
    return <Badge tone="critical">계약만료 {formatDday(daysLeft)}</Badge>;
  }
  const tone = daysLeft <= 30 ? "attention" : "neutral";
  return <Badge tone={tone}>계약 {formatDday(daysLeft)}</Badge>;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "urgent", label: "임박순" },
  { value: "name", label: "이름순" },
  { value: "recent", label: "최근 등록순" },
];

function isSortKey(value: string | null): value is SortKey {
  return value === "urgent" || value === "name" || value === "recent";
}

export function CompaniesTable({
  companies,
  initialQuery = "",
  initialTag = null,
  initialSort = null,
}: {
  companies: CompanyListRow[];
  /** 상단바 전역 검색(/app/companies?q=)에서 넘어온 초기 검색어 */
  initialQuery?: string;
  /** URL ?tag= 초기 필터 (GWJ-011) */
  initialTag?: string | null;
  /** URL ?sort= 초기 정렬 (GWJ-011) */
  initialSort?: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState<string | null>(initialTag);
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [sort, setSort] = useState<SortKey>(
    isSortKey(initialSort) ? initialSort : "urgent",
  );

  const activeCount = useMemo(
    () => companies.filter((co) => co.status !== "ended").length,
    [companies],
  );
  const endedCount = companies.length - activeCount;

  // 검색·필터·정렬 상태를 URL 쿼리에 보존 — 새로고침·공유 시 복원 (GWJ-011).
  // history.replaceState로 갱신해 서버 재요청(스켈레톤) 없이 클라이언트 필터링 유지.
  useEffect(() => {
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (sort !== "urgent") params.set("sort", sort);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `/app/companies?${qs}` : "/app/companies",
    );
  }, [query, tag, sort]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const co of companies) for (const t of co.conditionTags) tags.add(t);
    return [...tags].sort((a, b) => a.localeCompare(b, "ko"));
  }, [companies]);

  const isEndedTab = statusTab === "ended";

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = companies.filter((co) => {
      if ((co.status === "ended") !== isEndedTab) return false;
      if (tag && !co.conditionTags.includes(tag)) return false;
      if (!needle) return true;
      return (
        co.name.toLowerCase().includes(needle) ||
        (co.industry ?? "").toLowerCase().includes(needle)
      );
    });
    const sorted = [...filtered];
    if (isEndedTab) {
      // 종료 기업은 최근 종료순
      sorted.sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else if (sort === "recent") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      sorted.sort(
        (a, b) =>
          (a.nearestDaysLeft ?? Number.MAX_SAFE_INTEGER) -
          (b.nearestDaysLeft ?? Number.MAX_SAFE_INTEGER),
      );
    }
    return sorted;
  }, [companies, query, tag, sort, isEndedTab]);

  const isFiltered = query.trim() !== "" || tag !== null;

  return (
    <>
      <div className="tag-tabs" role="group" aria-label="관리 상태 필터" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`pill-tab${!isEndedTab ? " is-active" : ""}`}
          onClick={() => setStatusTab("active")}
        >
          관리중 {activeCount}
        </button>
        <button
          type="button"
          className={`pill-tab${isEndedTab ? " is-active" : ""}`}
          onClick={() => setStatusTab("ended")}
        >
          종료 {endedCount}
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-pill">
          <IconSearch />
          <input
            type="search"
            placeholder="기업명·업종 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="기업명·업종 검색"
          />
        </div>
        <div className="tag-tabs" role="group" aria-label="컨디션 태그 필터">
          <button
            type="button"
            className={`pill-tab${tag === null ? " is-active" : ""}`}
            onClick={() => setTag(null)}
          >
            전체
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`pill-tab${tag === t ? " is-active" : ""}`}
              onClick={() => setTag(tag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {isEndedTab ? null : (
          <select
            className="select-pill"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="정렬"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <Panel>
        {rows.length === 0 ? (
          <div className="empty-w" style={{ padding: "56px 16px" }}>
            <IconSearch />
            <p>
              {isFiltered
                ? "조건에 맞는 기업이 없습니다"
                : isEndedTab
                  ? "종료된 기업이 없습니다"
                  : "표시할 기업이 없습니다"}
            </p>
            {isFiltered ? (
              <Button
                variant="ghost"
                size="sm"
                className="filter-reset"
                onClick={() => {
                  setQuery("");
                  setTag(null);
                }}
              >
                필터 초기화
              </Button>
            ) : null}
          </div>
        ) : (
          <table className="dlist ctable dlist--cards">
            <thead>
              <tr>
                <th>기업명</th>
                <th>업종</th>
                <th>설립</th>
                <th className="r">매출</th>
                <th className="r">인원</th>
                <th>보유 자격</th>
                <th className="r">{isEndedTab ? "종료 정보" : "임박 항목"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((co) => (
                <tr
                  key={co.id}
                  onClick={() => router.push(`/app/companies/${co.id}`)}
                >
                  <td className="co" data-label="기업명">
                    <Link
                      href={`/app/companies/${co.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {co.name}
                    </Link>
                  </td>
                  <td className="item" data-label="업종">{co.industry ?? "—"}</td>
                  <td className="date num" data-label="설립">
                    {co.foundedDate ? co.foundedDate.slice(0, 4) : "—"}
                  </td>
                  <td className="r num" data-label="매출">{formatRevenue(co.revenue)}</td>
                  <td className="r num" data-label="인원">
                    {co.headcount !== null ? `${co.headcount}명` : "—"}
                  </td>
                  <td data-label="보유 자격">
                    {co.credentialTypes.length === 0 ? (
                      <span className="cell-muted">—</span>
                    ) : (
                      <span className="chip-row">
                        {co.credentialTypes.slice(0, 2).map((type, i) => (
                          <span key={`${type}-${i}`} className="cat-chip">
                            {type}
                          </span>
                        ))}
                        {co.credentialTypes.length > 2 ? (
                          <span className="chip-more num">
                            +{co.credentialTypes.length - 2}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="r" data-label={isEndedTab ? "종료 정보" : "임박 항목"}>
                    {isEndedTab ? (
                      <span className="due-cell">
                        <Badge tone="neutral">
                          {co.endedAt
                            ? `${formatDotDateString(co.endedAt.slice(0, 10))} 종료`
                            : "종료"}
                        </Badge>
                        {co.endedReason ? (
                          <span className="due-more" title={co.endedReason}>
                            {co.endedReason}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                    <span className="due-cell">
                      {co.contractDaysLeft !== null ? (
                        <ContractBadge daysLeft={co.contractDaysLeft} />
                      ) : null}
                      {co.expiredCount > 0 ? (
                        <span className="badge badge--soft-expired">
                          만료 {co.expiredCount}
                        </span>
                      ) : null}
                      {co.nearestDaysLeft !== null ? (
                        <>
                          <DdayBadge daysLeft={co.nearestDaysLeft} />
                          {co.upcomingCount > 1 ? (
                            <span
                              className="due-more num"
                              title={[
                                ...co.upcomingItems.map(
                                  (it) => `${it.title} · ${formatDday(it.daysLeft)}`,
                                ),
                                ...(co.upcomingCount > co.upcomingItems.length
                                  ? [`그 외 ${co.upcomingCount - co.upcomingItems.length}건`]
                                  : []),
                              ].join("\n")}
                            >
                              외 {co.upcomingCount - 1}건
                            </span>
                          ) : null}
                        </>
                      ) : co.expiredCount === 0 && co.contractDaysLeft === null ? (
                        <span className="cell-muted">—</span>
                      ) : null}
                    </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

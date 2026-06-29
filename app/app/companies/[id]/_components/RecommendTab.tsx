"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert, IconSearch, IconTarget } from "@/components/ui/icons";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { daysFromToday } from "@/lib/datetime";
import type { CompanyProgramMatchesData } from "@/lib/data/company-programs";
import { PROGRAM_SOURCE_LABEL, SUPPORT_FIELD_LABEL } from "@/lib/labels";
import {
  SUPPORT_FIELDS,
  isSourceCode,
  isSupportField,
  normalizeContentText,
  type SourceCode,
  type SupportField,
} from "@/lib/gov-programs/types";

const INITIAL_VISIBLE = 6;
const cache = new Map<string, CompanyProgramMatchesData>();

const REGION_OPTIONS = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

type RegionOption = (typeof REGION_OPTIONS)[number];
type RegionFilter = "all" | "national" | RegionOption;
type FieldFilter = "all" | SupportField;
type DueFilter = "all" | "7" | "14" | "30" | "60" | "none";
type FitFilter = "all" | "high" | "review" | "exclude-low";
type SortKey = "recommend" | "deadline" | "synced";

const REGION_ALIASES: Record<RegionOption, string[]> = {
  서울: ["서울", "서울특별시"],
  부산: ["부산", "부산광역시"],
  대구: ["대구", "대구광역시"],
  인천: ["인천", "인천광역시"],
  광주: ["광주", "광주광역시"],
  대전: ["대전", "대전광역시"],
  울산: ["울산", "울산광역시"],
  세종: ["세종", "세종특별자치시"],
  경기: ["경기", "경기도"],
  강원: ["강원", "강원도", "강원특별자치도"],
  충북: ["충북", "충청북도"],
  충남: ["충남", "충청남도"],
  전북: ["전북", "전라북도", "전북특별자치도"],
  전남: ["전남", "전라남도"],
  경북: ["경북", "경상북도"],
  경남: ["경남", "경상남도"],
  제주: ["제주", "제주도", "제주특별자치도"],
};

const NATIONAL_REGION_KEYWORDS = ["전국", "지역무관", "전지역", "전국공통"];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "마감기간 전체" },
  { value: "7", label: "7일 이내" },
  { value: "14", label: "14일 이내" },
  { value: "30", label: "30일 이내" },
  { value: "60", label: "60일 이내" },
  { value: "none", label: "마감일 없음" },
];

const FIT_OPTIONS: { value: FitFilter; label: string }[] = [
  { value: "all", label: "적합도 전체" },
  { value: "high", label: "높은 적합" },
  { value: "review", label: "검토필요" },
  { value: "exclude-low", label: "낮은 적합 제외" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommend", label: "추천점수순" },
  { value: "deadline", label: "마감임박순" },
  { value: "synced", label: "최신 동기화순" },
];

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: CompanyProgramMatchesData; error: null }
  | { status: "error"; data: null; error: string };

function sourceLabel(source: string): string {
  return isSourceCode(source)
    ? PROGRAM_SOURCE_LABEL[source as SourceCode]
    : source;
}

function supportLabel(field: string | null): string | null {
  return isSupportField(field)
    ? SUPPORT_FIELD_LABEL[field as SupportField]
    : field;
}

function compactRegionText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function matchesRegionAlias(value: string, aliases: string[]): boolean {
  const normalized = compactRegionText(value);
  return aliases.some((alias) => normalized.includes(compactRegionText(alias)));
}

function hasNationalRegionText(value: string | null | undefined): boolean {
  if (!value) return false;
  return NATIONAL_REGION_KEYWORDS.some((keyword) =>
    compactRegionText(value).includes(compactRegionText(keyword)),
  );
}

function extractProgramRegions(
  program: CompanyProgramMatchesData["matches"][number]["program"],
): RegionOption[] {
  const regions = new Set<RegionOption>();
  const candidates = [program.region, ...program.hashtags];
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    for (const region of REGION_OPTIONS) {
      if (matchesRegionAlias(candidate, REGION_ALIASES[region])) {
        regions.add(region);
      }
    }
  }
  return [...regions];
}

function isNationalProgram(
  program: CompanyProgramMatchesData["matches"][number]["program"],
): boolean {
  if (hasNationalRegionText(program.region)) return true;
  if (program.hashtags.some(hasNationalRegionText)) return true;
  return !program.region?.trim() && extractProgramRegions(program).length === 0;
}

function regionLabel(
  program: CompanyProgramMatchesData["matches"][number]["program"],
): string | null {
  if (isNationalProgram(program)) return "전국";
  const regions = extractProgramRegions(program);
  if (regions.length === 0) return null;
  return regions.length > 3
    ? `${regions.slice(0, 3).join(", ")} 외 ${regions.length - 3}`
    : regions.join(", ");
}

function scoreTone(score: number): string {
  if (score >= 80) return "is-high";
  if (score >= 50) return "is-mid";
  return "is-low";
}

function isFieldFilter(value: string | null): value is FieldFilter {
  return value === "all" || isSupportField(value);
}

function isRegionFilter(value: string | null): value is RegionFilter {
  return (
    value === "all" ||
    value === "national" ||
    REGION_OPTIONS.includes(value as RegionOption)
  );
}

function isDueFilter(value: string | null): value is DueFilter {
  return (
    value === "all" ||
    value === "7" ||
    value === "14" ||
    value === "30" ||
    value === "60" ||
    value === "none"
  );
}

function isFitFilter(value: string | null): value is FitFilter {
  return (
    value === "all" ||
    value === "high" ||
    value === "review" ||
    value === "exclude-low"
  );
}

function isSortKey(value: string | null): value is SortKey {
  return value === "recommend" || value === "deadline" || value === "synced";
}

function matchesDueFilter(
  program: CompanyProgramMatchesData["matches"][number]["program"],
  dueFilter: DueFilter,
): boolean {
  if (dueFilter === "all") return true;
  if (dueFilter === "none") return !program.apply_end;
  if (!program.apply_end) return false;

  const daysLeft = daysFromToday(program.apply_end);
  return daysLeft >= 0 && daysLeft <= Number(dueFilter);
}

function matchesFitFilter(score: number, fitFilter: FitFilter): boolean {
  if (fitFilter === "all") return true;
  if (fitFilter === "high") return score >= 80;
  if (fitFilter === "review") return score >= 50 && score < 80;
  return score >= 50;
}

function RecommendSkeleton() {
  return (
    <Panel>
      <PanelHead title="정부지원사업 추천" count="불러오는 중" />
      <div className="program-list" aria-busy>
        {Array.from({ length: 3 }, (_, index) => (
          <div className="program-card program-card--skeleton" key={index}>
            <div className="skeleton-line w-70" />
            <div className="skeleton-line w-45" />
            <div className="skeleton-line w-90" />
            <div className="skeleton-line w-60" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function RecommendTab({
  companyId,
  companyName,
  initialData,
  showToast,
}: {
  companyId: string;
  companyName: string;
  initialData?: CompanyProgramMatchesData | null;
  showToast: (message: string) => void;
}) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [filtersReady, setFiltersReady] = useState(false);
  const [query, setQuery] = useState("");
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [sort, setSort] = useState<SortKey>("recommend");
  const [state, setState] = useState<LoadState>(() => {
    const cached = cache.get(companyId);
    if (cached) return { status: "ready", data: cached, error: null };
    if (initialData) {
      cache.set(companyId, initialData);
      return { status: "ready", data: initialData, error: null };
    }
    return { status: "loading", data: null, error: null };
  });

  useEffect(() => {
    if (state.status !== "loading") return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/companies/${companyId}/program-matches`, {
          headers: { accept: "application/json" },
        });
        const json = (await res.json()) as
          | ({ ok: true } & CompanyProgramMatchesData)
          | { ok: false; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          throw new Error(!json.ok ? json.error : `HTTP ${res.status}`);
        }
        const data: CompanyProgramMatchesData = {
          demo: json.demo,
          enabledSources: json.enabledSources,
          matches: json.matches,
        };
        cache.set(companyId, data);
        setState({ status: "ready", data, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        showToast(`추천 공고를 불러오지 못했습니다: ${message}`);
        setState({ status: "error", data: null, error: message });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, showToast, state.status]);

  const matches = useMemo(() => state.data?.matches ?? [], [state.data]);
  const filterActive =
    query.trim() !== "" ||
    fieldFilter !== "all" ||
    regionFilter !== "all" ||
    dueFilter !== "all" ||
    fitFilter !== "all";
  const filteredMatches = useMemo(() => {
    const needle = normalizeContentText(query);
    const rows = matches.filter((match) => {
      const { program, score, reasons } = match;
      if (
        fieldFilter !== "all" &&
        program.support_field !== fieldFilter
      ) {
        return false;
      }
      if (regionFilter === "national") {
        if (!isNationalProgram(program)) return false;
      } else if (
        regionFilter !== "all" &&
        !extractProgramRegions(program).includes(regionFilter)
      ) {
        return false;
      }
      if (!matchesDueFilter(program, dueFilter)) return false;
      if (!matchesFitFilter(score, fitFilter)) return false;
      if (!needle) return true;

      return normalizeContentText(
        [
          program.title,
          program.org_name,
          program.target_text,
          program.support_field,
          program.region,
          program.hashtags.join(" "),
          reasons.join(" "),
        ].join(" "),
      ).includes(needle);
    });

    return [...rows].sort((a, b) => {
      if (sort === "deadline") {
        const aEnd = a.program.apply_end ?? "9999-12-31";
        const bEnd = b.program.apply_end ?? "9999-12-31";
        if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
        return b.score - a.score;
      }
      if (sort === "synced") {
        if (a.program.synced_at !== b.program.synced_at) {
          return b.program.synced_at.localeCompare(a.program.synced_at);
        }
        return b.score - a.score;
      }
      if (b.score !== a.score) return b.score - a.score;
      const aEnd = a.program.apply_end ?? "9999-12-31";
      const bEnd = b.program.apply_end ?? "9999-12-31";
      return aEnd.localeCompare(bEnd);
    });
  }, [dueFilter, fieldFilter, fitFilter, matches, query, regionFilter, sort]);
  const visibleMatches = useMemo(
    () => filteredMatches.slice(0, visible),
    [filteredMatches, visible],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("pq") ?? "");

    const nextField = params.get("field");
    setFieldFilter(isFieldFilter(nextField) ? nextField : "all");

    const nextRegion = params.get("region");
    setRegionFilter(isRegionFilter(nextRegion) ? nextRegion : "all");

    const nextDue = params.get("due");
    setDueFilter(isDueFilter(nextDue) ? nextDue : "all");

    const nextFit = params.get("score");
    setFitFilter(isFitFilter(nextFit) ? nextFit : "all");

    const nextSort = params.get("sort");
    setSort(isSortKey(nextSort) ? nextSort : "recommend");
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    setVisible(INITIAL_VISIBLE);
  }, [dueFilter, fieldFilter, fitFilter, query, regionFilter, sort]);

  useEffect(() => {
    if (!filtersReady) return;
    const params = new URLSearchParams();
    params.set("tab", "recommend");
    const trimmed = query.trim();
    if (trimmed) params.set("pq", trimmed);
    if (fieldFilter !== "all") params.set("field", fieldFilter);
    if (regionFilter !== "all") params.set("region", regionFilter);
    if (dueFilter !== "all") params.set("due", dueFilter);
    if (fitFilter !== "all") params.set("score", fitFilter);
    if (sort !== "recommend") params.set("sort", sort);
    window.history.replaceState(
      null,
      "",
      `/app/companies/${companyId}?${params.toString()}`,
    );
  }, [
    companyId,
    dueFilter,
    fieldFilter,
    filtersReady,
    fitFilter,
    query,
    regionFilter,
    sort,
  ]);

  function resetFilters() {
    setQuery("");
    setFieldFilter("all");
    setRegionFilter("all");
    setDueFilter("all");
    setFitFilter("all");
    setSort("recommend");
  }

  if (state.status === "loading") return <RecommendSkeleton />;

  if (state.status === "error") {
    return (
      <Panel>
        <PanelHead title="정부지원사업 추천" />
        <EmptyState
          bare
          icon={<IconAlert />}
          title="추천 공고를 불러오지 못했습니다"
          description="잠시 후 다시 확인해 주세요."
        />
      </Panel>
    );
  }

  const noSources = !state.data.demo && state.data.enabledSources.length === 0;

  return (
    <Panel>
      <PanelHead
        title="정부지원사업 추천"
        count={
          filterActive
            ? `${filteredMatches.length}/${matches.length}건`
            : `${matches.length}건`
        }
      />

      {noSources ? (
        <EmptyState
          bare
          icon={<IconAlert />}
          title="동기화가 아직 설정되지 않았습니다"
          description="정부지원사업 API 키가 설정되면 추천 공고가 표시됩니다."
        />
      ) : matches.length === 0 ? (
        <EmptyState
          bare
          icon={<IconTarget />}
          title="매칭된 지원사업이 없습니다"
          description={`${companyName}에 맞는 진행 중 공고를 찾지 못했습니다.`}
        />
      ) : (
        <>
          <div className="program-filter-bar filter-bar">
            <div className="search-pill">
              <IconSearch />
              <input
                type="search"
                placeholder="공고명·기관·키워드 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="공고명·기관·키워드 검색"
              />
            </div>
            <select
              className="select-pill"
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value as FieldFilter)}
              aria-label="지원분야 필터"
            >
              <option value="all">지원분야 전체</option>
              {SUPPORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {SUPPORT_FIELD_LABEL[field]}
                </option>
              ))}
            </select>
            <select
              className="select-pill"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as RegionFilter)}
              aria-label="지역 필터"
            >
              <option value="all">지역 전체</option>
              <option value="national">전국/지역무관</option>
              {REGION_OPTIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <select
              className="select-pill"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              aria-label="마감기간 필터"
            >
              {DUE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="select-pill"
              value={fitFilter}
              onChange={(e) => setFitFilter(e.target.value as FitFilter)}
              aria-label="적합도 필터"
            >
              {FIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="spacer" />
            <select
              className="select-pill"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="정렬"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {filteredMatches.length === 0 ? (
            <EmptyState
              bare
              icon={<IconSearch />}
              title="조건에 맞는 추천 공고가 없습니다"
              description="지역, 지원분야, 마감기간 조건을 완화해 보세요."
              action={
                filterActive ? (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    필터 초기화
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="program-list">
                {visibleMatches.map(({ program, score, reasons }) => {
                  const label = supportLabel(program.support_field);
                  const regions = regionLabel(program);
                  const daysLeft = program.apply_end
                    ? daysFromToday(program.apply_end)
                    : null;
                  return (
                    <article className="program-card" key={program.id}>
                      <div className="program-card-main">
                        <div className="program-title-row">
                          <h3>{program.title}</h3>
                          <span className="program-score num">{score}</span>
                        </div>
                        <div className="program-meta">
                          <Badge tone="neutral">
                            {sourceLabel(program.source)}
                          </Badge>
                          {label ? <CategoryChip name={label} /> : null}
                          {program.org_name ? (
                            <span>{program.org_name}</span>
                          ) : null}
                          {regions ? <span>{regions}</span> : null}
                          {daysLeft !== null ? (
                            <DdayBadge daysLeft={daysLeft} />
                          ) : null}
                        </div>
                        <div
                          className="match-bar"
                          aria-label={`매치 점수 ${score}점`}
                        >
                          <span
                            className={`match-bar-fill ${scoreTone(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <div className="program-reasons">
                          {reasons.map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                      </div>
                      {program.detail_url ? (
                        <LinkButton
                          variant="secondary"
                          size="sm"
                          href={program.detail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          상세 보기
                        </LinkButton>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              {visible < filteredMatches.length ? (
                <button
                  type="button"
                  className="program-more"
                  onClick={() => setVisible(filteredMatches.length)}
                >
                  더 보기
                </button>
              ) : null}
            </>
          )}
        </>
      )}
    </Panel>
  );
}

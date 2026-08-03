"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconAlert,
  IconArrow,
  IconBack,
  IconBuilding,
  IconCheck,
  IconFile,
  IconInfo,
  IconLink,
  IconRefresh,
  IconSearch,
  IconSparkle,
  IconTarget,
  IconX,
} from "@/components/ui/icons";
import { daysFromToday, formatDotDateString } from "@/lib/datetime";
import type {
  CompanyProgramMatch,
  CompanyProgramMatchesData,
  ProgramDueFilter,
  ProgramFitFilter,
  ProgramReviewDecision,
  ProgramSortKey,
  ProgramStatusFilter,
} from "@/lib/data/company-programs";
import { formatRevenue } from "@/lib/format";
import type { MatchEligibility } from "@/lib/gov-programs/match";
import {
  profileSourceLabel,
  type MatchProfileSource,
  type MatchProfileSourceKind,
} from "@/lib/gov-programs/profile-types";
import { REGION_OPTIONS, extractProgramRegions, isNationalProgram } from "@/lib/gov-programs/region";
import {
  SUPPORT_FIELDS,
  isSourceCode,
  isSupportField,
  safeHttpUrl,
  type SourceCode,
  type SupportField,
} from "@/lib/gov-programs/types";
import { PROGRAM_SOURCE_LABEL, SUPPORT_FIELD_LABEL } from "@/lib/labels";
import type { GovProgramPageSearchParams } from "../page";
import {
  createTaskFromProgram,
  setProfileSourceIncluded,
  setProgramDecision,
} from "../actions";

interface WorkspaceData extends CompanyProgramMatchesData {
  canManageProfile: boolean;
  canManageWorkflow: boolean;
  companyStatus: string;
}

interface Filters {
  q: string;
  field: string;
  region: string;
  due: ProgramDueFilter;
  fit: ProgramFitFilter;
  eligibility: MatchEligibility | "all";
  status: ProgramStatusFilter;
  sort: ProgramSortKey;
  page: number;
}

type LoadState =
  | { status: "loading"; data: WorkspaceData | null; error: null }
  | { status: "ready"; data: WorkspaceData; error: null }
  | { status: "error"; data: WorkspaceData | null; error: string };

const DUE_OPTIONS: Array<{ value: ProgramDueFilter; label: string }> = [
  { value: "all", label: "마감 전체" },
  { value: "7", label: "7일 이내" },
  { value: "14", label: "14일 이내" },
  { value: "30", label: "30일 이내" },
  { value: "60", label: "60일 이내" },
  { value: "none", label: "마감일 없음" },
];

const STATUS_OPTIONS: Array<{ value: ProgramStatusFilter; label: string }> = [
  { value: "active", label: "추천 공고" },
  { value: "saved", label: "관심" },
  { value: "task", label: "Task" },
  { value: "excluded", label: "제외" },
];

const ELIGIBILITY_OPTIONS: Array<{
  value: MatchEligibility | "all";
  label: string;
}> = [
  { value: "all", label: "지원 가능성 전체" },
  { value: "eligible", label: "지원 가능" },
  { value: "review", label: "정보 확인 필요" },
  { value: "ineligible", label: "조건 불충족" },
];

const FIT_OPTIONS: Array<{ value: ProgramFitFilter; label: string }> = [
  { value: "all", label: "적합도 전체" },
  { value: "high", label: "높은 적합" },
  { value: "review", label: "검토 필요" },
  { value: "exclude-low", label: "낮은 적합 제외" },
];

const SORT_OPTIONS: Array<{ value: ProgramSortKey; label: string }> = [
  { value: "recommend", label: "추천순" },
  { value: "deadline", label: "마감임박순" },
  { value: "synced", label: "최신 공고순" },
];

function oneOf<T extends string>(value: string | undefined, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? (value as T) : fallback;
}

function initialFilterState(input: GovProgramPageSearchParams): Filters {
  return {
    q: input.q ?? "",
    field: input.field ?? "all",
    region: input.region ?? "all",
    due: oneOf(input.due, DUE_OPTIONS.map((item) => item.value), "all"),
    fit: oneOf(input.fit, FIT_OPTIONS.map((item) => item.value), "all"),
    eligibility: oneOf(
      input.eligibility,
      ELIGIBILITY_OPTIONS.map((item) => item.value),
      "all",
    ),
    status: oneOf(input.status, STATUS_OPTIONS.map((item) => item.value), "active"),
    sort: oneOf(input.sort, SORT_OPTIONS.map((item) => item.value), "recommend"),
    page: Math.max(1, Number(input.page ?? "1") || 1),
  };
}

function eligibilityMeta(value: MatchEligibility): {
  label: string;
  tone: "success" | "attention" | "critical";
} {
  if (value === "eligible") return { label: "지원 가능", tone: "success" };
  if (value === "review") return { label: "정보 확인 필요", tone: "attention" };
  return { label: "조건 불충족", tone: "critical" };
}

function confidenceLabel(value: CompanyProgramMatch["confidence"]): string {
  if (value === "high") return "근거 충분";
  if (value === "medium") return "근거 보통";
  return "근거 부족";
}

function sourceLabel(source: string): string {
  return isSourceCode(source) ? PROGRAM_SOURCE_LABEL[source as SourceCode] : source;
}

function supportLabel(field: string | null): string | null {
  return isSupportField(field) ? SUPPORT_FIELD_LABEL[field as SupportField] : field;
}

function programRegion(match: CompanyProgramMatch): string | null {
  if (isNationalProgram(match.program)) return "전국";
  const regions = extractProgramRegions(match.program);
  if (regions.length === 0) return null;
  return regions.length > 3
    ? `${regions.slice(0, 3).join(", ")} 외 ${regions.length - 3}`
    : regions.join(", ");
}

function sourceCount(profile: WorkspaceData["profile"]): number {
  return Object.values(profile.sourceCounts).reduce((sum, count) => sum + count, 0);
}

function buildQuery(filters: Filters, selectedProgramId: string | null): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.field !== "all") params.set("field", filters.field);
  if (filters.region !== "all") params.set("region", filters.region);
  if (filters.due !== "all") params.set("due", filters.due);
  if (filters.fit !== "all") params.set("fit", filters.fit);
  if (filters.eligibility !== "all") params.set("eligibility", filters.eligibility);
  if (filters.status !== "active") params.set("status", filters.status);
  if (filters.sort !== "recommend") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (selectedProgramId) params.set("program", selectedProgramId);
  return params;
}

function WorkspaceSkeleton() {
  return (
    <div className="gov-workspace-grid" aria-busy>
      <section className="gov-list-pane">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="gov-result-card gov-result-card--skeleton" key={index}>
            <div className="skeleton-line w-70" />
            <div className="skeleton-line w-45" />
            <div className="skeleton-line w-90" />
          </div>
        ))}
      </section>
      <section className="gov-detail-pane gov-detail-pane--empty">
        <IconTarget />
        <strong>맞춤 공고를 분석하고 있습니다</strong>
      </section>
    </div>
  );
}

function ProfileSourcePanel({
  sources,
  canManage,
  pending,
  onToggle,
  onClose,
}: {
  sources: MatchProfileSource[];
  canManage: boolean;
  pending: boolean;
  onToggle: (source: MatchProfileSource, included: boolean) => void;
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<MatchProfileSourceKind, MatchProfileSource[]>();
    for (const source of sources) {
      const current = groups.get(source.kind) ?? [];
      current.push(source);
      groups.set(source.kind, current);
    }
    return groups;
  }, [sources]);

  return (
    <SlideOver ariaLabel="매칭 기준 자료" onClose={onClose}>
      <div className="slideover-head">
        <div>
          <h2>매칭 기준 자료</h2>
          <p className="gov-source-panel-sub">포함된 기업 이력만 적합도와 추천 근거에 반영됩니다.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
          <IconX />
        </button>
      </div>
      <div className="slideover-body gov-source-groups">
        {[...grouped.entries()].map(([kind, rows]) => (
          <section className="gov-source-group" key={kind}>
            <div className="gov-source-group-head">
              <strong>{profileSourceLabel(kind)}</strong>
              <span>{rows.filter((row) => row.included).length}/{rows.length}건 포함</span>
            </div>
            {rows.map((source) => (
              <label className="gov-source-row" key={`${source.kind}:${source.id}`}>
                <input
                  type="checkbox"
                  checked={source.included}
                  disabled={!canManage || pending || source.kind === "company"}
                  onChange={(event) => onToggle(source, event.currentTarget.checked)}
                />
                <span>
                  <b>{source.label}</b>
                  <small>{source.detail || "세부정보 없음"}</small>
                </span>
              </label>
            ))}
          </section>
        ))}
      </div>
      <div className="slideover-foot">
        <Button variant="ghost" type="button" onClick={onClose}>닫기</Button>
      </div>
    </SlideOver>
  );
}

function ProgramTaskPanel({
  match,
  pending,
  onSubmit,
  onClose,
}: {
  match: CompanyProgramMatch;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onClose: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <SlideOver ariaLabel="지원사업 Task 전환" onClose={onClose}>
      <div className="slideover-head">
        <div>
          <h2>Task로 전환</h2>
          <p className="gov-source-panel-sub">신청 단계와 공고 마감일을 기본값으로 등록합니다.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
          <IconX />
        </button>
      </div>
      <form className="slideover-form" onSubmit={submit}>
        <div className="slideover-body">
          <div className="field">
            <label htmlFor="program-task-title">Task명 *</label>
            <input
              id="program-task-title"
              name="title"
              className="input"
              required
              defaultValue={`[정부지원사업] ${match.program.title}`}
            />
          </div>
          <div className="form-grid2">
            <div className="field">
              <label>단계</label>
              <input className="input" value="신청" disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="program-task-due">마감일</label>
              <input
                id="program-task-due"
                name="due_date"
                type="date"
                className="input"
                defaultValue={match.program.apply_end ?? ""}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="program-task-memo">메모</label>
            <textarea
              id="program-task-memo"
              name="memo"
              className="memo-input"
              defaultValue={`매칭 근거\n${match.reasons.map((reason) => `- ${reason}`).join("\n")}`}
            />
          </div>
        </div>
        <div className="slideover-foot">
          <Button variant="cta" type="submit" disabled={pending}>
            {pending ? "생성 중…" : "Task 생성"}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>닫기</Button>
        </div>
      </form>
    </SlideOver>
  );
}

export function GovProgramsWorkspace({
  companyId,
  companies,
  initialFilters,
}: {
  companyId: string;
  companies: Array<{ id: string; name: string; status: string }>;
  initialFilters: GovProgramPageSearchParams;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(() => initialFilterState(initialFilters));
  const [queryInput, setQueryInput] = useState(initialFilters.q ?? "");
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(initialFilters.program ?? null);
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const forceAnalysisRef = useRef(false);
  const pinnedProgramIdRef = useRef(initialFilters.program ?? null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [taskMatch, setTaskMatch] = useState<CompanyProgramMatch | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast, showToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.q === queryInput ? current : { ...current, q: queryInput, page: 1 },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const load = useCallback(async (signal: AbortSignal) => {
    const params = buildQuery(filters, pinnedProgramIdRef.current);
    params.set("pageSize", "30");
    if (refreshKey > 0) params.set("_r", String(refreshKey));
    if (forceAnalysisRef.current) {
      params.set("refresh", "1");
      forceAnalysisRef.current = false;
    }
    setState((current) => ({ status: "loading", data: current.data, error: null }));
    try {
      const response = await fetch(`/api/companies/${companyId}/program-matches?${params}`, {
        headers: { accept: "application/json" },
        signal,
      });
      const json = (await response.json()) as
        | ({ ok: true } & WorkspaceData)
        | { ok: false; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(!json.ok ? json.error ?? "공고를 불러오지 못했습니다." : `HTTP ${response.status}`);
      }
      setState({ status: "ready", data: json, error: null });
      pinnedProgramIdRef.current = null;
      setSelectedProgramId((current) =>
        current && json.matches.some((match) => match.program.id === current) ? current : null,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({ status: "error", data: current.data, error: message }));
    }
  }, [companyId, filters, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const params = buildQuery(filters, selectedProgramId);
    const suffix = params.toString();
    window.history.replaceState(
      null,
      "",
      `/app/companies/${companyId}/gov-programs${suffix ? `?${suffix}` : ""}`,
    );
  }, [companyId, filters, selectedProgramId]);

  const data = state.data;
  const selected = data?.matches.find((match) => match.program.id === selectedProgramId) ?? null;
  const pageCount = data ? Math.max(1, Math.ceil(data.filteredTotal / data.pageSize)) : 1;

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
    if (key !== "page") setSelectedProgramId(null);
  }

  function switchCompany(nextCompanyId: string) {
    const params = buildQuery({ ...filters, page: 1 }, null);
    const suffix = params.toString();
    router.push(`/app/companies/${nextCompanyId}/gov-programs${suffix ? `?${suffix}` : ""}`);
  }

  function refresh(message?: string, forceAnalysis = false) {
    if (forceAnalysis) forceAnalysisRef.current = true;
    setRefreshKey((value) => value + 1);
    if (message) showToast(message);
  }

  function changeDecision(match: CompanyProgramMatch, decision: ProgramReviewDecision | null) {
    if (!data?.canManageWorkflow || data.demo || data.companyStatus !== "active") return;
    startTransition(async () => {
      const result = await setProgramDecision(companyId, match.program.id, decision);
      if (!result.ok) {
        showToast(result.error ?? "상태를 변경하지 못했습니다.");
        return;
      }
      refresh(decision === "saved" ? "관심 공고에 저장했습니다" : decision === "excluded" ? "추천에서 제외했습니다" : "검토 상태를 초기화했습니다");
    });
  }

  function toggleSource(source: MatchProfileSource, included: boolean) {
    startTransition(async () => {
      const result = await setProfileSourceIncluded(companyId, source.kind, source.id, included);
      if (!result.ok) {
        showToast(result.error ?? "자료 설정을 저장하지 못했습니다.");
        return;
      }
      refresh(included ? "매칭 기준에 포함했습니다" : "매칭 기준에서 제외했습니다");
    });
  }

  function submitTask(formData: FormData) {
    if (!taskMatch) return;
    startTransition(async () => {
      const result = await createTaskFromProgram(companyId, taskMatch.program.id, formData);
      if (!result.ok) {
        showToast(result.error ?? "Task를 만들지 못했습니다.");
        return;
      }
      setTaskMatch(null);
      refresh(result.existed ? "이미 연결된 Task로 이동할 수 있습니다" : "신청 Task를 생성했습니다");
    });
  }

  return (
    <>
      <div className="gov-page-head">
        <div>
          <div className="gov-page-kicker"><IconSparkle /> 기업 이력 기반 맞춤 분석</div>
          <h1>맞춤 정부지원사업</h1>
          <p>등록된 기업정보와 업무 이력을 근거로 지원 가능성이 높은 공고를 먼저 보여드립니다.</p>
        </div>
        <div className="gov-company-switcher">
          <label htmlFor="gov-company-select">분석 기업</label>
          <select
            id="gov-company-select"
            className="select-pill"
            value={companyId}
            onChange={(event) => switchCompany(event.currentTarget.value)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}{company.status === "ended" ? " · 종료" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {data ? (
        <section className="gov-profile-card">
          <div className="gov-profile-score" aria-label={`매칭 프로필 완성도 ${data.profile.completeness}%`}>
            <strong>{data.profile.completeness}</strong>
            <span>%</span>
          </div>
          <div className="gov-profile-main">
            <div className="gov-profile-title-row">
              <div>
                <h2>{data.profile.company.name} 매칭 프로필</h2>
                <p>
                  {data.profile.company.industry ?? "업종 미입력"} · {data.profile.company.region ?? "지역 미입력"} · {formatRevenue(data.profile.company.revenue)} · {data.profile.company.headcount !== null ? `${data.profile.company.headcount}명` : "인원 미입력"}
                </p>
              </div>
              <div className="gov-profile-actions">
                <Button variant="ghost" size="sm" onClick={() => setSourcesOpen(true)}>
                  <IconFile /> 기준 자료 {sourceCount(data.profile)}건
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={state.status === "loading" || pending}
                  onClick={() =>
                    refresh("기업 이력과 등록 자료를 다시 분석하고 있습니다", true)
                  }
                >
                  <IconRefresh /> 재분석
                </Button>
              </div>
            </div>
            <div className="gov-profile-progress"><span style={{ width: `${data.profile.completeness}%` }} /></div>
            {data.profile.missingInformation.length > 0 ? (
              <div className="gov-missing-strip">
                <IconInfo />
                <span>
                  <b>{data.profile.missingInformation[0].label}</b> 정보가 없어 일부 자격조건은 확인이 필요합니다.
                </span>
                <Link href={`/app/companies/${companyId}`}>기업정보 보완 <IconArrow /></Link>
              </div>
            ) : (
              <div className="gov-profile-ready"><IconCheck /> 주요 매칭 정보가 모두 등록되어 있습니다.</div>
            )}
          </div>
        </section>
      ) : null}

      <div className="gov-filter-shell">
        <div className="gov-status-tabs" role="tablist" aria-label="공고 상태">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={filters.status === option.value}
              className={`pill-tab${filters.status === option.value ? " is-active" : ""}`}
              onClick={() => updateFilter("status", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="filter-bar gov-filter-bar">
          <div className="search-pill">
            <IconSearch />
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.currentTarget.value)}
              placeholder="공고명·기관·기술·등록 이력 검색"
              aria-label="정부지원사업 검색"
            />
          </div>
          <select className="select-pill" value={filters.eligibility} onChange={(event) => updateFilter("eligibility", event.currentTarget.value as Filters["eligibility"])} aria-label="지원 가능성">
            {ELIGIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="select-pill" value={filters.field} onChange={(event) => updateFilter("field", event.currentTarget.value)} aria-label="지원분야">
            <option value="all">지원분야 전체</option>
            {SUPPORT_FIELDS.map((field) => <option key={field} value={field}>{SUPPORT_FIELD_LABEL[field]}</option>)}
          </select>
          <select className="select-pill" value={filters.region} onChange={(event) => updateFilter("region", event.currentTarget.value)} aria-label="지역">
            <option value="all">지역 전체</option>
            <option value="national">전국/지역무관</option>
            {REGION_OPTIONS.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
          <select className="select-pill" value={filters.due} onChange={(event) => updateFilter("due", event.currentTarget.value as ProgramDueFilter)} aria-label="마감기간">
            {DUE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="select-pill" value={filters.fit} onChange={(event) => updateFilter("fit", event.currentTarget.value as ProgramFitFilter)} aria-label="적합도">
            {FIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="spacer" />
          <select className="select-pill" value={filters.sort} onChange={(event) => updateFilter("sort", event.currentTarget.value as ProgramSortKey)} aria-label="정렬">
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      {state.status === "error" && data ? (
        <div className="gov-inline-error" role="alert">
          <IconAlert />
          <span>{state.error}</span>
          <Button variant="ghost" size="sm" onClick={() => refresh()}>다시 시도</Button>
        </div>
      ) : null}

      {state.status === "loading" && !data ? <WorkspaceSkeleton /> : null}
      {state.status === "error" && !data ? (
        <EmptyState
          icon={<IconAlert />}
          title="맞춤 공고를 불러오지 못했습니다"
          description={state.error}
          action={<Button variant="secondary" onClick={() => refresh()}>다시 시도</Button>}
        />
      ) : null}
      {data ? (
        <div className={`gov-workspace-grid${selected ? " has-selection" : ""}`}>
          <section className="gov-list-pane" aria-label="맞춤 공고 목록">
            <div className="gov-list-head">
              <div>
                <strong>{data.filteredTotal}건</strong>
                <span>전체 분석 {data.total}건</span>
              </div>
              {state.status === "loading" ? <span className="gov-updating"><IconRefresh /> 갱신 중</span> : null}
            </div>
            {data.enabledSources.length === 0 ? (
              <EmptyState bare icon={<IconAlert />} title="공고 동기화가 설정되지 않았습니다" description="정부지원사업 API 키를 설정하면 맞춤 공고가 표시됩니다." />
            ) : data.matches.length === 0 ? (
              <EmptyState bare icon={<IconSearch />} title="조건에 맞는 공고가 없습니다" description="필터 조건을 완화하거나 제외 상태를 확인해 보세요." />
            ) : (
              <div className="gov-result-list">
                {data.matches.map((match) => {
                  const eligibility = eligibilityMeta(match.eligibility);
                  const daysLeft = match.program.apply_end ? daysFromToday(match.program.apply_end) : null;
                  return (
                    <button
                      type="button"
                      className={`gov-result-card${selectedProgramId === match.program.id ? " is-selected" : ""}`}
                      key={match.program.id}
                      onClick={() => setSelectedProgramId(match.program.id)}
                    >
                      <div className="gov-result-top">
                        <Badge tone={eligibility.tone}>{eligibility.label}</Badge>
                        {match.reviewDecision === "saved" ? <Badge tone="primary">관심</Badge> : null}
                        {match.linkedTaskId ? <Badge tone="neutral">Task</Badge> : null}
                        <span className="spacer" />
                        <span className="gov-result-score"><b>{match.score}</b>점</span>
                      </div>
                      <h3>{match.program.title}</h3>
                      <div className="gov-result-meta">
                        <span>{match.program.org_name ?? sourceLabel(match.program.source)}</span>
                        {daysLeft !== null ? <DdayBadge daysLeft={daysLeft} /> : <span>상시접수</span>}
                      </div>
                      <div className="gov-result-reason">
                        {match.warnings[0] ?? match.reasons[0] ?? "기업정보와 공고 조건을 비교했습니다."}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {data.filteredTotal > data.pageSize ? (
              <div className="gov-pagination">
                <Button variant="ghost" size="sm" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>이전</Button>
                <span>{filters.page} / {pageCount}</span>
                <Button variant="ghost" size="sm" disabled={!data.hasMore} onClick={() => updateFilter("page", filters.page + 1)}>다음</Button>
              </div>
            ) : null}
            {data.poolTruncated ? <p className="gov-pool-note">마감이 먼 일부 공고는 다음 동기화 결과에서 표시될 수 있습니다.</p> : null}
          </section>

          {selected ? (
            <ProgramDetail
              match={selected}
              canManage={data.canManageWorkflow && !data.demo && data.companyStatus === "active"}
              pending={pending}
              onBack={() => setSelectedProgramId(null)}
              onDecision={(decision) => changeDecision(selected, decision)}
              onTask={() => setTaskMatch(selected)}
              companyId={companyId}
            />
          ) : (
            <section className="gov-detail-pane gov-detail-pane--empty">
              <IconTarget />
              <h2>공고를 선택해 상세 분석을 확인하세요</h2>
              <p>지원 가능 여부, 적합도 점수와 판단에 사용된 기업 이력을 함께 보여드립니다.</p>
            </section>
          )}
        </div>
      ) : null}

      {sourcesOpen && data ? (
        <ProfileSourcePanel
          sources={data.profile.sources}
          canManage={data.canManageProfile && !data.demo && data.companyStatus === "active"}
          pending={pending}
          onToggle={toggleSource}
          onClose={() => setSourcesOpen(false)}
        />
      ) : null}
      {taskMatch ? (
        <ProgramTaskPanel match={taskMatch} pending={pending} onSubmit={submitTask} onClose={() => setTaskMatch(null)} />
      ) : null}
      <Toast message={toast} />
    </>
  );
}

function ProgramDetail({
  match,
  companyId,
  canManage,
  pending,
  onBack,
  onDecision,
  onTask,
}: {
  match: CompanyProgramMatch;
  companyId: string;
  canManage: boolean;
  pending: boolean;
  onBack: () => void;
  onDecision: (decision: ProgramReviewDecision | null) => void;
  onTask: () => void;
}) {
  const eligibility = eligibilityMeta(match.eligibility);
  const label = supportLabel(match.program.support_field);
  const region = programRegion(match);
  const detailUrl = safeHttpUrl(match.program.detail_url);

  return (
    <section className="gov-detail-pane" aria-label="공고 상세 분석">
      <button type="button" className="gov-mobile-back" onClick={onBack}><IconBack /> 목록으로</button>
      <div className="gov-detail-head">
        <div className="gov-detail-badges">
          <Badge tone={eligibility.tone}>{eligibility.label}</Badge>
          <Badge tone="neutral">{confidenceLabel(match.confidence)}</Badge>
          {label ? <CategoryChip name={label} /> : null}
        </div>
        <h2>{match.program.title}</h2>
        <div className="gov-detail-meta">
          <span>{match.program.org_name ?? "기관 미표기"}</span>
          <span>{region ?? "지역 확인 필요"}</span>
          <span>{match.program.apply_end ? `${formatDotDateString(match.program.apply_end)} 마감` : "상시접수"}</span>
        </div>
      </div>

      <div className="gov-score-hero">
        <div className="gov-score-number"><strong>{match.score}</strong><span>/ 100</span></div>
        <div>
          <b>기업–공고 적합도</b>
          <p>선정 확률이 아니라 현재 등록된 기업정보와 공고 조건의 적합 정도입니다.</p>
        </div>
      </div>

      <div className="gov-detail-actions">
        <Button
          variant={match.reviewDecision === "saved" ? "cta" : "secondary"}
          size="sm"
          disabled={!canManage || pending}
          onClick={() => onDecision(match.reviewDecision === "saved" ? null : "saved")}
        >
          <IconCheck /> {match.reviewDecision === "saved" ? "관심 저장됨" : "관심 저장"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canManage || pending}
          onClick={() => onDecision(match.reviewDecision === "excluded" ? null : "excluded")}
        >
          <IconX /> {match.reviewDecision === "excluded" ? "제외 취소" : "추천 제외"}
        </Button>
        {match.linkedTaskId ? (
          <LinkButton variant="secondary" size="sm" href={`/app/companies/${companyId}?tab=tasks`}>
            연결 Task 보기 <IconArrow />
          </LinkButton>
        ) : (
          <Button variant="cta" size="sm" disabled={!canManage || pending} onClick={onTask}>
            Task로 전환 <IconArrow />
          </Button>
        )}
      </div>

      {match.warnings.length > 0 ? (
        <section className={`gov-analysis-section gov-analysis-section--${match.eligibility === "ineligible" ? "critical" : "warning"}`}>
          <h3><IconAlert /> {match.eligibility === "ineligible" ? "조건 불충족 근거" : "신청 전 확인할 정보"}</h3>
          <ul>{match.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>
      ) : null}

      <section className="gov-analysis-section">
        <h3><IconSparkle /> 왜 추천하나요?</h3>
        <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </section>

      <section className="gov-analysis-section">
        <h3>판단 지표</h3>
        <p className="gov-breakdown-note">자격조건은 신청 가능성 판단 지표이며 점수에 중복 합산되지 않습니다.</p>
        <div className="gov-breakdown-list">
          {match.scoreBreakdown.map((part) => (
            <div className="gov-breakdown-row" key={part.key}>
              <span>{part.label}</span>
              <div><i style={{ width: `${Math.min(100, (part.score / part.max) * 100)}%` }} /></div>
              <b>{part.score}/{part.max}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="gov-analysis-section">
        <h3><IconBuilding /> 판단에 사용한 기업 이력</h3>
        {match.evidence.length > 0 ? (
          <div className="gov-evidence-list">
            {match.evidence.map((evidence) => (
              <Link href={evidence.href} className="gov-evidence-row" key={`${evidence.sourceKind}:${evidence.sourceId}`}>
                <span><b>{evidence.label}</b><small>{evidence.detail}</small></span>
                <IconArrow />
              </Link>
            ))}
          </div>
        ) : (
          <p className="gov-muted-copy">직접 연관된 등록 이력이 적어 기업 기본정보 중심으로 분석했습니다.</p>
        )}
      </section>

      <section className="gov-analysis-section">
        <h3><IconFile /> 공고 주요 내용</h3>
        {match.program.summary ? (
          <p className="gov-program-summary">{match.program.summary}</p>
        ) : null}
        <p className="gov-target-text">{match.program.target_text ?? "공고 원문에서 지원대상과 세부 조건을 확인해 주세요."}</p>
        <div className="gov-program-facts">
          <span><b>출처</b>{sourceLabel(match.program.source)}</span>
          <span><b>신청기간</b>{match.program.apply_start ?? "미표기"} ~ {match.program.apply_end ?? "상시"}</span>
          <span><b>지원규모</b>{match.program.support_amount ?? "공고 원문 확인"}</span>
        </div>
      </section>

      <div className="gov-detail-footer">
        <p><IconInfo /> 최종 신청 가능 여부는 반드시 최신 공고 원문과 제출기관 안내를 확인해 주세요.</p>
        {detailUrl ? (
          <LinkButton variant="secondary" href={detailUrl} target="_blank" rel="noopener noreferrer">
            공고 원문 보기 <IconLink />
          </LinkButton>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert, IconTarget } from "@/components/ui/icons";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { daysFromToday } from "@/lib/datetime";
import type { CompanyProgramMatchesData } from "@/lib/data/company-programs";
import { PROGRAM_SOURCE_LABEL, SUPPORT_FIELD_LABEL } from "@/lib/labels";
import {
  isSourceCode,
  isSupportField,
  type SourceCode,
  type SupportField,
} from "@/lib/gov-programs/types";

const INITIAL_VISIBLE = 6;
const cache = new Map<string, CompanyProgramMatchesData>();

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

function scoreTone(score: number): string {
  if (score >= 80) return "is-high";
  if (score >= 50) return "is-mid";
  return "is-low";
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
  const visibleMatches = useMemo(
    () => matches.slice(0, visible),
    [matches, visible],
  );

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
        count={`${matches.length}건`}
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
          <div className="program-list">
            {visibleMatches.map(({ program, score, reasons }) => {
              const label = supportLabel(program.support_field);
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
                      <Badge tone="neutral">{sourceLabel(program.source)}</Badge>
                      {label ? <CategoryChip name={label} /> : null}
                      {program.org_name ? <span>{program.org_name}</span> : null}
                      {daysLeft !== null ? <DdayBadge daysLeft={daysLeft} /> : null}
                    </div>
                    <div className="match-bar" aria-label={`매치 점수 ${score}점`}>
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
          {visible < matches.length ? (
            <button
              type="button"
              className="program-more"
              onClick={() => setVisible(matches.length)}
            >
              더 보기
            </button>
          ) : null}
        </>
      )}
    </Panel>
  );
}

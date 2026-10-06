"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BriefingView } from "@/lib/briefing/types";
import styles from "./HermesBriefing.module.css";

const EMPTY: BriefingView = { briefing: null, checkedAt: null, nextAt: null, job: null, stale: true };

function timeLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul",
  }).format(new Date(value)) : "아직 없음";
}

export function HermesBriefing({ userId, initial, chatEnabled, initialError = false, preview = false }: {
  userId: string;
  initial: BriefingView | null;
  chatEnabled: boolean;
  initialError?: boolean;
  preview?: boolean;
}) {
  const [view, setView] = useState(initial ?? EMPTY);
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState(initialError ? "업무 점검에 연결하지 못했습니다." : "");
  const automaticKey = useRef<string | null>(null);
  const pollController = useRef<AbortController | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const requestActive = useRef(false);
  const storageKey = `hermes-briefing:v1:${userId}:${preview ? "preview" : "live"}:collapsed`;

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(storageKey) === "true"); } catch {}
  }, [storageKey]);

  const refresh = useCallback(async () => {
    if (preview || requestActive.current) return;
    requestActive.current = true;
    setRequesting(true);
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const response = await fetch("/api/assistant/briefings/refresh", { method: "POST", signal: controller.signal });
      if ([401, 403, 404].includes(response.status)) { setHidden(true); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      setView((current) => ({ ...current, job: { id: data.jobId, status: "queued", error_code: null } }));
      setError("");
    } catch {
      if (!controller.signal.aborted) setError("점검 요청을 보내지 못했습니다. 다시 시도해 주세요.");
    } finally {
      requestActive.current = false;
      if (!controller.signal.aborted) setRequesting(false);
    }
  }, [preview]);

  useEffect(() => {
    if (preview || hidden) return;
    let disposed = false;
    async function poll() {
      if (document.visibilityState !== "visible" || pollController.current) return;
      const controller = new AbortController();
      pollController.current = controller;
      try {
        const response = await fetch("/api/assistant/briefings/latest", { cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if ([401, 403, 404].includes(response.status)) { setHidden(true); return; }
        if (!response.ok) throw new Error();
        const data = await response.json() as BriefingView;
        if (!disposed) { setView(data); setError(""); }
      } catch {
        if (!controller.signal.aborted && !disposed) setError("최신 점검 정보를 불러오지 못했습니다. 최근 결과를 표시합니다.");
      } finally { pollController.current = null; }
    }
    const timer = window.setInterval(() => void poll(), 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
      else pollController.current?.abort();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      pollController.current?.abort();
      requestController.current?.abort();
    };
  }, [hidden, preview]);

  const pending = requesting || view.job?.status === "queued" || view.job?.status === "running";
  useEffect(() => {
    if (preview || hidden || pending || !view.stale || error) return;
    const key = view.nextAt ?? "first";
    if (automaticKey.current === key) return;
    automaticKey.current = key;
    void refresh();
  }, [hidden, pending, view.stale, view.nextAt, error, refresh, preview]);

  if (hidden) return null;
  const result = view.briefing?.result;
  const delayed = Boolean(view.nextAt && Date.parse(view.nextAt) + 300_000 < Date.now());
  const jobError = view.job?.error_code;
  const status = jobError === "quota" ? "오늘의 AI 요약 한도에 도달했습니다. 업무 점검은 계속됩니다."
    : jobError === "source_unavailable" ? "일부 업무를 불러오지 못했습니다. 다시 확인하고 있습니다."
    : delayed ? "최신 점검이 지연되고 있습니다."
    : view.job?.status === "queued" ? "다음 점검 실행을 기다리고 있습니다."
    : pending ? "업무 변경사항을 확인하고 있습니다."
    : view.job?.status === "failed" ? "Hermes 연결을 확인해 주세요."
    : view.stale ? "업무가 변경되어 새 요약을 준비하고 있습니다."
    : "최근 업무 점검 완료";

  function ask(sourceId?: string) {
    if (preview) return;
    window.dispatchEvent(new CustomEvent("hermes:ask", { detail: { briefingId: view.briefing?.id, briefingSourceId: sourceId } }));
  }

  return (
    <section className={styles.card} aria-labelledby="hermes-title" aria-busy={pending}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>HERMES · 내 업무{preview ? " · 미리보기" : ""}</span><h2 id="hermes-title">업무 브리핑</h2></div>
        <div className={styles.actions}>
          <button type="button" onClick={() => void refresh()} disabled={preview || pending}>{preview ? "연동 준비 중" : "다시 점검"}</button>
          <button type="button" aria-expanded={!collapsed} aria-controls="hermes-content" onClick={() => {
            setCollapsed(!collapsed);
            try { localStorage.setItem(storageKey, String(!collapsed)); } catch {}
          }}>{collapsed ? "펼치기" : "접기"}</button>
        </div>
      </header>
      <p className={styles.status} role="status">{preview ? "Hermes 연동 전입니다. 아래는 화면 확인을 위한 샘플이며 실제 업무 분석 결과가 아닙니다." : error || status}</p>
      {!preview ? <div className={styles.times}>최근 점검 {timeLabel(view.checkedAt)} · 다음 점검 {timeLabel(view.nextAt)}</div> : null}
      <div id="hermes-content" hidden={collapsed}>
        {result ? (
          <>
            {view.stale || error ? <p className={styles.warning}>아래 요약은 {timeLabel(result.dataAsOf)} 기준입니다. 업무 상세에서 최신 상태를 확인하세요.</p> : null}
            <div className={styles.grid}>
              <div>
                <p className={styles.summary}>{result.summary}</p>
                {!preview ? <div className={styles.times}>요약 생성 {timeLabel(result.generatedAt)}</div> : null}
                <button type="button" className={styles.ask} disabled={preview || !chatEnabled} onClick={() => ask()}>
                  브리핑에 대해 질문
                </button>
                {preview || !chatEnabled ? <p className={styles.times}>{preview ? "Hermes 연동 후 실제 브리핑에 대해 질문할 수 있습니다." : "AI 대화가 설정되면 후속 질문을 사용할 수 있습니다."}</p> : null}
              </div>
              <ol className={`${styles.priorities} ${showAll ? styles.expanded : ""}`}>
                {result.priorities.map((priority, index) => {
                  const source = result.sources.find((item) => item.id === priority.sourceId);
                  if (!source) return null;
                  return <li key={priority.sourceId}>
                    <div className={styles.meta}><span>{index + 1}. {source.responsibility === "direct" ? "직접 할 일" : "관리할 업무"}</span><span className={source.daysLeft !== null && source.daysLeft <= 3 ? styles.warning : ""}>{source.daysLeft === null ? "기한 미정" : source.daysLeft < 0 ? `${-source.daysLeft}일 초과` : source.daysLeft === 0 ? "오늘 마감" : `D-${source.daysLeft}`}</span></div>
                    {source.companyName ? <span className={styles.company}>{source.companyName}</span> : null}
                    <h3>{preview ? source.title : <Link href={source.href}>{source.title}</Link>}</h3>
                    <p>{priority.reason}</p><p className={styles.next}>다음 행동: {priority.nextAction}</p>
                    <div className={styles.actions}>{preview ? <button type="button" disabled>업무 열기 →</button> : <Link href={source.href}>업무 열기 →</Link>}<button type="button" disabled={preview || !chatEnabled} onClick={() => ask(source.id)}>자세히 질문</button></div>
                  </li>;
                })}
              </ol>
            </div>
            {result.priorities.length > 1 ? <button type="button" className={styles.more} aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? "우선 업무 접기" : "우선 업무 더 보기"}</button> : null}
            {!result.priorities.length ? <Link href="/app/board?tab=todos">업무일지 열기 →</Link> : null}
            <details className={styles.details}><summary>오늘의 계획과 변경사항</summary>
              <h3>오늘의 계획</h3>
              {result.plan.length ? <ol>{result.plan.map((step, index) => <li key={index}>{step}</li>)}</ol> : <p>새로 계획할 업무가 없습니다.</p>}
              <h3>최근 변경사항</h3>
              {result.changes.length ? <ul>{result.changes.map((change, index) => <li key={index}>{change}</li>)}</ul> : <p>첫 점검이거나 이전 점검 이후 변경사항이 없습니다.</p>}
            </details>
          </>
        ) : <p className={styles.summary}>{error ? "기존 업무 목록에서 업무를 확인할 수 있습니다." : "첫 브리핑을 준비하고 있습니다. 아래 업무 목록은 바로 이용할 수 있습니다."}</p>}
      </div>
    </section>
  );
}

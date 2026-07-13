"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IconRefresh, IconTeam, IconUser } from "@/components/ui/icons";
import type { DashboardScope } from "@/lib/data/dashboard";

const AUTO_REFRESH_MS = 60_000;

function formatRefreshTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function DashboardToolbar({
  scope,
  canViewTeam,
  lastUpdatedAt,
}: {
  scope: DashboardScope;
  canViewTeam: boolean;
  lastUpdatedAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState(lastUpdatedAt);

  useEffect(() => {
    setRefreshedAt(lastUpdatedAt);
  }, [lastUpdatedAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      startTransition(() => {
        router.refresh();
        setRefreshedAt(new Date().toISOString());
      });
    };

    const syncTimer = () => {
      if (timer) clearInterval(timer);
      timer = document.hidden ? null : setInterval(refresh, AUTO_REFRESH_MS);
    };

    syncTimer();
    document.addEventListener("visibilitychange", syncTimer);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", syncTimer);
    };
  }, [router]);

  function refreshNow() {
    startTransition(() => {
      router.refresh();
      setRefreshedAt(new Date().toISOString());
    });
  }

  return (
    <div className="monitor-toolbar">
      <nav className="monitor-scope-switch" aria-label="관제 범위">
        <Link
          href="/app"
          className={scope === "mine" ? "is-active" : undefined}
          aria-current={scope === "mine" ? "page" : undefined}
        >
          <IconUser /> 내 관제
        </Link>
        {canViewTeam ? (
          <Link
            href="/app?scope=team"
            className={scope === "team" ? "is-active" : undefined}
            aria-current={scope === "team" ? "page" : undefined}
          >
            <IconTeam /> 팀 관제
          </Link>
        ) : null}
      </nav>
      <div className="monitor-refresh-meta" aria-live="polite">
        <span>
          {isPending ? "갱신 중" : `최근 갱신 ${formatRefreshTime(refreshedAt)}`}
        </span>
        <button
          type="button"
          className="monitor-refresh-button"
          onClick={refreshNow}
          disabled={isPending}
          aria-label="대시보드 지금 갱신"
          title="지금 갱신"
        >
          <IconRefresh className={isPending ? "is-spinning" : undefined} />
        </button>
      </div>
    </div>
  );
}

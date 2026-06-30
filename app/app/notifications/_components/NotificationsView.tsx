"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconArrow,
  IconBell,
  IconBellOff,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChecks,
  IconClock,
  IconTarget,
} from "@/components/ui/icons";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { NOTIFICATION_TYPE_LABEL } from "@/lib/labels";
import type { NotificationType } from "@/lib/database.types";
import type {
  NotificationGroup,
  NotificationItem,
  NotificationsData,
} from "@/lib/data/notifications";

type TypeFilter = "all" | NotificationType;

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "expiry", label: NOTIFICATION_TYPE_LABEL.expiry },
  { value: "deadline", label: NOTIFICATION_TYPE_LABEL.deadline },
  { value: "program_match", label: NOTIFICATION_TYPE_LABEL.program_match },
];

const GROUPS: { key: NotificationGroup; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "earlier", label: "이전" },
];

const TYPE_ICO_CLASS: Record<NotificationType, string> = {
  expiry: "alert-ico--expiry",
  deadline: "alert-ico--deadline",
  program_match: "alert-ico--match",
};

const REF_TAB: Record<string, string> = {
  credential: "cert",
  ip_deadline: "ip",
  task: "tasks",
  schedule: "schedule",
};

function typeIcon(type: NotificationType) {
  switch (type) {
    case "expiry":
      return <IconClock />;
    case "deadline":
      return <IconCalendar />;
    case "program_match":
      return <IconTarget />;
  }
}

// D-day 긴급도 규칙 (화면설계 0절과 동일 임계값 — 텍스트 표기)
function Ddi({ daysLeft }: { daysLeft: number }) {
  const tone =
    daysLeft <= 3 ? "ddi--red" : daysLeft <= 7 ? "ddi--amber" : "ddi--gray";
  const label =
    daysLeft < 0
      ? `D+${-daysLeft}`
      : daysLeft === 0
        ? "D-day"
        : `D-${daysLeft}`;
  return <span className={`ddi num ${tone}`}>{label}</span>;
}

function NotifRow({
  n,
  read,
  onRead,
  onGo,
}: {
  n: NotificationItem;
  read: boolean;
  onRead: () => void;
  onGo: () => void;
}) {
  const icoClass = n.isUrgent ? "alert-ico--urgent" : TYPE_ICO_CLASS[n.type];
  return (
    <div
      role="button"
      tabIndex={0}
      className={`notif${read ? " is-read" : ""}${n.isUrgent ? " is-urgent" : ""}`}
      onClick={onRead}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRead();
        }
      }}
    >
      <div className={`n-icon ${icoClass}`}>{typeIcon(n.type)}</div>
      <div className="n-body">
        <div className="n-titlerow">
          <span className="tpill">{NOTIFICATION_TYPE_LABEL[n.type]}</span>
          {n.isUrgent ? <span className="urg-badge">긴급</span> : null}
          <span className="n-title">{n.title}</span>
          {n.daysLeft !== null ? <Ddi daysLeft={n.daysLeft} /> : null}
        </div>
        {n.companyName ? (
          <div className="n-sub">
            <IconBuilding />
            {n.companyName}
          </div>
        ) : null}
      </div>
      <div className="n-right">
        <span className="n-time num">{n.timeLabel}</span>
        <span className={`n-udot${read ? " is-ph" : ""}`} />
        <div className="n-actions">
          {!read ? (
            <button
              type="button"
              className="abtn"
              onClick={(e) => {
                e.stopPropagation();
                onRead();
              }}
            >
              <IconCheck /> 읽음 처리
            </button>
          ) : null}
          {n.companyId ? (
            <button
              type="button"
              className="abtn abtn--go"
              onClick={(e) => {
                e.stopPropagation();
                onGo();
              }}
            >
              <IconArrow /> 기업으로 이동
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NotificationsView({ data }: { data: NotificationsData }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [, startTransition] = useTransition();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  // 서버 반영 전까지의 낙관적 읽음 오버라이드 (실패 시 복귀)
  const [readOverride, setReadOverride] = useState<Record<string, true>>({});
  const [allRead, setAllRead] = useState(false);

  const isRead = (n: NotificationItem) =>
    allRead || readOverride[n.id] === true || n.isRead;

  const unread = data.notifications.filter((n) => !isRead(n)).length;

  const filtered = useMemo(
    () =>
      data.notifications.filter((n) => {
        if (typeFilter !== "all" && n.type !== typeFilter) return false;
        if (companyFilter !== "all" && n.companyId !== companyFilter)
          return false;
        return true;
      }),
    [data.notifications, typeFilter, companyFilter],
  );

  const isFiltered = typeFilter !== "all" || companyFilter !== "all";

  function markRead(n: NotificationItem) {
    if (isRead(n)) return;
    setReadOverride((prev) => ({ ...prev, [n.id]: true }));
    startTransition(async () => {
      const result = await markNotificationRead(n.id);
      if (!result.ok) {
        setReadOverride((prev) => {
          const next = { ...prev };
          delete next[n.id];
          return next;
        });
        showToast(result.error ?? "읽음 처리에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function markAll() {
    if (unread === 0) return;
    setAllRead(true);
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setAllRead(false);
        showToast(result.error ?? "읽음 처리에 실패했습니다.");
        return;
      }
      showToast("모든 알림을 읽음 처리했습니다");
      router.refresh();
    });
  }

  function goCompany(n: NotificationItem) {
    if (!n.companyId) return;
    // 데모 모드는 저장 불가 — 이동만. 실 모드는 읽음 처리 후 이동(실패해도 이동은 유지)
    if (!data.demo && !isRead(n)) {
      setReadOverride((prev) => ({ ...prev, [n.id]: true }));
      void markNotificationRead(n.id);
    }
    const tab = n.refTable ? REF_TAB[n.refTable] : null;
    router.push(tab ? `/app/companies/${n.companyId}?tab=${tab}` : `/app/companies/${n.companyId}`);
  }

  return (
    <>
      <div className="page-head page-head--center">
        <div className="nc-title">
          <h1>알림</h1>
          {unread > 0 ? (
            <span className="ucount num">안읽음 {unread}</span>
          ) : null}
        </div>
        <div className="spacer" />
        <div className="head-actions">
          <Button
            variant="secondary"
            size="sm"
            disabled={unread === 0}
            onClick={markAll}
          >
            <IconChecks /> 모두 읽음 처리
          </Button>
        </div>
      </div>

      {data.notifications.length === 0 ? (
        <EmptyState
          icon={<IconBell />}
          title="새 알림이 없습니다"
          description="만료·마감·공고매칭 알림이 도착하면 여기에서 모아 확인할 수 있습니다."
        />
      ) : (
        <>
          <div className="filter-bar">
            <div className="tag-tabs">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`pill-tab${typeFilter === tab.value ? " is-active" : ""}`}
                  onClick={() => setTypeFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="spacer" />
            <select
              className="select-pill"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="기업 필터"
            >
              <option value="all">기업 전체</option>
              {data.companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<IconBellOff />}
              title="해당 조건의 알림이 없습니다"
              description="다른 유형 탭을 선택하거나 필터를 초기화해 보세요."
              action={
                isFiltered ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTypeFilter("all");
                      setCompanyFilter("all");
                    }}
                  >
                    필터 초기화
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="inbox">
              {GROUPS.map((group) => {
                const rows = filtered.filter((n) => n.group === group.key);
                if (rows.length === 0) return null;
                const groupUnread = rows.filter((n) => !isRead(n)).length;
                return (
                  <section key={group.key} aria-label={group.label}>
                    <div className="grp-head">
                      {group.label}
                      {groupUnread > 0 ? (
                        <span className="gc num">· 안읽음 {groupUnread}</span>
                      ) : null}
                    </div>
                    {rows.map((n) => (
                      <NotifRow
                        key={n.id}
                        n={n}
                        read={isRead(n)}
                        onRead={() => markRead(n)}
                        onGo={() => goCompany(n)}
                      />
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <Toast message={toast} />
    </>
  );
}

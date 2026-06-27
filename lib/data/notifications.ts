import { createClient } from "@/lib/supabase/server";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";
import { formatKstDotDate, formatKstTime, kstDayDiff } from "@/lib/datetime";
import type { NotificationType } from "@/lib/database.types";
import type { CompanyOption } from "@/lib/data/board";

/** 오늘/어제/이전 그룹핑 — 서버에서 계산해 내려보낸다 (하이드레이션 시각차 방지) */
export type NotificationGroup = "today" | "yesterday" | "earlier";

/** 데모/실DB 공통 원본 행 — group·timeLabel 계산 전 */
export interface RawNotification {
  id: string;
  type: NotificationType;
  title: string;
  isUrgent: boolean;
  isRead: boolean;
  companyId: string | null;
  companyName: string | null;
  /** ref(자격·과제·일정)의 마감 D-day — deadline_item 뷰에서 역참조 */
  daysLeft: number | null;
  createdAt: string;
}

export interface NotificationItem extends RawNotification {
  group: NotificationGroup;
  /** 오늘·어제 = "HH:mm" / 이전 = "MM.DD" */
  timeLabel: string;
}

export interface RawNotificationsData {
  demo: boolean;
  notifications: RawNotification[];
  companies: CompanyOption[];
}

export interface NotificationsData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  /** 최신순 정렬 */
  notifications: NotificationItem[];
  companies: CompanyOption[];
}

function decorate(raw: RawNotification, now: Date): NotificationItem {
  const created = new Date(raw.createdAt);
  // 오늘/어제/이전 그룹·시각 라벨 모두 KST 달력 기준 (운영 UTC와 무관)
  const dayDiff = kstDayDiff(now, created);
  const group: NotificationGroup =
    dayDiff <= 0 ? "today" : dayDiff === 1 ? "yesterday" : "earlier";
  const timeLabel =
    group === "earlier" ? formatKstDotDate(created) : formatKstTime(created);
  return { ...raw, group, timeLabel };
}

export async function getNotificationsData(): Promise<NotificationsData> {
  const now = new Date();
  const supabase = await createClient();
  if (!supabase) {
    const demo = DEMO_NOTIFICATIONS();
    return {
      ...demo,
      notifications: demo.notifications.map((n) => decorate(n, now)),
    };
  }

  const [notifications, companies] = await Promise.all([
    supabase
      .from("notification")
      .select(
        "id, type, title, is_urgent, is_read, company_id, ref_table, ref_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("company").select("id, name").order("name"),
  ]);

  const firstError = notifications.error ?? companies.error;
  if (firstError) {
    throw new Error(`알림을 불러오지 못했습니다: ${firstError.message}`);
  }

  const refIds = [
    ...new Set(
      (notifications.data ?? [])
        .map((n) => n.ref_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const deadlines =
    refIds.length > 0
      ? await supabase
          .from("deadline_item")
          .select("source, id, days_left")
          .in("id", refIds)
      : { data: [], error: null };
  if (deadlines.error) {
    throw new Error(`알림을 불러오지 못했습니다: ${deadlines.error.message}`);
  }

  const companyName = new Map(
    (companies.data ?? []).map((c) => [c.id, c.name]),
  );
  const daysLeftByRef = new Map(
    (deadlines.data ?? []).map((d) => [`${d.source}:${d.id}`, d.days_left]),
  );

  return {
    demo: false,
    notifications: (notifications.data ?? []).map((n) =>
      decorate(
        {
          id: n.id,
          type: n.type,
          title: n.title,
          isUrgent: n.is_urgent,
          isRead: n.is_read,
          companyId: n.company_id,
          companyName: n.company_id
            ? (companyName.get(n.company_id) ?? null)
            : null,
          daysLeft:
            n.ref_table && n.ref_id
              ? (daysLeftByRef.get(`${n.ref_table}:${n.ref_id}`) ?? null)
              : null,
          createdAt: n.created_at,
        },
        now,
      ),
    ),
    companies: companies.data ?? [],
  };
}

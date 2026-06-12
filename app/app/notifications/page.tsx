import type { Metadata } from "next";
import { IconAlert } from "@/components/ui/icons";
import { getNotificationsData } from "@/lib/data/notifications";
import { NotificationsView } from "./_components/NotificationsView";

export const metadata: Metadata = { title: "알림" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const data = await getNotificationsData();

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <NotificationsView data={data} />
    </>
  );
}

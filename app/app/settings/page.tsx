import type { Metadata } from "next";
import { IconAlert } from "@/components/ui/icons";
import { getSettingsData } from "@/lib/data/settings";
import { SettingsView } from "./_components/SettingsView";

export const metadata: Metadata = { title: "설정" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getSettingsData();

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <div className="page-head">
        <h1>설정</h1>
      </div>

      <SettingsView data={data} />
    </>
  );
}

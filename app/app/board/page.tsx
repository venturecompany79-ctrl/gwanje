import type { Metadata } from "next";
import { IconAlert } from "@/components/ui/icons";
import { getBoardData } from "@/lib/data/board";
import { getTodoBoardData } from "@/lib/data/todos";
import { BoardView, type BoardTab } from "./_components/BoardView";

export const metadata: Metadata = { title: "Task 보드" };
export const dynamic = "force-dynamic";

function resolveTab(tab?: string): BoardTab {
  return tab === "tasks" ? "tasks" : "todos";
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; journal?: string }>;
}) {
  const { tab, journal } = await searchParams;
  const activeTab = resolveTab(tab);
  const view =
    activeTab === "tasks"
      ? ({ activeTab, data: await getBoardData() } as const)
      : ({ activeTab, data: await getTodoBoardData(journal) } as const);

  return (
    <>
      {view.data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <BoardView {...view} journal={journal} />
    </>
  );
}

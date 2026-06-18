import type { Metadata } from "next";
import { IconAlert } from "@/components/ui/icons";
import { getBoardData } from "@/lib/data/board";
import { getTodoBoardData } from "@/lib/data/todos";
import { BoardView, type BoardTab } from "./_components/BoardView";

export const metadata: Metadata = { title: "과제 보드" };
export const dynamic = "force-dynamic";

function resolveTab(tab?: string): BoardTab {
  return tab === "tasks" ? "tasks" : "todos";
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = resolveTab(tab);
  const data = activeTab === "tasks" ? await getBoardData() : null;
  const todoData = activeTab === "todos" ? await getTodoBoardData() : null;
  const demo = (data?.demo ?? false) || (todoData?.demo ?? false);

  return (
    <>
      {demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <BoardView activeTab={activeTab} data={data} todoData={todoData} />
    </>
  );
}

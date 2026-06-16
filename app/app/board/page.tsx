import type { Metadata } from "next";
import { IconAlert } from "@/components/ui/icons";
import { getBoardData } from "@/lib/data/board";
import { getTodoBoardData } from "@/lib/data/todos";
import { BoardView } from "./_components/BoardView";

export const metadata: Metadata = { title: "관리포인트 보드" };
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [data, todoData] = await Promise.all([
    getBoardData(),
    getTodoBoardData(),
  ]);

  return (
    <>
      {data.demo || todoData.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <BoardView data={data} todoData={todoData} />
    </>
  );
}

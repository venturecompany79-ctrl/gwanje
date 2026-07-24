"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconKanban,
  IconList,
  IconPlus,
} from "@/components/ui/icons";
import type { BoardData } from "@/lib/data/board";
import { TODO_BOARD_DAY_COUNT, type TodoBoardData } from "@/lib/todos";
import { TodoBoard } from "./TodoBoard";

export type BoardTab = "todos" | "tasks";

const TaskBoard = dynamic(
  () => import("./TaskBoard").then((mod) => mod.TaskBoard),
  { loading: () => <TaskBoardFallback /> },
);

function TaskBoardFallback() {
  return (
    <>
      <div className="filter-bar">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 110, height: 40, borderRadius: 100 }}
          />
        ))}
        <div className="spacer" />
        <div
          className="skeleton"
          style={{ width: 280, height: 42, borderRadius: 100 }}
        />
      </div>
      <div className="board">
        {Array.from({ length: 4 }, (_, col) => (
          <div key={col} className="kcol" style={{ minHeight: 360 }}>
            <div className="kcol-head">
              <div className="skeleton" style={{ width: 90, height: 18 }} />
            </div>
            <div className="kcol-body">
              {Array.from({ length: col === 3 ? 1 : 2 }, (_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 124, borderRadius: 8 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

type BoardViewProps =
  | {
      activeTab: "todos";
      data: TodoBoardData;
      journal?: string;
    }
  | {
      activeTab: "tasks";
      data: BoardData;
      journal?: string;
    };

export function BoardView(props: BoardViewProps) {
  const { toast, showToast } = useToast();
  const [todoAddRequest, setTodoAddRequest] = useState(0);
  const [taskAddRequest, setTaskAddRequest] = useState(0);
  const activeTab = props.activeTab;
  const todoData = activeTab === "todos" ? props.data : null;
  const taskData = activeTab === "tasks" ? props.data : null;

  function preloadTaskBoard() {
    void import("./TaskBoard");
  }

  const selectedJournal =
    props.journal && props.journal !== "me" ? props.journal : null;
  const journalQuery = selectedJournal
    ? `&journal=${encodeURIComponent(selectedJournal)}`
    : "";
  const todosHref = selectedJournal
    ? `/app/board?journal=${encodeURIComponent(selectedJournal)}`
    : "/app/board";
  const tasksHref = `/app/board?tab=tasks${journalQuery}`;
  const todayTodoCount =
    todoData?.notes.filter((note) => note.noteDate === todoData.today).length ??
    0;

  const pageSub =
    activeTab === "todos"
      ? `${todoData?.selectedLabel ?? "업무일지"} · 오늘 ${todayTodoCount}건 · 최근 ${TODO_BOARD_DAY_COUNT}일 ${todoData?.notes.length ?? 0}건`
      : taskData?.tasks.length === 0
        ? "첫 Task를 등록해 시작하세요"
        : `진행 ${taskData?.tasks.filter((task) => task.workStatus !== "completed").length ?? 0}건 · 전체 ${taskData?.tasks.length ?? 0}건`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Task 보드</h1>
          <div className="sub">{pageSub}</div>
        </div>
        <div className="spacer" />
        <div className="head-actions">
          {activeTab === "todos" && todoData?.canCreate ? (
            <Button
              variant="cta"
              size="sm"
              onClick={() => setTodoAddRequest((value) => value + 1)}
            >
              <IconPlus /> 노트 추가
            </Button>
          ) : activeTab === "tasks" && taskData?.canWriteTasks ? (
            <Button
              variant="cta"
              size="sm"
              onClick={() => setTaskAddRequest((value) => value + 1)}
            >
              <IconPlus /> Task 추가
            </Button>
          ) : null}
        </div>
      </div>

      <div className="board-tab-row" role="tablist" aria-label="보드 종류">
        <Link
          href={todosHref}
          prefetch={false}
          className={`pill-tab${activeTab === "todos" ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "todos"}
        >
          <IconList /> 업무일지
        </Link>
        <Link
          href={tasksHref}
          prefetch={false}
          className={`pill-tab${activeTab === "tasks" ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "tasks"}
          onMouseEnter={preloadTaskBoard}
          onFocus={preloadTaskBoard}
          onTouchStart={preloadTaskBoard}
        >
          <IconKanban /> Task 보드
        </Link>
      </div>

      {activeTab === "todos" && todoData ? (
        <TodoBoard
          data={todoData}
          addRequest={todoAddRequest}
          showToast={showToast}
        />
      ) : activeTab === "tasks" && taskData ? (
        <TaskBoard
          data={taskData}
          addRequest={taskAddRequest}
          showToast={showToast}
        />
      ) : null}

      <Toast message={toast} />
    </>
  );
}

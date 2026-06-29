"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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

export function BoardView({
  initialActiveTab,
  data,
  todoData,
}: {
  initialActiveTab: BoardTab;
  data: BoardData;
  todoData: TodoBoardData;
}) {
  const { toast, showToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [todoAddRequest, setTodoAddRequest] = useState(0);
  const [taskAddRequest, setTaskAddRequest] = useState(0);

  useEffect(() => {
    void import("./TaskBoard");
  }, []);

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get("tab") === "tasks" ? "tasks" : "todos");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function selectTab(tab: BoardTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const href = tab === "tasks" ? "/app/board?tab=tasks" : "/app/board";
    window.history.pushState(null, "", href);
  }

  const todayTodoCount = useMemo(
    () =>
      todoData?.notes.filter((note) => note.noteDate === todoData.today)
        .length ?? 0,
    [todoData],
  );

  const pageSub =
    activeTab === "todos"
      ? `${todoData?.selectedLabel ?? "업무일지"} · 오늘 ${todayTodoCount}건 · 최근 ${TODO_BOARD_DAY_COUNT}일 ${todoData?.notes.length ?? 0}건`
      : data?.tasks.length === 0
        ? "첫 Task를 등록해 시작하세요"
        : `전체 ${data?.tasks.length ?? 0}건`;

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
          ) : activeTab === "tasks" && data?.canWriteTasks ? (
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
        <a
          href="/app/board"
          className={`pill-tab${activeTab === "todos" ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "todos"}
          onClick={(e) => {
            e.preventDefault();
            selectTab("todos");
          }}
        >
          <IconList /> 업무일지
        </a>
        <a
          href="/app/board?tab=tasks"
          className={`pill-tab${activeTab === "tasks" ? " is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "tasks"}
          onClick={(e) => {
            e.preventDefault();
            selectTab("tasks");
          }}
        >
          <IconKanban /> Task 보드
        </a>
      </div>

      {activeTab === "todos" ? (
        todoData ? (
          <TodoBoard
            data={todoData}
            addRequest={todoAddRequest}
            showToast={showToast}
          />
        ) : (
          <EmptyState
            icon={<IconList />}
            title="To-dos를 불러오지 못했습니다"
            description="잠시 후 다시 시도해주세요."
          />
        )
      ) : data ? (
        <TaskBoard
          data={data}
          addRequest={taskAddRequest}
          showToast={showToast}
        />
      ) : (
        <EmptyState
          icon={<IconKanban />}
          title="Task 보드를 불러오지 못했습니다"
          description="잠시 후 다시 시도해주세요."
        />
      )}

      <Toast message={toast} />
    </>
  );
}

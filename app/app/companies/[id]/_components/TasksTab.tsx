"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconPlus, IconTarget } from "@/components/ui/icons";
import { Stepper, TaskDday } from "@/components/tasks/Stepper";
import {
  AddTaskSlideOver,
  TaskSlideOver,
} from "@/components/tasks/TaskSlideOver";
import type { CategoryOption, TaskRow } from "@/lib/data/company-detail";

export function TasksTab({
  companyId,
  companyName,
  tasks,
  categories,
  demo,
  showToast,
}: {
  companyId: string;
  companyName: string;
  tasks: TaskRow[];
  categories: CategoryOption[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <Panel>
        <PanelHead
          title="Task"
          count={tasks.length > 0 ? `${tasks.length}건` : undefined}
        >
          <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
            <IconPlus /> Task 추가
          </Button>
        </PanelHead>

        {tasks.length === 0 ? (
          <EmptyState
            bare
            icon={<IconTarget />}
            title="등록된 Task가 없습니다"
            description="인증 갱신, 정부지원사업 신청 같은 Task를 등록하면 단계와 마감이 한눈에 추적됩니다."
            action={
              <Button variant="cta" onClick={() => setAdding(true)}>
                <IconPlus /> Task 추가
              </Button>
            }
          />
        ) : (
          <div className="tasks">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`task${selectedId === t.id ? " is-selected" : ""}`}
                onClick={() => setSelectedId(t.id)}
              >
                <div>
                  <div className="tname">{t.title}</div>
                  <div className="tmeta">
                    <CategoryChip name={t.categoryName} />
                    <Stepper stage={t.stage} />
                  </div>
                </div>
                <div className="spacer" />
                <TaskDday stage={t.stage} daysLeft={t.daysLeft} />
                {t.assigneeName ? (
                  <span className="owner">
                    <span className="avatar">{t.assigneeName.slice(0, 1)}</span>
                    {t.assigneeName}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {selected ? (
        <TaskSlideOver
          key={selected.id}
          companyId={companyId}
          companyName={companyName}
          task={selected}
          categories={categories}
          demo={demo}
          showToast={showToast}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {adding ? (
        <AddTaskSlideOver
          companyId={companyId}
          categories={categories}
          demo={demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ClipboardList } from "lucide-react-native";
import { colors, spacing } from "@/design/tokens";
import { shortDate } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import { loadTasks, type MobileTask } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  DdayPill,
  EmptyState,
  FilterChip,
  LoadingState,
  Row,
  Section,
  StatusBadge,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

type StageFilter = "all" | TaskStage;

const FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...TASK_STAGES.map((stage) => ({ value: stage, label: TASK_STAGE_LABEL[stage] })),
];

function TaskRow({ task, onPress }: { task: MobileTask; onPress: () => void }) {
  const urgent =
    task.daysLeft !== null && task.daysLeft !== undefined && task.daysLeft <= 3;
  return (
    <Row
      title={task.title}
      subtitle={task.companyName}
      meta={`${task.categoryName ?? "분류 없음"} · ${shortDate(task.due_date)}`}
      icon={
        <ClipboardList
          size={18}
          color={urgent ? colors.critical : colors.brand}
        />
      }
      tone={urgent ? "critical" : "brand"}
      accent={urgent}
      right={
        <View style={styles.taskRight}>
          <DdayPill daysLeft={task.daysLeft} />
          <StatusBadge tone={task.stage === "result" ? "success" : "neutral"}>
            {TASK_STAGE_LABEL[task.stage]}
          </StatusBadge>
        </View>
      }
      onPress={onPress}
    />
  );
}

export default function TasksScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<StageFilter>("all");
  const { data, loading, refreshing, error, refresh } = useAsyncData(loadTasks);

  const filtered = useMemo(
    () => (data ?? []).filter((task) => filter === "all" || task.stage === filter),
    [data, filter],
  );

  return (
    <Screen title="Task" subtitle="단계와 메모 수정" refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            active={filter === item.value}
            onPress={() => setFilter(item.value)}
          />
        ))}
      </View>

      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="Task를 불러오지 못했습니다" description={error} /> : null}
      {data ? (
        <Section title="Task 목록" caption={`${filtered.length}건`}>
          {filtered.length > 0 ? (
            filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onPress={() => router.push(`/task/${task.id}`)}
              />
            ))
          ) : (
            <EmptyState title="표시할 Task가 없습니다" compact />
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  taskRight: {
    alignItems: "flex-end",
    gap: 6,
  },
});

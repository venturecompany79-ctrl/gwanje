import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ClipboardList } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { ddayLabel, shortDate } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import { loadTasks, type MobileTask } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, LoadingState, Row, Section, StagePill } from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

type StageFilter = "all" | TaskStage;

const FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...TASK_STAGES.map((stage) => ({ value: stage, label: TASK_STAGE_LABEL[stage] })),
];

function TaskRow({ task, onPress }: { task: MobileTask; onPress: () => void }) {
  return (
    <Row
      title={task.title}
      subtitle={task.companyName}
      meta={`${task.categoryName ?? "분류 없음"} · ${shortDate(task.due_date)} · ${ddayLabel(task.daysLeft)}`}
      icon={<ClipboardList size={18} color={colors.brand} />}
      right={<StagePill label={TASK_STAGE_LABEL[task.stage]} active={task.stage !== "result"} />}
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
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[styles.filter, filter === item.value && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
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
            <EmptyState title="표시할 Task가 없습니다" />
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filter: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  filterActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterText: {
    ...typography.footnote,
    color: colors.secondaryLabel,
  },
  filterTextActive: {
    color: colors.canvas,
  },
});

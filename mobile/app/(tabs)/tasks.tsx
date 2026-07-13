import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Plus } from "@/ui/Icons";
import { colors, spacing, typography } from "@/design/tokens";
import { ddayLabel, monthDayKo } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import {
  loadTaskSummary,
  loadTasksPage,
  type TaskListItem,
} from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { usePagedData } from "@/lib/usePagedData";
import {
  Cell,
  Chip,
  ChipScroller,
  DdayBadge,
  InlineEmpty,
  Loading,
  StageBadge,
} from "@/ui/Primitives";
import { ScreenList } from "@/ui/Screen";

type StageFilter = "all" | TaskStage;

const FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...TASK_STAGES.map((stage) => ({
    value: stage,
    label: TASK_STAGE_LABEL[stage],
  })),
];

const TaskCell = memo(function TaskCell({
  task,
  first,
  last,
  onPress,
}: {
  task: TaskListItem;
  first?: boolean;
  last?: boolean;
  onPress: (id: string) => void;
}) {
  const done = task.stage === "result";
  const urgent =
    !done && task.daysLeft !== null && task.daysLeft !== undefined && task.daysLeft <= 3;
  return (
    <Cell
      grouped
      first={first}
      last={last}
      onPress={() => onPress(task.id)}
      accessibilityLabel={`${task.title}, ${task.companyName}, ${TASK_STAGE_LABEL[task.stage]}, ${monthDayKo(task.due_date)} 마감, ${ddayLabel(task.daysLeft)}`}
    >
      {urgent ? <View style={styles.accent} /> : null}
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.company} numberOfLines={1}>
            {task.companyName}
          </Text>
          <View style={styles.dotSep} />
          <StageBadge label={TASK_STAGE_LABEL[task.stage]} done={done} />
        </View>
      </View>
      <View style={styles.right}>
        <DdayBadge daysLeft={task.daysLeft} tone={done ? "success" : undefined} label={done ? "완료" : undefined} />
        <Text style={styles.due}>{monthDayKo(task.due_date)}</Text>
      </View>
    </Cell>
  );
});

export default function TasksScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<StageFilter>("all");
  const pageLoader = useCallback(
    (offset: number) =>
      loadTasksPage({
        offset,
        stage: filter === "all" ? undefined : filter,
      }),
    [filter],
  );
  const {
    items: tasks,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
  } = usePagedData(pageLoader);
  const {
    data: summary,
    refreshing: summaryRefreshing,
    refresh: refreshSummary,
  } = useAsyncData(loadTaskSummary);

  const refreshAll = useCallback(() => {
    void refresh();
    void refreshSummary();
  }, [refresh, refreshSummary]);
  const refreshAllRef = useRef(refreshAll);
  useEffect(() => {
    refreshAllRef.current = refreshAll;
  }, [refreshAll]);
  const openTask = useCallback(
    (id: string) => router.push(`/task/${id}`),
    [router],
  );

  // 새 Task 생성 후 돌아오면 목록을 다시 불러온다 (최초 포커스는 건너뜀)
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) refreshAllRef.current();
      else hasFocused.current = true;
    }, []),
  );

  return (
    <ScreenList
      title="Task"
      subtitle={
        summary
          ? `진행 ${summary.activeCount} · 기한 지남 ${summary.overdueCount}`
          : undefined
      }
      refreshing={refreshing || summaryRefreshing}
      onRefresh={refreshAll}
      action={
        <Pressable
          onPress={() => router.push("/task/new")}
          accessibilityRole="button"
          accessibilityLabel="새 Task 만들기"
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Plus size={22} color={colors.canvas} strokeWidth={2.4} />
        </Pressable>
      }
      header={
        <>
          <View style={styles.chipWrap}>
            <ChipScroller>
              {FILTERS.map((chip) => (
                <Chip
                  key={chip.value}
                  label={chip.label}
                  active={filter === chip.value}
                  onPress={() => setFilter(chip.value)}
                />
              ))}
            </ChipScroller>
          </View>
          {loading ? <Loading /> : null}
          {error ? <InlineEmpty>Task를 불러오지 못했습니다</InlineEmpty> : null}
        </>
      }
      data={tasks}
      keyExtractor={(task) => task.id}
      renderItem={({ item, index }) => (
        <TaskCell
          task={item}
          first={index === 0}
          last={index === tasks.length - 1}
          onPress={openTask}
        />
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <InlineEmpty>조건에 맞는 Task가 없습니다</InlineEmpty>
        ) : null
      }
      ListFooterComponent={loadingMore ? <Loading /> : null}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.35}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonPressed: {
    backgroundColor: colors.brandDeep,
  },
  chipWrap: {
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.critical,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.rowTitle,
    color: colors.label,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
  },
  company: {
    fontSize: 12.5,
    fontWeight: "500",
    letterSpacing: -0.1,
    color: colors.secondaryLabel,
    flexShrink: 1,
  },
  dotSep: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.quaternary,
    flexShrink: 0,
  },
  right: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  due: {
    ...typography.time,
    color: colors.tertiaryLabel,
  },
});

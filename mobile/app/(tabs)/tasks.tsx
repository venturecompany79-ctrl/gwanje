import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/design/tokens";
import { monthDayKo } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import { loadTasks, type MobileTask } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  Cell,
  Chip,
  ChipScroller,
  DdayBadge,
  Group,
  InlineEmpty,
  Loading,
  StageBadge,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

type StageFilter = "all" | TaskStage;

function isActive(task: MobileTask) {
  return task.stage !== "result";
}

function TaskCell({
  task,
  last,
  onPress,
}: {
  task: MobileTask;
  last?: boolean;
  onPress: () => void;
}) {
  const done = task.stage === "result";
  const urgent =
    !done && task.daysLeft !== null && task.daysLeft !== undefined && task.daysLeft <= 3;
  return (
    <Cell last={last} onPress={onPress}>
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
}

export default function TasksScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<StageFilter>("all");
  const { data, loading, refreshing, error, refresh } = useAsyncData(loadTasks);

  const tasks = useMemo(() => data ?? [], [data]);
  const activeCount = tasks.filter(isActive).length;
  const overdueCount = tasks.filter(
    (t) => isActive(t) && t.daysLeft !== null && t.daysLeft !== undefined && t.daysLeft < 0,
  ).length;

  const chips = useMemo(() => {
    const base: { value: StageFilter; label: string; count: number }[] = [
      { value: "all", label: "전체", count: tasks.length },
    ];
    for (const stage of TASK_STAGES) {
      base.push({
        value: stage,
        label: TASK_STAGE_LABEL[stage],
        count: tasks.filter((t) => t.stage === stage).length,
      });
    }
    return base;
  }, [tasks]);

  const filtered = useMemo(
    () =>
      tasks
        .filter((task) => filter === "all" || task.stage === filter)
        .slice()
        .sort((a, b) => {
          const doneDiff = Number(a.stage === "result") - Number(b.stage === "result");
          if (doneDiff !== 0) return doneDiff;
          return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
        }),
    [tasks, filter],
  );

  return (
    <Screen
      title="Task"
      subtitle={`진행 ${activeCount} · 기한 지남 ${overdueCount}`}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={styles.chipWrap}>
        <ChipScroller>
          {chips.map((chip) => (
            <Chip
              key={chip.value}
              label={`${chip.label} ${chip.count}`}
              active={filter === chip.value}
              onPress={() => setFilter(chip.value)}
            />
          ))}
        </ChipScroller>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <InlineEmpty>Task를 불러오지 못했습니다</InlineEmpty> : null}
      {data ? (
        filtered.length > 0 ? (
          <Group>
            {filtered.map((task, i) => (
              <TaskCell
                key={task.id}
                task={task}
                last={i === filtered.length - 1}
                onPress={() => router.push(`/task/${task.id}`)}
              />
            ))}
          </Group>
        ) : (
          <InlineEmpty>조건에 맞는 Task가 없습니다</InlineEmpty>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    marginTop: spacing.base,
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

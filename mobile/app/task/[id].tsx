import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { ddayLabel, shortDate } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import { loadTask, type MobileTask } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, LoadingState, PrimaryButton, StagePill } from "@/ui/Primitives";

export default function TaskModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadCurrentTask = useCallback(
    () => loadTask(String(id)),
    [id],
  );
  const { data, loading, error, refresh } = useAsyncData(loadCurrentTask);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.grabber} />
            <Pressable style={styles.close} onPress={() => router.back()}>
              <X size={18} color={colors.secondaryLabel} />
            </Pressable>
          </View>

          {loading ? <LoadingState /> : null}
          {error ? <EmptyState title="Task를 불러오지 못했습니다" description={error} /> : null}
          {data ? (
            <TaskForm
              key={data.id}
              task={data}
              onClose={() => router.back()}
              onSaved={refresh}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function TaskForm({
  task,
  onClose,
  onSaved,
}: {
  task: MobileTask;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [memo, setMemo] = useState(task.memo ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await mobileApi(`/api/mobile/tasks/${task.id}`, {
        method: "PATCH",
        body: { stage, memo },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onSaved();
      onClose();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.warn("[task:save]", err);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Text style={styles.company}>{task.companyName}</Text>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.meta}>
        {task.categoryName ?? "분류 없음"} · {shortDate(task.due_date)} · {ddayLabel(task.daysLeft)}
      </Text>

      <View style={styles.block}>
        <Text style={styles.label}>단계</Text>
        <View style={styles.stageGrid}>
          {TASK_STAGES.map((item) => (
            <Pressable key={item} onPress={() => setStage(item)}>
              <StagePill label={TASK_STAGE_LABEL[item]} active={stage === item} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="진행 상황이나 다음 액션을 적어두세요"
          multiline
          style={styles.memo}
        />
      </View>

      <PrimaryButton disabled={pending} onPress={save}>
        {pending ? "저장 중..." : "변경 저장"}
      </PrimaryButton>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.grouped,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
    gap: spacing.base,
    minHeight: "76%",
  },
  header: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.separator,
  },
  close: {
    position: "absolute",
    right: 0,
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
  },
  company: {
    ...typography.callout,
    color: colors.secondaryLabel,
  },
  title: {
    ...typography.title2,
    color: colors.label,
  },
  meta: {
    ...typography.callout,
    color: colors.secondaryLabel,
  },
  block: {
    gap: spacing.sm,
  },
  label: {
    ...typography.footnote,
    color: colors.secondaryLabel,
  },
  stageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  memo: {
    minHeight: 130,
    borderRadius: radius.lg,
    backgroundColor: colors.grouped,
    padding: spacing.base,
    textAlignVertical: "top",
    ...typography.body,
    color: colors.label,
  },
});

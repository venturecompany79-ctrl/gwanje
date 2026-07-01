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
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { ddayLabel, shortDate } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import { loadTask, type MobileTask } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { useAuth } from "@/context/AuthContext";
import {
  EmptyState,
  LoadingState,
  PrimaryButton,
  StagePill,
  StatusBadge,
} from "@/ui/Primitives";

export default function TaskModal() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadCurrentTask = useCallback(
    () => (session ? loadTask(String(id)) : Promise.resolve(null)),
    [id, session],
  );
  const { data, loading, error, refresh } = useAsyncData(loadCurrentTask);

  if (!session) {
    return <Redirect href="/login" />;
  }

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
            <Text style={styles.sheetTitle}>Task 수정</Text>
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
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setSaveError(null);
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
      setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <View style={styles.taskHead}>
        <Text style={styles.company}>{task.companyName}</Text>
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.metaRow}>
          <StatusBadge tone="neutral">{task.categoryName ?? "분류 없음"}</StatusBadge>
          <Text style={styles.meta}>{shortDate(task.due_date)}</Text>
          <Text style={styles.metaStrong}>{ddayLabel(task.daysLeft)}</Text>
        </View>
      </View>

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

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

      <PrimaryButton disabled={pending} onPress={save}>
        {pending ? "저장 중..." : "변경 저장"}
      </PrimaryButton>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(10, 19, 23, 0.20)",
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
    minHeight: "74%",
    maxHeight: "92%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
  header: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 3,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.hairline,
  },
  sheetTitle: {
    ...typography.callout,
    color: colors.inkDeep,
    fontWeight: "700",
    marginTop: spacing.md,
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
    fontWeight: "700",
  },
  title: {
    ...typography.title2,
    color: colors.inkDeep,
  },
  meta: {
    ...typography.footnote,
    color: colors.stone,
    fontWeight: "700",
  },
  metaStrong: {
    ...typography.footnote,
    color: colors.critical,
    fontWeight: "800",
  },
  taskHead: {
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
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
    backgroundColor: colors.surfaceSoft,
    padding: spacing.base,
    textAlignVertical: "top",
    ...typography.body,
    color: colors.ink,
  },
  saveError: {
    ...typography.footnote,
    color: colors.critical,
    fontWeight: "700",
  },
});

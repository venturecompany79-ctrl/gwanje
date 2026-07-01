import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, X } from "lucide-react-native";
import { colors, radius } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { monthDayKo } from "@/lib/dates";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import { loadTask, type MobileTask } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { useAuth } from "@/context/AuthContext";
import { Cell, DdayBadge, Group, InlineEmpty, Loading, SectionLabel } from "@/ui/Primitives";

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
        <Pressable style={styles.backdrop} onPress={() => router.back()} />
        <View style={styles.sheet}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.header}>
            <Text style={styles.sheetTitle}>Task 수정</Text>
            <Pressable style={styles.close} onPress={() => router.back()} hitSlop={8}>
              <X size={13} color={colors.secondaryLabel} strokeWidth={2.2} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <Loading />
            </View>
          ) : null}
          {error ? (
            <View style={styles.stateWrap}>
              <InlineEmpty>Task를 불러오지 못했습니다</InlineEmpty>
            </View>
          ) : null}
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
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [memo, setMemo] = useState(task.memo ?? "");
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const done = stage === "result";

  async function save() {
    if (pending) return;
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
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoCompany}>{task.companyName}</Text>
          <Text style={styles.infoTitle}>{task.title}</Text>
          <View style={styles.infoMeta}>
            <DdayBadge
              daysLeft={task.daysLeft}
              tone={done ? "success" : undefined}
              label={done ? "완료" : undefined}
            />
            <Text style={styles.infoMetaText}>{monthDayKo(task.due_date)}</Text>
            <View style={styles.dotSep} />
            <Text style={styles.infoMetaText}>{task.categoryName ?? "분류 없음"}</Text>
          </View>
        </View>

        <SectionLabel style={styles.tightLabel}>단계</SectionLabel>
        <Group>
          {TASK_STAGES.map((item, i) => {
            const active = stage === item;
            return (
              <Cell key={item} last={i === TASK_STAGES.length - 1} onPress={() => setStage(item)}>
                <Text style={[styles.stageLabel, active && styles.stageLabelActive]}>
                  {TASK_STAGE_LABEL[item]}
                </Text>
                {active ? (
                  <Check size={17} color={colors.brand} strokeWidth={2.4} />
                ) : null}
              </Cell>
            );
          })}
        </Group>

        <SectionLabel style={styles.tightLabel}>메모</SectionLabel>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="진행 내용, 다음 처리, 특이사항 기록"
          placeholderTextColor={colors.tertiaryLabel}
          multiline
          style={styles.memo}
        />

        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable
          onPress={save}
          disabled={pending}
          style={[styles.save, pending && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>{pending ? "저장 중…" : "저장"}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  sheet: {
    backgroundColor: colors.grouped,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: "92%",
    ...Platform.select({
      web: { boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: -8 },
      },
    }),
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 9,
    paddingBottom: 3,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(60,60,67,0.24)",
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.label,
  },
  close: {
    position: "absolute",
    right: 14,
    top: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fillStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stateWrap: {
    paddingBottom: 40,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  infoCompany: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: colors.secondaryLabel,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 25,
    color: colors.label,
    marginTop: 3,
  },
  infoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 11,
  },
  infoMetaText: {
    fontSize: 13.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.subText,
  },
  dotSep: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.quaternary,
  },
  tightLabel: {
    paddingHorizontal: 4,
    paddingTop: 22,
  },
  stageLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.3,
    color: "#3A3A3C",
  },
  stageLabelActive: {
    fontWeight: "600",
    color: colors.label,
  },
  memo: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingHorizontal: 15,
    paddingVertical: 14,
    minHeight: 120,
    fontSize: 15.5,
    lineHeight: 23,
    letterSpacing: -0.3,
    color: colors.label,
    textAlignVertical: "top",
  },
  saveError: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
    color: colors.critical,
    letterSpacing: -0.2,
  },
  footer: {
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(242,242,247,0.94)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  save: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: radius.card,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  saveDisabled: {
    backgroundColor: "rgba(0,100,224,0.55)",
  },
  saveText: {
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.canvas,
  },
});

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
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import {
  loadTask,
  loadTaskFormOptions,
  type MobileTask,
  type TaskFormOptions,
} from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { useAuth } from "@/context/AuthContext";
import { DateField } from "@/ui/DateField";
import { Cell, Group, InlineEmpty, Loading, SectionLabel } from "@/ui/Primitives";

export default function TaskModal() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadCurrentTask = useCallback(
    async () => {
      if (!session) return null;
      const [task, options] = await Promise.all([
        loadTask(String(id)),
        loadTaskFormOptions(),
      ]);
      return task ? { task, options } : null;
    },
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
            <Text style={styles.sheetTitle}>Task 상세</Text>
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
              key={data.task.id}
              task={data.task}
              options={data.options}
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
  options,
  onClose,
  onSaved,
}: {
  task: MobileTask;
  options: TaskFormOptions;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState<string | null>(task.category_id);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [memo, setMemo] = useState(task.memo ?? "");
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && !pending;

  async function save() {
    if (!canSave) return;
    setPending(true);
    setSaveError(null);
    try {
      await mobileApi(`/api/mobile/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(),
          categoryId,
          dueDate: dueDate || null,
          stage,
          memo,
        },
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
        {!isEditing ? (
          <InlineEmpty>수정하려면 하단의 수정하기 버튼을 눌러 주세요.</InlineEmpty>
        ) : null}

        <SectionLabel style={styles.tightLabel}>기업</SectionLabel>
        <Group>
          <Cell last>
            <Text style={styles.readonlyValue} numberOfLines={1}>
              {task.companyName}
            </Text>
          </Cell>
        </Group>

        <SectionLabel style={styles.tightLabel}>내용</SectionLabel>
        <Group>
          <Cell>
            <TextInput
              value={title}
              onChangeText={setTitle}
              editable={isEditing}
              placeholder="Task 제목"
              placeholderTextColor={colors.tertiaryLabel}
              style={[styles.fieldInput, !isEditing && styles.fieldInputReadonly]}
            />
          </Cell>
          <Cell last>
            <Text style={styles.fieldLabel}>마감일</Text>
            <DateField
              value={dueDate}
              onChange={setDueDate}
              disabled={!isEditing}
            />
          </Cell>
        </Group>

        {options.categories.length > 0 ? (
          <>
            <SectionLabel style={styles.tightLabel}>분류</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.catRow}
            >
              <CategoryChip
                label="없음"
                active={categoryId === null}
                disabled={!isEditing}
                onPress={() => setCategoryId(null)}
              />
              {options.categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  label={category.name}
                  active={categoryId === category.id}
                  disabled={!isEditing}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <SectionLabel style={styles.tightLabel}>단계</SectionLabel>
        <Group>
          {TASK_STAGES.map((item, i) => {
            const active = stage === item;
            return (
              <Cell
                key={item}
                last={i === TASK_STAGES.length - 1}
                onPress={isEditing ? () => setStage(item) : undefined}
              >
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
          editable={isEditing}
          style={[styles.memo, !isEditing && styles.memoReadonly]}
        />

        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable
          onPress={isEditing ? save : () => setIsEditing(true)}
          disabled={isEditing ? !canSave : false}
          style={[styles.save, isEditing && !canSave && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>
            {isEditing ? (pending ? "저장 중…" : "변경 저장") : "수정하기"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function CategoryChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.cat,
        active ? styles.catActive : styles.catOff,
        disabled && styles.catDisabled,
      ]}
    >
      <Text style={[styles.catText, active && styles.catTextActive]}>{label}</Text>
    </Pressable>
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
  readonlyValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.secondaryLabel,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.label,
    paddingVertical: 2,
  },
  fieldInputReadonly: {
    color: colors.secondaryLabel,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.label,
  },
  catRow: {
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  cat: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.chip,
  },
  catActive: {
    backgroundColor: colors.brandTintStrong,
  },
  catOff: {
    backgroundColor: colors.fill,
  },
  catDisabled: {
    opacity: 0.72,
  },
  catText: {
    fontSize: 13.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.subText,
  },
  catTextActive: {
    color: colors.brand,
    fontWeight: "600",
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
  memoReadonly: {
    color: colors.secondaryLabel,
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

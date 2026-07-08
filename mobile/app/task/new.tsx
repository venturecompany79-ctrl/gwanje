import { useMemo, useState } from "react";
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
import { Redirect, Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, ChevronDown, Search } from "lucide-react-native";
import { colors, radius, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import {
  loadTaskFormOptions,
  type CompanyOption,
  type TaskFormOptions,
} from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { useAuth } from "@/context/AuthContext";
import {
  Cell,
  Group,
  InlineEmpty,
  Loading,
  SectionLabel,
} from "@/ui/Primitives";
import { DateField } from "@/ui/DateField";

export default function NewTaskModal() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, loading, error } = useAsyncData(loadTaskFormOptions);

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
            <Pressable style={styles.cancel} onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>새 Task</Text>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <Loading />
            </View>
          ) : null}
          {error ? (
            <View style={styles.stateWrap}>
              <InlineEmpty>작성 정보를 불러오지 못했습니다</InlineEmpty>
            </View>
          ) : null}
          {data ? (
            <NewTaskForm options={data} onClose={() => router.back()} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function NewTaskForm({
  options,
  onClose,
}: {
  options: TaskFormOptions;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [stage, setStage] = useState<TaskStage>("diagnosis");
  const [memo, setMemo] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedCompany = useMemo(
    () => options.companies.find((c) => c.id === companyId) ?? null,
    [options.companies, companyId],
  );

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return options.companies;
    return options.companies.filter((company) =>
      [company.name, company.industry, company.region]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [options.companies, companyQuery]);

  const canSubmit = Boolean(companyId) && title.trim().length > 0 && !pending;

  function pickCompany(company: CompanyOption) {
    setCompanyId(company.id);
    setPickerOpen(false);
    setCompanyQuery("");
  }

  async function submit() {
    if (!canSubmit) return;
    setPending(true);
    setSaveError(null);
    try {
      await mobileApi("/api/mobile/tasks", {
        body: {
          companyId,
          title: title.trim(),
          categoryId,
          dueDate: dueDate || null,
          stage,
          memo: memo.trim() || null,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        {/* 기업 */}
        <SectionLabel style={styles.tightLabel}>기업</SectionLabel>
        <Group>
          <Cell onPress={() => setPickerOpen((open) => !open)} last={!pickerOpen}>
            <Text
              style={[
                styles.pickerValue,
                !selectedCompany && styles.pickerPlaceholder,
              ]}
              numberOfLines={1}
            >
              {selectedCompany ? selectedCompany.name : "기업 선택"}
            </Text>
            <ChevronDown
              size={18}
              color={colors.quaternary}
              strokeWidth={2}
              style={pickerOpen ? styles.chevronOpen : undefined}
            />
          </Cell>
          {pickerOpen ? (
            <View style={styles.picker}>
              <View style={styles.search}>
                <Search size={16} color={colors.secondaryLabel} strokeWidth={1.7} />
                <TextInput
                  value={companyQuery}
                  onChangeText={setCompanyQuery}
                  placeholder="기업 검색"
                  placeholderTextColor={colors.secondaryLabel}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              <ScrollView
                style={styles.pickerList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {filteredCompanies.length > 0 ? (
                  filteredCompanies.map((company, i) => {
                    const sub = [company.industry, company.region]
                      .filter(Boolean)
                      .join(" · ");
                    const active = company.id === companyId;
                    return (
                      <Pressable
                        key={company.id}
                        onPress={() => pickCompany(company)}
                        style={({ pressed }) => [
                          styles.pickerRow,
                          i === filteredCompanies.length - 1 && styles.pickerRowLast,
                          pressed && styles.pickerRowPressed,
                        ]}
                      >
                        <View style={styles.pickerRowMain}>
                          <Text style={styles.pickerRowName} numberOfLines={1}>
                            {company.name}
                          </Text>
                          {sub ? (
                            <Text style={styles.pickerRowSub} numberOfLines={1}>
                              {sub}
                            </Text>
                          ) : null}
                        </View>
                        {active ? (
                          <Check size={17} color={colors.brand} strokeWidth={2.4} />
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>검색 결과가 없습니다</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          ) : null}
        </Group>

        {/* 내용 */}
        <SectionLabel style={styles.tightLabel}>내용</SectionLabel>
        <Group>
          <Cell>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Task 제목"
              placeholderTextColor={colors.tertiaryLabel}
              style={styles.fieldInput}
            />
          </Cell>
          <Cell last>
            <Text style={styles.fieldLabel}>마감일</Text>
            <DateField value={dueDate} onChange={setDueDate} />
          </Cell>
        </Group>

        {/* 분류 */}
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
                onPress={() => setCategoryId(null)}
              />
              {options.categories.map((category) => (
                <CategoryChip
                  key={category.id}
                  label={category.name}
                  active={categoryId === category.id}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* 단계 */}
        <SectionLabel style={styles.tightLabel}>단계</SectionLabel>
        <Group>
          {TASK_STAGES.map((item, i) => {
            const active = stage === item;
            return (
              <Cell
                key={item}
                last={i === TASK_STAGES.length - 1}
                onPress={() => setStage(item)}
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
          style={styles.memo}
        />

        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.save, !canSubmit && styles.saveDisabled]}
        >
          <Text style={[styles.saveText, !canSubmit && styles.saveTextDisabled]}>
            {pending ? "추가 중…" : "Task 추가"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cat, active ? styles.catActive : styles.catOff]}
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
    maxHeight: "94%",
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
  cancel: {
    position: "absolute",
    left: 14,
    top: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.3,
    color: colors.brand,
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
  tightLabel: {
    paddingHorizontal: 4,
    paddingTop: 18,
  },
  pickerValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.label,
  },
  pickerPlaceholder: {
    fontWeight: "400",
    color: colors.tertiaryLabel,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  picker: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  search: {
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.searchFill,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.label,
    paddingVertical: 8,
  },
  pickerList: {
    maxHeight: 216,
    marginTop: 4,
  },
  pickerRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  pickerRowLast: {
    borderBottomWidth: 0,
  },
  pickerRowPressed: {
    backgroundColor: "rgba(60,60,67,0.06)",
  },
  pickerRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pickerRowName: {
    ...typography.rowTitle,
    color: colors.label,
  },
  pickerRowSub: {
    fontSize: 13,
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
  },
  pickerEmpty: {
    paddingVertical: 22,
    alignItems: "center",
  },
  pickerEmptyText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    letterSpacing: -0.2,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.label,
    paddingVertical: 2,
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
    minHeight: 110,
    fontSize: 15.5,
    lineHeight: 23,
    letterSpacing: -0.3,
    color: colors.label,
    textAlignVertical: "top",
  },
  saveError: {
    marginTop: 14,
    marginHorizontal: 4,
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
    backgroundColor: colors.fillStrong,
  },
  saveText: {
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.canvas,
  },
  saveTextDisabled: {
    color: colors.tertiaryLabel,
  },
});

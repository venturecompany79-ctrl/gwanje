import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, ChevronDown, Search, X } from "@/ui/Icons";
import { colors, radius, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { TASK_STAGE_LABEL, TASK_STAGES, type TaskStage } from "@/lib/labels";
import {
  loadCompanyOptionsPage,
  loadTaskFormOptions,
  type CompanyOption,
  type TaskFormOptions,
} from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { usePagedData } from "@/lib/usePagedData";
import { useAuth } from "@/context/AuthContext";
import { Cell, Group, InlineEmpty, Loading, SectionLabel } from "@/ui/Primitives";
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
        <Pressable
          style={styles.backdrop}
          onPress={() => router.back()}
          accessible={false}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabberWrap} accessibilityElementsHidden>
            <View style={styles.grabber} />
          </View>
          <View style={styles.header}>
            <Pressable
              style={styles.cancel}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="새 Task 작성 취소"
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              새 Task
            </Text>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <Loading />
            </View>
          ) : null}
          {error ? (
            <View style={styles.stateWrap} accessibilityRole="alert">
              <InlineEmpty>작성 정보를 불러오지 못했습니다</InlineEmpty>
            </View>
          ) : null}
          {data ? <NewTaskForm options={data} onClose={() => router.back()} /> : null}
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
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [stage, setStage] = useState<TaskStage>("diagnosis");
  const [memo, setMemo] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSubmit = Boolean(selectedCompany) && title.trim().length > 0 && !pending;

  const pickCompany = useCallback((company: CompanyOption) => {
    setSelectedCompany(company);
    setPickerOpen(false);
  }, []);

  async function submit() {
    if (!canSubmit || !selectedCompany) return;
    setPending(true);
    setSaveError(null);
    try {
      await mobileApi("/api/mobile/tasks", {
        body: {
          companyId: selectedCompany.id,
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
        <SectionLabel style={styles.tightLabel}>기업</SectionLabel>
        <Group>
          <Cell
            onPress={() => setPickerOpen(true)}
            last
            accessibilityLabel={
              selectedCompany
                ? `기업 선택, 현재 ${selectedCompany.name}`
                : "기업 선택"
            }
            accessibilityHint="기업 검색 목록을 엽니다"
            accessibilityState={{ expanded: pickerOpen }}
          >
            <Text
              style={[
                styles.pickerValue,
                !selectedCompany && styles.pickerPlaceholder,
              ]}
              numberOfLines={1}
            >
              {selectedCompany ? selectedCompany.name : "기업 선택"}
            </Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <ChevronDown size={18} color={colors.quaternary} strokeWidth={2} />
            </View>
          </Cell>
        </Group>

        <SectionLabel style={styles.tightLabel}>내용</SectionLabel>
        <Group>
          <Cell>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Task 제목"
              placeholderTextColor={colors.tertiaryLabel}
              style={styles.fieldInput}
              accessibilityLabel="Task 제목"
              returnKeyType="next"
            />
          </Cell>
          <Cell last>
            <Text style={styles.fieldLabel}>마감일</Text>
            <DateField
              value={dueDate}
              onChange={setDueDate}
              accessibilityLabel="Task 마감일"
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
              accessibilityRole="radiogroup"
              accessibilityLabel="Task 분류"
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

        <SectionLabel style={styles.tightLabel}>단계</SectionLabel>
        <Group>
          {TASK_STAGES.map((item, index) => {
            const active = stage === item;
            const label = TASK_STAGE_LABEL[item];
            return (
              <Cell
                key={item}
                last={index === TASK_STAGES.length - 1}
                onPress={() => setStage(item)}
                accessibilityLabel={`${label} 단계`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.stageLabel, active && styles.stageLabelActive]}>
                  {label}
                </Text>
                {active ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Check size={17} color={colors.brand} strokeWidth={2.4} />
                  </View>
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
          accessibilityLabel="Task 메모"
        />

        {saveError ? (
          <Text
            style={styles.saveError}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {saveError}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={pending ? "Task 추가 중" : "Task 추가"}
          accessibilityState={{ disabled: !canSubmit, busy: pending }}
          style={[styles.save, !canSubmit && styles.saveDisabled]}
        >
          <Text style={[styles.saveText, !canSubmit && styles.saveTextDisabled]}>
            {pending ? "추가 중…" : "Task 추가"}
          </Text>
        </Pressable>
      </View>

      {pickerOpen ? (
        <CompanyPickerModal
          selectedCompany={selectedCompany}
          onSelect={pickCompany}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </>
  );
}

function CompanyPickerModal({
  selectedCompany,
  onSelect,
  onClose,
}: {
  selectedCompany: CompanyOption | null;
  onSelect: (company: CompanyOption) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadCompanies = useCallback(
    (offset: number) =>
      loadCompanyOptionsPage({ offset, query: debouncedQuery || undefined }),
    [debouncedQuery],
  );
  const {
    items,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
    reset,
  } = usePagedData(loadCompanies);

  const renderCompany = useCallback(
    ({ item }: ListRenderItemInfo<CompanyOption>) => {
      const selected = item.id === selectedCompany?.id;
      const detail = [item.industry, item.region].filter(Boolean).join(" · ");
      return (
        <Pressable
          onPress={() => onSelect(item)}
          accessibilityRole="radio"
          accessibilityLabel={detail ? `${item.name}, ${detail}` : item.name}
          accessibilityState={{ selected }}
          style={({ pressed }) => [
            styles.pickerRow,
            pressed && styles.pickerRowPressed,
          ]}
        >
          <View style={styles.pickerRowMain}>
            <Text style={styles.pickerRowName} numberOfLines={1}>
              {item.name}
            </Text>
            {detail ? (
              <Text style={styles.pickerRowSub} numberOfLines={1}>
                {detail}
              </Text>
            ) : null}
          </View>
          {selected ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Check size={18} color={colors.brand} strokeWidth={2.4} />
            </View>
          ) : null}
        </Pressable>
      );
    },
    [onSelect, selectedCompany?.id],
  );

  const emptyState = loading ? (
    <View style={styles.pickerState} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.pickerStateText}>기업을 불러오는 중입니다</Text>
    </View>
  ) : error ? (
    <View style={styles.pickerState} accessibilityRole="alert">
      <Text style={styles.pickerStateText}>기업을 불러오지 못했습니다</Text>
      <Pressable
        onPress={reset}
        accessibilityRole="button"
        accessibilityLabel="기업 목록 다시 불러오기"
        style={styles.retryButton}
      >
        <Text style={styles.retryText}>다시 시도</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.pickerState}>
      <Text style={styles.pickerStateText}>
        {debouncedQuery ? "검색 결과가 없습니다" : "선택할 기업이 없습니다"}
      </Text>
    </View>
  );

  const footerState = loadingMore ? (
    <View style={styles.pickerFooter} accessibilityRole="progressbar">
      <ActivityIndicator size="small" color={colors.brand} />
      <Text style={styles.pickerFooterText}>더 불러오는 중…</Text>
    </View>
  ) : error && items.length > 0 ? (
    <View style={styles.pickerFooter} accessibilityRole="alert">
      <Text style={styles.pickerFooterText}>목록을 더 불러오지 못했습니다</Text>
      <Pressable
        onPress={refresh}
        accessibilityRole="button"
        accessibilityLabel="기업 목록 새로고침"
        style={styles.footerRetry}
      >
        <Text style={styles.retryText}>새로고침</Text>
      </Pressable>
    </View>
  ) : !hasMore && items.length > 0 ? (
    <View style={styles.pickerFooter}>
      <Text style={styles.pickerFooterText}>목록의 끝입니다</Text>
    </View>
  ) : null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.pickerModalRoot}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={onClose}
          accessible={false}
        />
        <View
          style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          accessibilityViewIsModal
        >
          <View style={styles.pickerHeader}>
            <View>
              <Text style={styles.pickerTitle} accessibilityRole="header">
                기업 선택
              </Text>
              <Text style={styles.pickerCount}>
                {loading ? "목록을 불러오는 중" : "활성 기업 목록"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="기업 선택 닫기"
              style={styles.pickerClose}
            >
              <X size={17} color={colors.secondaryLabel} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={styles.search}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Search size={17} color={colors.secondaryLabel} strokeWidth={1.7} />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="기업명, 업종, 지역 검색"
              placeholderTextColor={colors.secondaryLabel}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="기업 검색"
            />
          </View>

          <FlatList
            data={items}
            renderItem={renderCompany}
            keyExtractor={(item) => item.id}
            style={styles.pickerList}
            contentContainerStyle={[
              styles.pickerListContent,
              items.length === 0 && styles.pickerListEmpty,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            accessibilityRole="radiogroup"
            accessibilityLabel="기업 검색 결과"
            onEndReached={() => {
              if (hasMore) void loadMore();
            }}
            onEndReachedThreshold={0.35}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.brand}
                colors={[colors.brand]}
              />
            }
            ListEmptyComponent={emptyState}
            ListFooterComponent={footerState}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
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
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
    left: 8,
    top: 0,
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
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
  fieldInput: {
    flex: 1,
    minHeight: 44,
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
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 50,
    paddingVertical: 13,
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
  pickerModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  pickerSheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    height: "84%",
    backgroundColor: colors.grouped,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 -8px 40px rgba(0,0,0,0.22)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: -8 },
      },
    }),
  },
  pickerHeader: {
    minHeight: 68,
    paddingLeft: 20,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.label,
  },
  pickerCount: {
    marginTop: 2,
    fontSize: 12.5,
    color: colors.secondaryLabel,
  },
  pickerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.fillStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    minHeight: 44,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: colors.searchFill,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.label,
    paddingVertical: 8,
  },
  pickerList: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
  pickerListContent: {
    paddingHorizontal: 14,
  },
  pickerListEmpty: {
    flexGrow: 1,
  },
  pickerRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
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
  pickerState: {
    flex: 1,
    minHeight: 180,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  pickerStateText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.brandTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRetry: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand,
  },
  pickerFooter: {
    minHeight: 56,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerFooterText: {
    fontSize: 12.5,
    color: colors.secondaryLabel,
  },
});

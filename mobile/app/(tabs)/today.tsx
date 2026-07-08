import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Check, ChevronLeft, ChevronRight, Trash2 } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { longKstDate, monthDayKo, shiftDateString, todayKstDate } from "@/lib/dates";
import { TODO_TAGS, type TodoTag } from "@/lib/labels";
import { loadNotesForDate, type TodoNoteRow } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { DateField } from "@/ui/DateField";
import { Cell, Group, InlineEmpty, Loading, SectionLabel } from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// 서버(app/api/mobile/todos + lib/todos.ts TODO_BOARD_DAY_COUNT / TODO_NOTE_FUTURE_DAYS)와
// 동일하게, 과거는 오늘 포함 최근 30일, 미래는 오늘 이후 최대 365일까지 작성/조회를 허용한다.
const NOTE_HISTORY_DAYS = 30;
const NOTE_FUTURE_DAYS = 365;

function NoteCell({
  note,
  last,
  onToggle,
  onDelete,
}: {
  note: TodoNoteRow;
  last?: boolean;
  onToggle: () => void;
  /** 삭제 실행 — 성공 시 목록 새로고침으로 이 셀이 사라지고, 실패 시 reject한다. */
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const done = note.completed;
  const displayTag =
    typeof note.tag === "string" && TODO_TAGS.some((item) => item === note.tag)
      ? note.tag
      : null;

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
      // 성공하면 새로고침으로 셀이 언마운트되므로 상태를 되돌리지 않는다.
    } catch {
      // 실패 시 확인 UI를 접고, 에러 문구는 상위(remove)에서 노출한다.
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <Cell last={last} sepInset={46} align="flex-start">
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={[styles.check, done ? styles.checkDone : styles.checkOff]}
      >
        {done ? <Check size={12} color={colors.canvas} strokeWidth={2.4} /> : null}
      </Pressable>
      <View style={styles.noteMain}>
        <Text style={[styles.noteText, done && styles.noteTextDone]}>
          {note.content}
        </Text>
        <View style={styles.noteMeta}>
          {displayTag ? (
            <View style={styles.tagChip}>
              <Text style={styles.tagChipText}>{displayTag}</Text>
            </View>
          ) : null}
          <Text style={styles.noteTime}>{note.completed ? "완료" : "메모"}</Text>
        </View>
      </View>
      {confirming ? (
        <View style={styles.confirmRow}>
          <Pressable
            onPress={() => setConfirming(false)}
            disabled={deleting}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="삭제 취소"
            style={styles.confirmCancel}
          >
            <Text style={styles.confirmCancelText}>취소</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="삭제 확인"
            style={[styles.confirmDelete, deleting && styles.confirmDeleteBusy]}
          >
            <Text style={styles.confirmDeleteText}>{deleting ? "삭제 중" : "삭제"}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirming(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="노트 삭제"
          style={styles.deleteBtn}
        >
          <Trash2 size={16} color={colors.tertiaryLabel} strokeWidth={2} />
        </Pressable>
      )}
    </Cell>
  );
}

export default function TodayScreen() {
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState<TodoTag>("상담");
  const [noteDate, setNoteDate] = useState(todayKstDate());
  const [saveError, setSaveError] = useState<string | null>(null);
  const today = todayKstDate();
  const minDate = shiftDateString(today, -(NOTE_HISTORY_DAYS - 1));
  const maxDate = shiftDateString(today, NOTE_FUTURE_DAYS);
  // 네이티브 입력 중(부분 입력)에는 오늘 날짜 목록을 유지한다.
  const listDate = FULL_DATE.test(noteDate) ? noteDate : today;
  const loadNotes = useCallback(() => loadNotesForDate(listDate), [listDate]);
  const { data, loading, refreshing, error, refresh } = useAsyncData(loadNotes);
  const sortedNotes = useMemo(
    () =>
      (data ?? []).slice().sort((a, b) => {
        const doneDiff = Number(a.completed) - Number(b.completed);
        if (doneDiff !== 0) return doneDiff;
        return (
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.created_at.localeCompare(b.created_at)
        );
      }),
    [data],
  );

  const isToday = listDate === today;
  const canAdd = draft.trim().length > 0;
  // ◀▶ 하루 이동. YYYY-MM-DD 문자열은 사전식 비교가 곧 날짜 순서라 그대로 범위 판정에 쓴다.
  const canPrev = listDate > minDate;
  const canNext = listDate < maxDate;

  function stepDay(delta: number) {
    const next = shiftDateString(listDate, delta);
    if (next < minDate || next > maxDate) return;
    setNoteDate(next);
    void Haptics.selectionAsync();
  }

  async function addNote() {
    const content = draft.trim();
    if (!content) return;
    if (!FULL_DATE.test(noteDate)) {
      setSaveError("날짜를 YYYY-MM-DD 형식으로 입력해 주세요.");
      return;
    }
    try {
      setSaveError(null);
      await mobileApi("/api/mobile/todos", {
        body: { content, tag, noteDate },
      });
      setDraft("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "노트 저장에 실패했습니다.",
      );
    }
  }

  async function toggle(note: TodoNoteRow) {
    try {
      setSaveError(null);
      await mobileApi(`/api/mobile/todos/${note.id}`, {
        method: "PATCH",
        body: { completed: !note.completed },
      });
      await Haptics.selectionAsync();
      refresh();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "상태 변경에 실패했습니다.",
      );
    }
  }

  async function remove(note: TodoNoteRow) {
    setSaveError(null);
    try {
      await mobileApi(`/api/mobile/todos/${note.id}`, { method: "DELETE" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      throw err; // NoteCell이 확인 UI를 되돌리도록 재던진다.
    }
  }

  return (
    <Screen
      title="오늘"
      subtitle={`${longKstDate()} · 업무일지`}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="업무 메모 입력"
          placeholderTextColor={colors.tertiaryLabel}
          style={styles.input}
          multiline
        />
        <View style={styles.composerSep} />
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>작성 날짜</Text>
          <View style={styles.dateControls}>
            <Pressable
              onPress={() => stepDay(-1)}
              disabled={!canPrev}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="전날로 이동"
              style={[styles.stepBtn, !canPrev && styles.stepBtnOff]}
            >
              <ChevronLeft
                size={18}
                color={canPrev ? colors.brand : colors.quaternary}
                strokeWidth={2.2}
              />
            </Pressable>
            <DateField
              value={noteDate}
              onChange={setNoteDate}
              min={minDate}
              max={maxDate}
            />
            <Pressable
              onPress={() => stepDay(1)}
              disabled={!canNext}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="다음날로 이동"
              style={[styles.stepBtn, !canNext && styles.stepBtnOff]}
            >
              <ChevronRight
                size={18}
                color={canNext ? colors.brand : colors.quaternary}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
        </View>
        <View style={styles.composerSep} />
        <View style={styles.composerFooter}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRow}
          >
            {TODO_TAGS.map((item) => {
              const active = tag === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setTag(item)}
                  style={[styles.tag, active ? styles.tagActive : styles.tagOff]}
                >
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={addNote}
            disabled={!canAdd}
            style={[styles.add, canAdd ? styles.addOn : styles.addOff]}
          >
            <Text style={[styles.addText, canAdd ? styles.addTextOn : styles.addTextOff]}>
              추가
            </Text>
          </Pressable>
        </View>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      </View>

      <SectionLabel>
        {isToday ? "오늘의 노트" : `${monthDayKo(listDate)} 노트`}
      </SectionLabel>
      {loading && !data ? <Loading /> : null}
      {error ? <InlineEmpty>업무일지를 불러오지 못했습니다</InlineEmpty> : null}
      {data ? (
        data.length > 0 ? (
          <Group>
            {sortedNotes.map((note, i) => (
              <NoteCell
                key={note.id}
                note={note}
                last={i === sortedNotes.length - 1}
                onToggle={() => toggle(note)}
                onDelete={() => remove(note)}
              />
            ))}
          </Group>
        ) : (
          <Group>
            <InlineEmpty>
              {isToday
                ? "아직 오늘의 메모가 없습니다"
                : "이 날짜에 남긴 메모가 없습니다"}
            </InlineEmpty>
          </Group>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  input: {
    minHeight: 64,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 8,
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.3,
    color: colors.label,
    textAlignVertical: "top",
  },
  composerSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 9,
    gap: 10,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
  },
  dateControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnOff: {
    opacity: 0.4,
  },
  saveError: {
    paddingHorizontal: 15,
    paddingBottom: 10,
    fontSize: 12.5,
    letterSpacing: -0.2,
    color: colors.critical,
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 11,
    gap: 10,
  },
  tagRow: {
    gap: 6,
    alignItems: "center",
  },
  tag: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagActive: {
    backgroundColor: colors.brandTintStrong,
  },
  tagOff: {
    backgroundColor: colors.fill,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.subText,
  },
  tagTextActive: {
    color: colors.brand,
    fontWeight: "600",
  },
  add: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.chip,
    flexShrink: 0,
  },
  addOn: {
    backgroundColor: colors.brand,
  },
  addOff: {
    backgroundColor: colors.fillStrong,
  },
  addText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  addTextOn: {
    color: colors.canvas,
  },
  addTextOff: {
    color: colors.tertiaryLabel,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.8,
  },
  checkOff: {
    borderColor: colors.quaternary,
    backgroundColor: "transparent",
  },
  checkDone: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  noteMain: {
    flex: 1,
    minWidth: 0,
  },
  noteText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.3,
    color: colors.label,
  },
  noteTextDone: {
    color: "#A9A9AE",
    textDecorationLine: "line-through",
  },
  noteMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  tagChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.fill,
  },
  tagChipText: {
    ...typography.smallBadge,
    color: colors.secondaryLabel,
  },
  noteTime: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.tertiaryLabel,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginTop: -3,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -1,
  },
  confirmCancel: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.chip,
    backgroundColor: colors.fill,
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.subText,
  },
  confirmDelete: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.chip,
    backgroundColor: colors.critical,
  },
  confirmDeleteBusy: {
    opacity: 0.6,
  },
  confirmDeleteText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.canvas,
  },
});

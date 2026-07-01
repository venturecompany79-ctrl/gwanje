import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Check, Circle, Tag } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { todayKstDate } from "@/lib/dates";
import { TODO_TAGS, type TodoTag } from "@/lib/labels";
import { loadTodayNotes, type TodoNoteRow } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, LoadingState, PrimaryButton, Row, Section } from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

function tagLabel(tag: string | null) {
  return tag ? `[${tag}]` : "[태그 없음]";
}

export default function TodayScreen() {
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState<TodoTag | null>("업무");
  const { data, loading, refreshing, error, refresh } =
    useAsyncData(loadTodayNotes);

  async function addNote() {
    const content = draft.trim();
    if (!content) return;
    await mobileApi("/api/mobile/todos", {
      body: { content, tag, noteDate: todayKstDate() },
    });
    setDraft("");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  }

  async function toggle(note: TodoNoteRow) {
    await mobileApi(`/api/mobile/todos/${note.id}`, {
      method: "PATCH",
      body: { completed: !note.completed },
    });
    await Haptics.selectionAsync();
    refresh();
  }

  return (
    <Screen
      title="오늘"
      subtitle={`${todayKstDate()} · 업무일지`}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Section title="새 노트">
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="오늘 처리할 일을 적어보세요"
            style={styles.input}
            multiline
          />
          <View style={styles.tagRow}>
            {TODO_TAGS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setTag(item)}
                style={[styles.tag, tag === item && styles.tagActive]}
              >
                <Tag size={14} color={tag === item ? colors.brand : colors.secondaryLabel} />
                <Text style={[styles.tagText, tag === item && styles.tagTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton disabled={!draft.trim()} onPress={addNote}>
            추가
          </PrimaryButton>
        </View>
      </Section>

      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="오늘 업무를 불러오지 못했습니다" description={error} /> : null}
      {data ? (
        <Section title="오늘의 노트" caption={`${data.length}건`}>
          {data.length > 0 ? (
            data.map((note) => (
              <Row
                key={note.id}
                title={note.content}
                subtitle={note.completed ? "완료됨" : tagLabel(note.tag)}
                icon={
                  note.completed ? (
                    <Check size={18} color={colors.success} />
                  ) : (
                    <Circle size={18} color={colors.tertiaryLabel} />
                  )
                }
                tone={note.completed ? "success" : "neutral"}
                dense
                onPress={() => toggle(note)}
              />
            ))
          ) : (
            <EmptyState
              title="오늘 노트가 없습니다"
              description="가벼운 현장 메모부터 남겨두세요."
              compact
            />
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: {
    padding: spacing.base,
    gap: spacing.md,
  },
  input: {
    minHeight: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    ...typography.body,
    color: colors.label,
  },
  tagRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tag: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  tagActive: {
    backgroundColor: colors.brandLight,
    borderColor: "rgba(0, 100, 224, 0.18)",
  },
  tagText: {
    ...typography.footnote,
    color: colors.secondaryLabel,
  },
  tagTextActive: {
    color: colors.brand,
  },
});

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Bell, CheckCheck } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { ddayLabel, timeLabel } from "@/lib/dates";
import { NOTIFICATION_TYPE_LABEL, type NotificationType } from "@/lib/labels";
import { loadNotifications, type NotificationItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  EmptyState,
  FilterChip,
  LoadingState,
  Row,
  Section,
  StatusBadge,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

type Filter = "all" | NotificationType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "expiry", label: "만료" },
  { value: "deadline", label: "마감" },
  { value: "program_match", label: "매칭" },
];

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: (item: NotificationItem) => void;
}) {
  const tone = item.is_urgent
    ? "critical"
    : item.type === "expiry"
      ? "attention"
      : item.type === "program_match"
        ? "purple"
        : "brand";
  return (
    <Row
      title={item.title}
      subtitle={item.companyName}
      meta={`${NOTIFICATION_TYPE_LABEL[item.type]} · ${timeLabel(item.created_at)}`}
      icon={
        <Bell
          size={18}
          color={item.is_urgent ? colors.critical : colors.brand}
        />
      }
      tone={tone}
      accent={item.is_urgent}
      right={
        <View style={styles.nRight}>
          {item.is_urgent ? <StatusBadge tone="critical">긴급</StatusBadge> : null}
          {item.daysLeft !== null ? (
            <Text style={styles.dday}>{ddayLabel(item.daysLeft)}</Text>
          ) : null}
          {!item.is_read ? <View style={styles.unreadDot} /> : null}
        </View>
      }
      onPress={() => onRead(item)}
    />
  );
}

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, refreshing, error, refresh } =
    useAsyncData(loadNotifications);

  const filtered = useMemo(
    () =>
      (data ?? []).filter((item) => filter === "all" || item.type === filter),
    [data, filter],
  );
  const unreadCount = (data ?? []).filter((item) => !item.is_read).length;

  async function markRead(item: NotificationItem) {
    if (item.is_read) return;
    await mobileApi("/api/mobile/notifications/read", { body: { id: item.id } });
    await Haptics.selectionAsync();
    refresh();
  }

  async function markAll() {
    if (unreadCount === 0) return;
    await mobileApi("/api/mobile/notifications/read-all");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  }

  return (
    <Screen
      title="알림"
      subtitle={`안읽음 ${unreadCount}건`}
      refreshing={refreshing}
      onRefresh={refresh}
      action={
        <Pressable style={styles.readAll} onPress={markAll}>
          <CheckCheck size={18} color={unreadCount > 0 ? colors.brand : colors.tertiaryLabel} />
        </Pressable>
      }
    >
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            active={filter === item.value}
            onPress={() => setFilter(item.value)}
          />
        ))}
      </View>

      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="알림을 불러오지 못했습니다" description={error} /> : null}
      {data ? (
        <Section title="최근 알림" caption={`${filtered.length}건`}>
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <NotificationRow key={item.id} item={item} onRead={markRead} />
            ))
          ) : (
            <EmptyState title="표시할 알림이 없습니다" compact />
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  readAll: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  nRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  dday: {
    ...typography.caption,
    color: colors.stone,
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
});

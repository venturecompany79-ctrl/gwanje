import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { timeLabel } from "@/lib/dates";
import { NOTIFICATION_TYPE_LABEL, type NotificationType } from "@/lib/labels";
import { loadNotifications, type NotificationItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  Cell,
  Group,
  InlineEmpty,
  Loading,
  Segmented,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

type Filter = "all" | NotificationType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "expiry", label: "만료" },
  { value: "deadline", label: "마감" },
  { value: "program_match", label: "매칭" },
];

function NotificationCell({
  item,
  last,
  onRead,
}: {
  item: NotificationItem;
  last?: boolean;
  onRead: (item: NotificationItem) => void;
}) {
  const dotColor = item.is_urgent ? colors.critical : colors.brand;
  return (
    <Cell last={last} sepInset={34} align="flex-start" onPress={() => onRead(item)}>
      <View style={styles.dotCol}>
        {!item.is_read ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      </View>
      <View style={styles.main}>
        <View style={styles.eyebrowRow}>
          {item.is_urgent ? <Text style={styles.urgent}>긴급</Text> : null}
          <Text style={styles.type}>{NOTIFICATION_TYPE_LABEL[item.type]}</Text>
        </View>
        <Text style={[styles.title, item.is_read ? styles.titleRead : styles.titleUnread]}>
          {item.title}
        </Text>
        {item.companyName ? (
          <Text style={styles.sub} numberOfLines={2}>
            {item.companyName}
          </Text>
        ) : null}
      </View>
      <Text style={styles.time}>{timeLabel(item.created_at)}</Text>
    </Cell>
  );
}

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, refreshing, error, refresh } =
    useAsyncData(loadNotifications);

  const filtered = useMemo(
    () => (data ?? []).filter((item) => filter === "all" || item.type === filter),
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
      subtitle={`읽지 않음 ${unreadCount}건`}
      refreshing={refreshing}
      onRefresh={refresh}
      action={
        <Pressable onPress={markAll} disabled={unreadCount === 0} hitSlop={8}>
          <Text style={[styles.readAll, unreadCount === 0 && styles.readAllOff]}>
            모두 읽음
          </Text>
        </Pressable>
      }
    >
      <View style={styles.filterWrap}>
        <Segmented items={FILTERS} value={filter} onChange={setFilter} />
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <InlineEmpty>알림을 불러오지 못했습니다</InlineEmpty> : null}
      {data ? (
        filtered.length > 0 ? (
          <Group>
            {filtered.map((item, i) => (
              <NotificationCell
                key={item.id}
                item={item}
                last={i === filtered.length - 1}
                onRead={markRead}
              />
            ))}
          </Group>
        ) : (
          <InlineEmpty>해당하는 알림이 없습니다</InlineEmpty>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterWrap: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
  },
  readAll: {
    fontSize: 14.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.brand,
    paddingVertical: 4,
  },
  readAllOff: {
    color: colors.quaternary,
  },
  dotCol: {
    width: 9,
    alignItems: "center",
    paddingTop: 6,
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1,
  },
  urgent: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.critical,
    letterSpacing: -0.1,
  },
  type: {
    ...typography.eyebrow,
    color: colors.muted,
  },
  title: {
    fontSize: 15,
    letterSpacing: -0.3,
    color: colors.label,
  },
  titleUnread: {
    fontWeight: "700",
  },
  titleRead: {
    fontWeight: "400",
  },
  sub: {
    fontSize: 13,
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
    lineHeight: 18,
  },
  time: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.tertiaryLabel,
    flexShrink: 0,
    paddingTop: 1,
  },
});

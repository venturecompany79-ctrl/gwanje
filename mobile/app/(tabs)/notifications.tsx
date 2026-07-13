import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, typography } from "@/design/tokens";
import { mobileApi } from "@/lib/api";
import { timeLabel } from "@/lib/dates";
import { NOTIFICATION_TYPE_LABEL, type NotificationType } from "@/lib/labels";
import {
  loadNotificationSummary,
  loadNotificationsPage,
  type NotificationItem,
} from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { usePagedData } from "@/lib/usePagedData";
import {
  Cell,
  InlineEmpty,
  Loading,
  Segmented,
} from "@/ui/Primitives";
import { ScreenList } from "@/ui/Screen";

type Filter = "all" | NotificationType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "expiry", label: "만료" },
  { value: "deadline", label: "마감" },
  { value: "program_match", label: "매칭" },
];

const NotificationCell = memo(function NotificationCell({
  item,
  first,
  last,
  onRead,
}: {
  item: NotificationItem;
  first?: boolean;
  last?: boolean;
  onRead: (item: NotificationItem) => void;
}) {
  const dotColor = item.is_urgent ? colors.critical : colors.brand;
  return (
    <Cell
      grouped
      first={first}
      last={last}
      sepInset={34}
      align="flex-start"
      onPress={item.is_read ? undefined : () => onRead(item)}
      accessibilityLabel={`${item.is_urgent ? "긴급, " : ""}${NOTIFICATION_TYPE_LABEL[item.type]}, ${item.title}${item.companyName ? `, ${item.companyName}` : ""}, ${timeLabel(item.created_at)}, ${item.is_read ? "읽음" : "읽지 않음"}`}
    >
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
});

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const readingIdsRef = useRef(new Set<string>());
  const pageLoader = useCallback(
    (offset: number) =>
      loadNotificationsPage({
        offset,
        type: filter === "all" ? undefined : filter,
      }),
    [filter],
  );
  const {
    items: notifications,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
  } = usePagedData(pageLoader);
  const {
    data: summary,
    error: summaryError,
    refreshing: summaryRefreshing,
    refresh: refreshSummary,
  } = useAsyncData(loadNotificationSummary);
  const loadedUnreadCount = notifications.filter((item) => !item.is_read).length;
  const unreadCount = summary?.unreadCount ?? loadedUnreadCount;
  const unreadSubtitle = summary
    ? `읽지 않음 ${summary.unreadCount}건`
    : summaryError
      ? loadedUnreadCount > 0
        ? `읽지 않음 ${loadedUnreadCount}건 이상`
        : "미읽음 수 확인 실패"
      : loadedUnreadCount > 0
        ? `읽지 않음 ${loadedUnreadCount}건 이상`
        : "미읽음 수 확인 중";
  const refreshPageRef = useRef(refresh);
  useEffect(() => {
    refreshPageRef.current = refresh;
  }, [refresh]);

  const refreshAll = useCallback(() => {
    void refresh();
    void refreshSummary();
  }, [refresh, refreshSummary]);

  const markRead = useCallback(
    async (item: NotificationItem) => {
      if (item.is_read || readingIdsRef.current.has(item.id)) return;
      readingIdsRef.current.add(item.id);
      try {
        setActionError(null);
        await mobileApi("/api/mobile/notifications/read", {
          body: { id: item.id },
        });
        await Haptics.selectionAsync();
        await Promise.all([refreshPageRef.current(), refreshSummary()]);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "읽음 처리에 실패했습니다.",
        );
      } finally {
        readingIdsRef.current.delete(item.id);
      }
    },
    [refreshSummary],
  );

  const markAll = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      setActionError(null);
      await mobileApi("/api/mobile/notifications/read-all");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([refreshPageRef.current(), refreshSummary()]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "읽음 처리에 실패했습니다.",
      );
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, refreshSummary, unreadCount]);

  return (
    <ScreenList
      title="알림"
      subtitle={unreadSubtitle}
      refreshing={refreshing || summaryRefreshing}
      onRefresh={refreshAll}
      action={
        <Pressable
          onPress={markAll}
          disabled={unreadCount === 0 || markingAll}
          accessibilityRole="button"
          accessibilityLabel="모든 알림 읽음 처리"
          accessibilityState={{ disabled: unreadCount === 0 || markingAll, busy: markingAll }}
          style={styles.readAllButton}
        >
          <Text
            style={[
              styles.readAll,
              (unreadCount === 0 || markingAll) && styles.readAllOff,
            ]}
          >
            {markingAll ? "처리 중" : "모두 읽음"}
          </Text>
        </Pressable>
      }
      header={
        <>
          <View style={styles.filterWrap}>
            <Segmented items={FILTERS} value={filter} onChange={setFilter} />
          </View>
          {actionError ? (
            <Text accessibilityLiveRegion="polite" style={styles.actionError}>
              {actionError}
            </Text>
          ) : null}
          {loading ? <Loading /> : null}
          {error ? <InlineEmpty>알림을 불러오지 못했습니다</InlineEmpty> : null}
        </>
      }
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <NotificationCell
          item={item}
          first={index === 0}
          last={index === notifications.length - 1}
          onRead={markRead}
        />
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <InlineEmpty>해당하는 알림이 없습니다</InlineEmpty>
        ) : null
      }
      ListFooterComponent={loadingMore ? <Loading /> : null}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.35}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  filterWrap: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  actionError: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    fontSize: 12.5,
    letterSpacing: -0.2,
    color: colors.critical,
  },
  readAllButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  readAll: {
    fontSize: 14.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.brand,
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

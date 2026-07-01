import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Building2, CalendarDays, ClipboardList } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { longKstDate, monthDayKo } from "@/lib/dates";
import { loadHomeData, type DeadlineItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  Cell,
  Chevron,
  DdayBadge,
  Group,
  InlineEmpty,
  Loading,
  SectionLabel,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

function DeadlineCell({
  item,
  accent,
  last,
  onPress,
}: {
  item: DeadlineItem;
  accent?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  return (
    <Cell last={last} onPress={onPress}>
      {accent ? <View style={styles.accent} /> : null}
      <View style={styles.cellMain}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {item.company_name ?? "-"}
        </Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title ?? "일정"}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <DdayBadge daysLeft={item.days_left} />
        <Text style={styles.due}>{monthDayKo(item.due_date)}</Text>
      </View>
      <Chevron />
    </Cell>
  );
}

function QuickCell({
  icon,
  label,
  onPress,
  last,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Cell last={last} onPress={onPress} sepInset={57} style={styles.quickCell}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Chevron />
    </Cell>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { data, loading, refreshing, error, refresh } = useAsyncData(loadHomeData);
  const [menuOpen, setMenuOpen] = useState(false);

  const email = session?.user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "관";

  function openDeadline(item: DeadlineItem) {
    if (item.source === "task") {
      router.push(`/task/${item.id}`);
    } else if (item.company_id) {
      router.push(`/company/${item.company_id}`);
    }
  }

  return (
    <>
      <Screen
        title="관제"
        subtitle={`${longKstDate()} · 모바일 운영`}
        refreshing={refreshing}
        onRefresh={refresh}
        action={
          <Pressable style={styles.avatar} onPress={() => setMenuOpen(true)}>
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
        }
      >
        {loading && !data ? <Loading /> : null}
        {error ? <InlineEmpty>데이터를 불러오지 못했습니다</InlineEmpty> : null}
        {data ? (
          <>
            <View style={styles.strip}>
              <Pressable style={styles.stripItem} onPress={() => router.push("/tasks")}>
                <Text
                  style={[
                    styles.stripValue,
                    data.overdue.length > 0 && styles.stripValueCritical,
                  ]}
                >
                  {data.overdue.length}
                </Text>
                <Text style={styles.stripLabel}>기한 지남</Text>
              </Pressable>
              <View style={styles.stripDivider} />
              <Pressable style={styles.stripItem} onPress={() => router.push("/tasks")}>
                <Text style={styles.stripValue}>{data.due7}</Text>
                <Text style={styles.stripLabel}>7일 내 마감</Text>
              </Pressable>
              <View style={styles.stripDivider} />
              <Pressable style={styles.stripItem} onPress={() => router.push("/tasks")}>
                <Text style={styles.stripValue}>{data.activeTasks}</Text>
                <Text style={styles.stripLabel}>진행 Task</Text>
              </Pressable>
            </View>

            {data.overdue.length > 0 ? (
              <>
                <View style={styles.urgentLabel}>
                  <View style={styles.urgentDot} />
                  <Text style={styles.urgentText}>긴급 · 기한 지남</Text>
                </View>
                <Group>
                  {data.overdue.map((item, i) => (
                    <DeadlineCell
                      key={`${item.source}-${item.id}`}
                      item={item}
                      accent
                      last={i === data.overdue.length - 1}
                      onPress={() => openDeadline(item)}
                    />
                  ))}
                </Group>
              </>
            ) : null}

            <SectionLabel>다가오는 마감</SectionLabel>
            {data.deadlines.length > 0 ? (
              <Group>
                {data.deadlines.map((item, i) => (
                  <DeadlineCell
                    key={`${item.source}-${item.id}`}
                    item={item}
                    last={i === data.deadlines.length - 1}
                    onPress={() => openDeadline(item)}
                  />
                ))}
              </Group>
            ) : (
              <Group>
                <InlineEmpty>이번 주 급한 마감이 없습니다</InlineEmpty>
              </Group>
            )}

            <SectionLabel>빠른 이동</SectionLabel>
            <Group>
              <QuickCell
                icon={<ClipboardList size={18} color={colors.brand} strokeWidth={1.9} />}
                label="Task 관리"
                onPress={() => router.push("/tasks")}
              />
              <QuickCell
                icon={<Building2 size={18} color={colors.brand} strokeWidth={1.8} />}
                label="기업"
                onPress={() => router.push("/companies")}
              />
              <QuickCell
                icon={<CalendarDays size={18} color={colors.brand} strokeWidth={1.8} />}
                label="오늘 업무일지"
                onPress={() => router.push("/today")}
                last
              />
            </Group>
          </>
        ) : null}
      </Screen>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuWrap} onPress={() => {}}>
            <View style={styles.menuCard}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuEmail} numberOfLines={1}>
                  {email || "로그인 계정"}
                </Text>
              </View>
              <View style={styles.menuSep} />
              <Pressable
                style={styles.menuBtn}
                onPress={async () => {
                  setMenuOpen(false);
                  await signOut();
                }}
              >
                <Text style={styles.menuLogout}>로그아웃</Text>
              </Pressable>
            </View>
            <Pressable style={styles.menuCancel} onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuCancelText}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.canvas,
    letterSpacing: -0.2,
  },
  strip: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 3px rgba(10,19,23,0.04)" },
      default: {},
    }),
  },
  stripItem: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  stripValue: {
    ...typography.kpi,
    color: colors.label,
  },
  stripValueCritical: {
    color: colors.critical,
  },
  stripLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.secondaryLabel,
    marginTop: 5,
    letterSpacing: -0.1,
  },
  stripDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginVertical: 14,
  },
  urgentLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  urgentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.critical,
  },
  urgentText: {
    ...typography.sectionLabel,
    color: colors.critical,
    fontWeight: "600",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.critical,
  },
  cellMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.secondaryLabel,
  },
  rowTitle: {
    ...typography.rowTitle,
    color: colors.label,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  due: {
    ...typography.time,
    color: colors.tertiaryLabel,
  },
  quickCell: {
    gap: 13,
    paddingLeft: 14,
  },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    flex: 1,
    ...typography.rowBody,
    color: colors.label,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  menuWrap: {
    gap: 8,
  },
  menuCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  menuHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  menuEmail: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.secondaryLabel,
    letterSpacing: -0.2,
  },
  menuSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separatorStrong,
  },
  menuBtn: {
    paddingVertical: 16,
    alignItems: "center",
  },
  menuLogout: {
    fontSize: 18,
    fontWeight: "500",
    color: colors.critical,
    letterSpacing: -0.3,
  },
  menuCancel: {
    backgroundColor: colors.canvas,
    borderRadius: radius.card,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  menuCancelText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.brand,
    letterSpacing: -0.3,
  },
});

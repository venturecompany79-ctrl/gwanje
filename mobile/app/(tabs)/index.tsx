import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  LogOut,
  ShieldCheck,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { shortDate, todayKstDate } from "@/lib/dates";
import { loadHomeData, type DeadlineItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  DdayPill,
  EmptyState,
  LoadingState,
  Row,
  Section,
  StatusBadge,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

function SummaryStat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "normal" | "critical";
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.kpiValue, tone === "critical" && styles.kpiValueCritical]}>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function DeadlineRow({ item }: { item: DeadlineItem }) {
  const urgent =
    item.days_left !== null && item.days_left !== undefined && item.days_left <= 3;
  return (
    <Row
      title={item.company_name ?? "-"}
      subtitle={item.title}
      meta={`${shortDate(item.due_date)} · ${item.category_name ?? item.source}`}
      right={<DdayPill daysLeft={item.days_left} />}
      tone={urgent ? "critical" : "attention"}
      accent={urgent}
      dense
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, loading, refreshing, error, refresh } = useAsyncData(loadHomeData);

  return (
    <Screen
      title="관제"
      subtitle={`${todayKstDate()} · 모바일 운영`}
      refreshing={refreshing}
      onRefresh={refresh}
      action={
        <Pressable style={styles.logout} onPress={signOut}>
          <LogOut size={18} color={colors.secondaryLabel} />
        </Pressable>
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="홈을 불러오지 못했습니다" description={error} /> : null}
      {data ? (
        <>
          <View style={styles.summary}>
            <SummaryStat
              label="기한 지남"
              value={data.overdue.length}
              tone={data.overdue.length > 0 ? "critical" : "normal"}
            />
            <View style={styles.summaryDivider} />
            <SummaryStat
              label="7일 내 마감"
              value={data.due7}
              tone={data.due7 > 0 ? "critical" : "normal"}
            />
            <View style={styles.summaryDivider} />
            <SummaryStat label="진행 Task" value={data.activeTasks} />
          </View>

          <View style={styles.opsStrip}>
            <View style={styles.opsItem}>
              <Building2 size={16} color={colors.stone} />
              <Text style={styles.opsText}>기업 {data.companyCount}</Text>
            </View>
            <View style={styles.opsItem}>
              <ShieldCheck size={16} color={colors.stone} />
              <Text style={styles.opsText}>30일 내 만료 {data.expire30}</Text>
            </View>
            <View style={styles.opsItem}>
              <Bell size={16} color={colors.stone} />
              <Text style={styles.opsText}>안읽음 {data.unreadCount}</Text>
            </View>
          </View>

          {data.overdue.length > 0 ? (
            <Section title="긴급 · 기한 지남" caption={`${data.overdue.length}건`}>
              <View style={styles.urgentHead}>
                <View style={styles.urgentIcon}>
                  <AlertTriangle size={18} color={colors.critical} />
                </View>
                <View style={styles.urgentText}>
                  <Text style={styles.urgentTitle}>오늘 먼저 확인할 항목</Text>
                  <Text style={styles.urgentDesc}>
                    지연된 마감은 담당 기업 확인 후 바로 처리하세요.
                  </Text>
                </View>
                <StatusBadge tone="critical">긴급</StatusBadge>
              </View>
              {data.overdue.map((item) => (
                <DeadlineRow key={`${item.source}-${item.id}`} item={item} />
              ))}
            </Section>
          ) : null}

          <Section title="다가오는 마감" caption={`${data.deadlines.length}건`}>
            {data.deadlines.length > 0 ? (
              data.deadlines.map((item) => (
                <DeadlineRow key={`${item.source}-${item.id}`} item={item} />
              ))
            ) : (
              <EmptyState title="이번 주 급한 마감이 없습니다" />
            )}
          </Section>

          <Section title="빠른 이동">
            <Row
              title="알림 확인"
              subtitle={`안읽음 ${data.unreadCount}건`}
              icon={<Bell size={18} color={colors.brand} />}
              tone="brand"
              onPress={() => router.push("/notifications")}
            />
            <Row
              title="오늘 업무"
              subtitle="노트 작성과 완료 체크"
              icon={<CalendarDays size={18} color={colors.brand} />}
              tone="brand"
              onPress={() => router.push("/today")}
            />
            <Row
              title="Task"
              subtitle="단계와 메모 수정"
              icon={<ClipboardList size={18} color={colors.brand} />}
              tone="brand"
              onPress={() => router.push("/tasks")}
            />
            <Row
              title="기업"
              subtitle="담당자 연락처와 요약 조회"
              icon={<Building2 size={18} color={colors.brand} />}
              tone="brand"
              onPress={() => router.push("/companies")}
            />
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logout: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    flexDirection: "row",
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
    overflow: "hidden",
  },
  summaryStat: {
    flex: 1,
    minHeight: 74,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairlineSoft,
  },
  kpiLabel: {
    ...typography.footnote,
    color: colors.secondaryLabel,
    textAlign: "center",
  },
  kpiValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.inkDeep,
  },
  kpiValueCritical: {
    color: colors.critical,
  },
  opsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  opsItem: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  opsText: {
    ...typography.footnote,
    color: colors.charcoal,
    fontWeight: "700",
  },
  urgentHead: {
    padding: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairlineSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  urgentIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.criticalSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentText: {
    flex: 1,
    minWidth: 0,
  },
  urgentTitle: {
    ...typography.bodyStrong,
    color: colors.inkDeep,
  },
  urgentDesc: {
    ...typography.footnote,
    color: colors.secondaryLabel,
    marginTop: 2,
  },
});

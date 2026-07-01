import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Building2, CalendarDays, ClipboardList, LogOut } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { shortDate, todayKstDate } from "@/lib/dates";
import { loadHomeData, type DeadlineItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { DdayPill, EmptyState, LoadingState, Row, Section } from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

function Kpi({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "normal" | "critical";
}) {
  return (
    <View style={[styles.kpi, tone === "critical" && styles.kpiCritical]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, tone === "critical" && styles.kpiValueCritical]}>
        {value}
      </Text>
    </View>
  );
}

function DeadlineRow({ item }: { item: DeadlineItem }) {
  return (
    <Row
      title={item.company_name ?? "-"}
      subtitle={item.title}
      meta={`${shortDate(item.due_date)} · ${item.category_name ?? item.source}`}
      right={<DdayPill daysLeft={item.days_left} />}
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
          <View style={styles.kpiGrid}>
            <Kpi label="기업" value={data.companyCount} />
            <Kpi label="7일 내 마감" value={data.due7} tone={data.due7 > 0 ? "critical" : "normal"} />
            <Kpi label="30일 내 만료" value={data.expire30} />
            <Kpi label="진행 Task" value={data.activeTasks} />
          </View>

          {data.overdue.length > 0 ? (
            <Section title="기한 지남" caption={`${data.overdue.length}건`}>
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
              onPress={() => router.push("/notifications")}
            />
            <Row
              title="오늘 업무"
              subtitle="노트 작성과 완료 체크"
              icon={<CalendarDays size={18} color={colors.brand} />}
              onPress={() => router.push("/today")}
            />
            <Row
              title="Task"
              subtitle="단계와 메모 수정"
              icon={<ClipboardList size={18} color={colors.brand} />}
              onPress={() => router.push("/tasks")}
            />
            <Row
              title="기업"
              subtitle="담당자 연락처와 요약 조회"
              icon={<Building2 size={18} color={colors.brand} />}
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
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  kpi: {
    width: "47.9%",
    minHeight: 104,
    borderRadius: radius.xl,
    backgroundColor: colors.canvas,
    padding: spacing.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    justifyContent: "space-between",
  },
  kpiCritical: {
    backgroundColor: colors.criticalSoft,
    borderColor: "rgba(228, 30, 63, 0.22)",
  },
  kpiLabel: {
    ...typography.footnote,
    color: colors.secondaryLabel,
  },
  kpiValue: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.label,
  },
  kpiValueCritical: {
    color: colors.critical,
  },
});

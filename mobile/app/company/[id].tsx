import { useCallback, type ReactNode } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Mail, Phone, ShieldCheck } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { daysFromDateString, monthDayKo } from "@/lib/dates";
import { TASK_STAGE_LABEL } from "@/lib/labels";
import { loadCompanyDetail } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { useAuth } from "@/context/AuthContext";
import {
  Cell,
  Chevron,
  DdayBadge,
  Group,
  InlineEmpty,
  Loading,
  SectionLabel,
  StageBadge,
} from "@/ui/Primitives";

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        pressed && !disabled && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, disabled && styles.actionLabelOff]}>{label}</Text>
    </Pressable>
  );
}

export default function CompanyDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadCurrentCompany = useCallback(
    () => (session ? loadCompanyDetail(String(id)) : Promise.resolve(null)),
    [id, session],
  );
  const { data, loading, error } = useAsyncData(loadCurrentCompany);

  if (!session) {
    return <Redirect href="/login" />;
  }

  const company = data?.company;
  const meta = company
    ? [company.industry, company.region].filter(Boolean).join(" · ")
    : "";
  const contactName = company?.contact_name ?? company?.ceo_name ?? "담당자 미지정";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <View style={[styles.nav, { paddingTop: insets.top }]}>
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={22} color={colors.brand} strokeWidth={2.1} />
            <Text style={styles.backText}>기업</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        >
          {loading && !data ? <Loading /> : null}
          {error ? <InlineEmpty>기업 상세를 불러오지 못했습니다</InlineEmpty> : null}
          {data && company ? (
            <>
              <View style={styles.titleBlock}>
                <Text style={styles.name}>{company.name}</Text>
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              </View>

              <View style={styles.actions}>
                <ActionButton
                  icon={<Phone size={21} color={colors.brand} strokeWidth={1.8} />}
                  label="전화"
                  disabled={!company.contact_phone}
                  onPress={() => Linking.openURL(`tel:${company.contact_phone}`)}
                />
                <ActionButton
                  icon={<Mail size={21} color={colors.brand} strokeWidth={1.8} />}
                  label="메일"
                  disabled={!company.contact_email}
                  onPress={() => Linking.openURL(`mailto:${company.contact_email}`)}
                />
              </View>

              <SectionLabel>담당자</SectionLabel>
              <View style={styles.contactCard}>
                <Text style={styles.contactName}>{contactName}</Text>
                {company.contact_phone ? (
                  <Text style={styles.contactLine}>{company.contact_phone}</Text>
                ) : null}
                {company.contact_email ? (
                  <Text style={styles.contactLine}>{company.contact_email}</Text>
                ) : null}
              </View>

              {data.deadlines.length > 0 ? (
                <>
                  <SectionLabel>다가오는 일정</SectionLabel>
                  <Group>
                    {data.deadlines.map((item, i) => (
                      <Cell key={`${item.source}-${item.id}`} last={i === data.deadlines.length - 1}>
                        <Text style={styles.scheduleTitle} numberOfLines={1}>
                          {item.title ?? "일정"}
                        </Text>
                        <View style={styles.scheduleRight}>
                          <Text style={styles.due}>{monthDayKo(item.due_date)}</Text>
                          <DdayBadge daysLeft={item.days_left} />
                        </View>
                      </Cell>
                    ))}
                  </Group>
                </>
              ) : null}

              <SectionLabel>자격 · 인증</SectionLabel>
              <Group>
                {data.credentials.length > 0 ? (
                  data.credentials.slice(0, 10).map((credential, i, arr) => (
                    <Cell key={credential.id} last={i === arr.length - 1} sepInset={43}>
                      <ShieldCheck size={17} color={colors.muted} strokeWidth={1.5} />
                      <Text style={styles.credName} numberOfLines={1}>
                        {credential.type}
                      </Text>
                    </Cell>
                  ))
                ) : (
                  <InlineEmpty>등록된 자격·인증 없음</InlineEmpty>
                )}
              </Group>

              <SectionLabel>Task</SectionLabel>
              <Group>
                {data.tasks.length > 0 ? (
                  data.tasks.slice(0, 10).map((task, i, arr) => {
                    const done = task.stage === "result";
                    return (
                      <Cell
                        key={task.id}
                        last={i === arr.length - 1}
                        onPress={() => router.push(`/task/${task.id}`)}
                      >
                        <View style={styles.taskMain}>
                          <Text style={styles.taskTitle} numberOfLines={1}>
                            {task.title}
                          </Text>
                          <View style={styles.taskMeta}>
                            <StageBadge label={TASK_STAGE_LABEL[task.stage]} done={done} />
                          </View>
                        </View>
                        <DdayBadge
                          daysLeft={daysFromDateString(task.due_date)}
                          tone={done ? "success" : undefined}
                          label={done ? "완료" : undefined}
                        />
                        <Chevron />
                      </Cell>
                    );
                  })
                ) : (
                  <InlineEmpty>등록된 Task 없음</InlineEmpty>
                )}
              </Group>
            </>
          ) : null}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.grouped,
  },
  nav: {
    backgroundColor: colors.grouped,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  back: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 12,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.brand,
    letterSpacing: -0.3,
  },
  titleBlock: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  name: {
    ...typography.detailTitle,
    color: colors.label,
  },
  meta: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
    marginTop: 5,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderRadius: 13,
  },
  actionPressed: {
    backgroundColor: "rgba(60,60,67,0.04)",
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    fontSize: 12.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.brand,
  },
  actionLabelOff: {
    color: colors.secondaryLabel,
  },
  contactCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  contactName: {
    ...typography.rowTitleLg,
    color: colors.label,
  },
  contactLine: {
    fontSize: 13.5,
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
    marginTop: 3,
  },
  scheduleTitle: {
    flex: 1,
    minWidth: 0,
    ...typography.rowBody,
    color: colors.label,
  },
  scheduleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  due: {
    ...typography.time,
    color: colors.tertiaryLabel,
  },
  credName: {
    flex: 1,
    minWidth: 0,
    ...typography.rowBody,
    color: colors.label,
  },
  taskMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  taskTitle: {
    ...typography.rowTitle,
    color: colors.label,
  },
  taskMeta: {
    flexDirection: "row",
  },
});

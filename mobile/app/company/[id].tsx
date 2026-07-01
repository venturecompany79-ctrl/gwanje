import { useCallback } from "react";
import { Linking, Pressable, StyleSheet } from "react-native";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Mail, Phone } from "lucide-react-native";
import { colors, radius } from "@/design/tokens";
import { daysFromDateString, ddayLabel, shortDate } from "@/lib/dates";
import { TASK_STAGE_LABEL } from "@/lib/labels";
import { loadCompanyDetail } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { useAuth } from "@/context/AuthContext";
import { DdayPill, EmptyState, LoadingState, Row, Section } from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

export default function CompanyDetailScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadCurrentCompany = useCallback(
    () => (session ? loadCompanyDetail(String(id)) : Promise.resolve(null)),
    [id, session],
  );
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    loadCurrentCompany,
  );

  const company = data?.company;

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        title={company?.name ?? "기업"}
        subtitle={company ? [company.industry, company.region].filter(Boolean).join(" · ") : undefined}
        refreshing={refreshing}
        onRefresh={refresh}
        action={
          <Pressable style={styles.back} onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.secondaryLabel} />
          </Pressable>
        }
      >
        {loading ? <LoadingState /> : null}
        {error ? <EmptyState title="기업 상세를 불러오지 못했습니다" description={error} /> : null}
        {data && company ? (
          <>
            <Section title="담당자">
              <Row title="대표자" subtitle={company.ceo_name ?? "-"} />
              <Row title="실무 담당" subtitle={company.contact_name ?? "-"} />
              {company.contact_phone ? (
                <Row
                  title={company.contact_phone}
                  subtitle="전화 걸기"
                  icon={<Phone size={18} color={colors.brand} />}
                  onPress={() => Linking.openURL(`tel:${company.contact_phone}`)}
                />
              ) : null}
              {company.contact_email ? (
                <Row
                  title={company.contact_email}
                  subtitle="메일 작성"
                  icon={<Mail size={18} color={colors.brand} />}
                  onPress={() => Linking.openURL(`mailto:${company.contact_email}`)}
                />
              ) : null}
            </Section>

            <Section title="다가오는 일정" caption={`${data.deadlines.length}건`}>
              {data.deadlines.length > 0 ? (
                data.deadlines.map((item) => (
                  <Row
                    key={`${item.source}-${item.id}`}
                    title={item.title ?? "일정"}
                    subtitle={shortDate(item.due_date)}
                    right={<DdayPill daysLeft={item.days_left} />}
                  />
                ))
              ) : (
                <EmptyState title="다가오는 일정이 없습니다" />
              )}
            </Section>

            <Section title="자격·인증" caption={`${data.credentials.length}건`}>
              {data.credentials.length > 0 ? (
                data.credentials.slice(0, 8).map((credential) => (
                  <Row
                    key={credential.id}
                    title={credential.type}
                    subtitle={`만료 ${shortDate(credential.expires_date)}`}
                    meta={credential.memo}
                  />
                ))
              ) : (
                <EmptyState title="등록된 자격이 없습니다" />
              )}
            </Section>

            <Section title="Task" caption={`${data.tasks.length}건`}>
              {data.tasks.length > 0 ? (
                data.tasks.slice(0, 8).map((task) => (
                  <Row
                    key={task.id}
                    title={task.title}
                    subtitle={TASK_STAGE_LABEL[task.stage]}
                    meta={`${shortDate(task.due_date)} · ${ddayLabel(daysFromDateString(task.due_date))}`}
                    onPress={() => router.push(`/task/${task.id}`)}
                  />
                ))
              ) : (
                <EmptyState title="등록된 Task가 없습니다" />
              )}
            </Section>
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
});

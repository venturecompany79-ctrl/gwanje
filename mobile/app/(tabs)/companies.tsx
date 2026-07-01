import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";
import { Building2, Search } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { ddayLabel } from "@/lib/dates";
import { loadCompanies, type CompanyListItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import { DdayPill, EmptyState, LoadingState, Row, Section } from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

function CompanyRow({ company, onPress }: { company: CompanyListItem; onPress: () => void }) {
  const hasDeadline = company.nearestDaysLeft !== null;
  const companyMeta = [company.industry, company.region].filter(Boolean).join(" · ");
  const urgent =
    company.nearestDaysLeft !== null &&
    company.nearestDaysLeft !== undefined &&
    company.nearestDaysLeft <= 7;
  return (
    <Row
      title={company.name}
      subtitle={company.contact_name ? `담당 ${company.contact_name}` : "담당자 미지정"}
      meta={
        hasDeadline
          ? [companyMeta, `가까운 일정 ${ddayLabel(company.nearestDaysLeft)}`]
              .filter(Boolean)
              .join(" · ")
          : companyMeta || "다가오는 마감 없음"
      }
      icon={
        <Building2
          size={18}
          color={urgent ? colors.attention : colors.brand}
        />
      }
      tone={urgent ? "attention" : "brand"}
      right={hasDeadline ? <DdayPill daysLeft={company.nearestDaysLeft} /> : undefined}
      onPress={onPress}
    />
  );
}

export default function CompaniesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data, loading, refreshing, error, refresh } = useAsyncData(loadCompanies);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((company) =>
      [company.name, company.industry, company.contact_name, company.ceo_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [data, query]);

  return (
    <Screen title="기업" subtitle="담당자와 요약 조회" refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.search}>
        <Search size={18} color={colors.tertiaryLabel} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="기업명, 업종, 담당자 검색"
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="기업을 불러오지 못했습니다" description={error} /> : null}
      {data ? (
        <Section title="관리 기업" caption={`${filtered.length}개사`}>
          {filtered.length > 0 ? (
            filtered.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                onPress={() => router.push(`/company/${company.id}`)}
              />
            ))
          ) : (
            <EmptyState title="검색 결과가 없습니다" compact />
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 44,
    borderRadius: radius.full,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.label,
  },
});

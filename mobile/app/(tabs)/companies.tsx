import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Search } from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { loadCompanies, type CompanyListItem } from "@/lib/queries";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  Cell,
  Chevron,
  DdayBadge,
  Group,
  InlineEmpty,
  Loading,
} from "@/ui/Primitives";
import { Screen } from "@/ui/Screen";

function CompanyCell({
  company,
  last,
  onPress,
}: {
  company: CompanyListItem;
  last?: boolean;
  onPress: () => void;
}) {
  const sub = [company.contact_name, company.industry, company.region]
    .filter(Boolean)
    .join(" · ");
  const hasDeadline = company.nearestDaysLeft !== null && company.nearestDaysLeft !== undefined;
  return (
    <Cell last={last} onPress={onPress}>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {company.name}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {hasDeadline ? (
          <DdayBadge daysLeft={company.nearestDaysLeft} />
        ) : (
          <DdayBadge label="없음" tone="neutral" />
        )}
        <Chevron />
      </View>
    </Cell>
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
      [company.name, company.industry, company.region, company.contact_name, company.ceo_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [data, query]);

  return (
    <Screen title="기업" refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Search size={16} color={colors.secondaryLabel} strokeWidth={1.7} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="검색"
            placeholderTextColor={colors.secondaryLabel}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {loading && !data ? <Loading /> : null}
      {error ? <InlineEmpty>기업을 불러오지 못했습니다</InlineEmpty> : null}
      {data ? (
        filtered.length > 0 ? (
          <Group>
            {filtered.map((company, i) => (
              <CompanyCell
                key={company.id}
                company={company}
                last={i === filtered.length - 1}
                onPress={() => router.push(`/company/${company.id}`)}
              />
            ))}
          </Group>
        ) : (
          <InlineEmpty>검색 결과가 없습니다</InlineEmpty>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
  },
  search: {
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.searchFill,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.label,
    paddingVertical: 8,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...typography.rowTitleLg,
    color: colors.label,
  },
  sub: {
    fontSize: 13,
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flexShrink: 0,
  },
});

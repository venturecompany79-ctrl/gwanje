import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Search } from "@/ui/Icons";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { ddayLabel } from "@/lib/dates";
import { loadCompaniesPage, type CompanyListItem } from "@/lib/queries";
import { usePagedData } from "@/lib/usePagedData";
import {
  Cell,
  Chevron,
  DdayBadge,
  InlineEmpty,
  Loading,
} from "@/ui/Primitives";
import { ScreenList } from "@/ui/Screen";

const CompanyCell = memo(function CompanyCell({
  company,
  first,
  last,
  onPress,
}: {
  company: CompanyListItem;
  first?: boolean;
  last?: boolean;
  onPress: (id: string) => void;
}) {
  const sub = [company.contact_name, company.industry, company.region]
    .filter(Boolean)
    .join(" · ");
  const hasDeadline = company.nearestDaysLeft !== null && company.nearestDaysLeft !== undefined;
  return (
    <Cell
      grouped
      first={first}
      last={last}
      onPress={() => onPress(company.id)}
      accessibilityLabel={`${company.name}${sub ? `, ${sub}` : ""}, ${hasDeadline ? `가장 가까운 마감 ${ddayLabel(company.nearestDaysLeft)}` : "다가오는 마감 없음"}`}
    >
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
});

export default function CompaniesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const pageLoader = useCallback(
    (offset: number) =>
      loadCompaniesPage({
        offset,
        query: debouncedQuery || undefined,
      }),
    [debouncedQuery],
  );
  const {
    items: companies,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
  } = usePagedData(pageLoader);
  const openCompany = useCallback(
    (id: string) => router.push(`/company/${id}`),
    [router],
  );

  return (
    <ScreenList
      title="기업"
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <>
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
                returnKeyType="search"
                accessibilityLabel="기업 검색"
              />
            </View>
          </View>
          {loading ? <Loading /> : null}
          {error ? <InlineEmpty>기업을 불러오지 못했습니다</InlineEmpty> : null}
        </>
      }
      data={companies}
      keyExtractor={(company) => company.id}
      renderItem={({ item, index }) => (
        <CompanyCell
          company={item}
          first={index === 0}
          last={index === companies.length - 1}
          onPress={openCompany}
        />
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <InlineEmpty>
            {debouncedQuery ? "검색 결과가 없습니다" : "등록된 기업이 없습니다"}
          </InlineEmpty>
        ) : null
      }
      ListFooterComponent={loadingMore ? <Loading /> : null}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.35}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
  },
  search: {
    minHeight: 44,
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

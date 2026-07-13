import type { ReactNode } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "@/design/tokens";

interface ScreenChromeProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

interface ScreenProps
  extends ScreenChromeProps,
    Omit<ScrollViewProps, "refreshControl"> {
  children: ReactNode;
}

type ScreenListProps<ItemT> = ScreenChromeProps &
  Omit<
    FlatListProps<ItemT>,
    "ListHeaderComponent" | "onRefresh" | "refreshing" | "refreshControl"
  > & {
    header?: ReactNode;
  };

function ScreenHeader({
  title,
  subtitle,
  action,
}: Pick<ScreenChromeProps, "title" | "subtitle" | "action">) {
  return (
    <View style={styles.head}>
      <View style={styles.headText}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  action,
  refreshing = false,
  onRefresh,
  children,
  contentContainerStyle,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tertiaryLabel} />
        ) : undefined
      }
      contentContainerStyle={[
        { paddingTop: insets.top + 8, paddingBottom: 96 + insets.bottom },
        contentContainerStyle,
      ]}
      {...props}
    >
      <ScreenHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </ScrollView>
  );
}

/**
 * 목록 화면용 셸. 화면 제목과 부가 콘텐츠까지 FlatList 헤더에 넣어
 * 세로 ScrollView 중첩 없이 긴 목록을 가상화한다.
 */
export function ScreenList<ItemT>({
  title,
  subtitle,
  action,
  refreshing = false,
  onRefresh,
  header,
  contentContainerStyle,
  style,
  ...props
}: ScreenListProps<ItemT>) {
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      style={[styles.root, style]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tertiaryLabel}
          />
        ) : undefined
      }
      ListHeaderComponent={
        <>
          <ScreenHeader title={title} subtitle={subtitle} action={action} />
          {header}
        </>
      }
      contentContainerStyle={[
        { paddingTop: insets.top + 8, paddingBottom: 96 + insets.bottom },
        contentContainerStyle,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.grouped,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 10,
    paddingBottom: 2,
    paddingLeft: 20,
    paddingRight: 16,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.screenTitle,
    color: colors.label,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.secondaryLabel,
    marginTop: 4,
  },
  action: {
    marginTop: 2,
    flexShrink: 0,
  },
});

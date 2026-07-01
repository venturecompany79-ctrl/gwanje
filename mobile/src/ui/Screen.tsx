import type { ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/design/tokens";

interface ScreenProps extends Omit<ScrollViewProps, "refreshControl"> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
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
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 110 + insets.bottom },
        contentContainerStyle,
      ]}
      {...props}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.grouped,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.base,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.base,
    marginBottom: spacing.sm,
  },
  headText: {
    flex: 1,
  },
  title: {
    ...typography.largeTitle,
    color: colors.label,
  },
  subtitle: {
    ...typography.callout,
    color: colors.secondaryLabel,
    marginTop: 2,
  },
  action: {
    paddingBottom: 2,
  },
});

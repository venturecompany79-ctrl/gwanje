import type { ReactNode } from "react";
import {
  Platform,
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
      showsVerticalScrollIndicator={false}
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
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.base,
    marginBottom: 2,
  },
  headText: {
    flex: 1,
  },
  title: {
    ...typography.largeTitle,
    color: colors.inkDeep,
    ...Platform.select({
      web: {
        fontWeight: "800",
      },
      default: {},
    }),
  },
  subtitle: {
    ...typography.callout,
    color: colors.secondaryLabel,
    marginTop: 4,
  },
  action: {
    paddingBottom: 2,
  },
});

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
import { colors, typography } from "@/design/tokens";

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

import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import {
  AlertTriangle,
  ChevronRight,
  Circle,
  CheckCircle2,
} from "lucide-react-native";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { ddayLabel } from "@/lib/dates";

type Tone = "neutral" | "brand" | "critical" | "attention" | "success" | "purple";

export function Section({
  title,
  caption,
  children,
}: {
  title?: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <View>
      {title ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
        </View>
      ) : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function Row({
  title,
  subtitle,
  meta,
  icon,
  right,
  tone = "neutral",
  accent = false,
  dense = false,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  icon?: ReactNode;
  right?: ReactNode;
  tone?: Tone;
  accent?: boolean;
  dense?: boolean;
  onPress?: PressableProps["onPress"];
}) {
  const content = (
    <>
      {accent ? <View style={[styles.rowAccent, styles[`rowAccent_${tone}`]]} /> : null}
      {icon ? (
        <View style={[styles.rowIcon, styles[`rowIcon_${tone}`]]}>{icon}</View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.tertiaryLabel} /> : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          dense && styles.rowDense,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, dense && styles.rowDense]}>{content}</View>;
}

export function DdayPill({ daysLeft }: { daysLeft: number | null | undefined }) {
  const tone =
    daysLeft === null || daysLeft === undefined
      ? "neutral"
      : daysLeft < 0 || daysLeft <= 3
        ? "critical"
        : daysLeft <= 7
          ? "attention"
          : "neutral";
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>
        {ddayLabel(daysLeft)}
      </Text>
    </View>
  );
}

export function StagePill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.stage, active && styles.stageActive]}>
      {active ? (
        <CheckCircle2 size={14} color={colors.brand} />
      ) : (
        <Circle size={14} color={colors.tertiaryLabel} />
      )}
      <Text style={[styles.stageText, active && styles.stageTextActive]}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>
        {children}
      </Text>
    </View>
  );
}

export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: PressableProps["onPress"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filter,
        active && styles.filterActive,
        pressed && !active && styles.filterPressed,
      ]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  children,
  style,
  ...props
}: Omit<PressableProps, "style"> & {
  children: ReactNode;
  style?: PressableProps["style"];
}) {
  return (
    <Pressable
      {...props}
      style={(state) => [
        styles.button,
        state.pressed && styles.buttonPressed,
        props.disabled && styles.buttonDisabled,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={styles.emptyIcon}>
        <AlertTriangle size={compact ? 18 : 24} color={colors.tertiaryLabel} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.footnote,
    color: colors.charcoal,
    fontWeight: "700",
  },
  sectionCaption: {
    ...typography.footnote,
    color: colors.stone,
  },
  group: {
    backgroundColor: colors.secondaryGrouped,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(10,19,23,.035)",
      },
      default: {},
    }),
  },
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairlineSoft,
    position: "relative",
  },
  rowDense: {
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.surfaceSoft,
  },
  rowAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  rowAccent_neutral: {
    backgroundColor: "transparent",
  },
  rowAccent_brand: {
    backgroundColor: colors.brand,
  },
  rowAccent_critical: {
    backgroundColor: colors.critical,
  },
  rowAccent_attention: {
    backgroundColor: colors.attention,
  },
  rowAccent_success: {
    backgroundColor: colors.success,
  },
  rowAccent_purple: {
    backgroundColor: colors.purple,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIcon_neutral: {
    backgroundColor: colors.surfaceSoft,
  },
  rowIcon_brand: {
    backgroundColor: colors.brandLight,
  },
  rowIcon_critical: {
    backgroundColor: colors.criticalSoft,
  },
  rowIcon_attention: {
    backgroundColor: colors.attentionSoft,
  },
  rowIcon_success: {
    backgroundColor: colors.successSoft,
  },
  rowIcon_purple: {
    backgroundColor: colors.purpleSoft,
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.bodyStrong,
    color: colors.inkDeep,
    fontWeight: "700",
  },
  rowSub: {
    ...typography.callout,
    color: colors.charcoal,
  },
  rowMeta: {
    ...typography.footnote,
    color: colors.stone,
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 50,
    alignItems: "center",
  },
  pill_neutral: {
    backgroundColor: colors.surfaceSoft,
  },
  pill_attention: {
    backgroundColor: colors.attentionSoft,
  },
  pill_critical: {
    backgroundColor: colors.criticalSoft,
  },
  pillText: {
    ...typography.caption,
    fontWeight: "700",
  },
  pillText_neutral: {
    color: colors.secondaryLabel,
  },
  pillText_attention: {
    color: colors.attention,
  },
  pillText_critical: {
    color: colors.critical,
  },
  stage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
  stageActive: {
    backgroundColor: colors.brandLight,
    borderColor: "rgba(0, 100, 224, 0.22)",
  },
  stageText: {
    ...typography.caption,
    color: colors.secondaryLabel,
  },
  stageTextActive: {
    color: colors.brand,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge_neutral: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
  },
  badge_brand: {
    backgroundColor: colors.brandLight,
    borderColor: "rgba(0, 100, 224, 0.18)",
  },
  badge_critical: {
    backgroundColor: colors.critical,
    borderColor: colors.critical,
  },
  badge_attention: {
    backgroundColor: colors.attentionSoft,
    borderColor: colors.attentionBorder,
  },
  badge_success: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(20, 122, 73, 0.22)",
  },
  badge_purple: {
    backgroundColor: colors.purpleSoft,
    borderColor: "rgba(111, 63, 192, 0.2)",
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  badgeText_neutral: {
    color: colors.charcoal,
  },
  badgeText_brand: {
    color: colors.brand,
  },
  badgeText_critical: {
    color: colors.canvas,
  },
  badgeText_attention: {
    color: colors.attention,
  },
  badgeText_success: {
    color: colors.success,
  },
  badgeText_purple: {
    color: colors.purple,
  },
  filter: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  filterActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  filterText: {
    ...typography.footnote,
    color: colors.charcoal,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.canvas,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: "0 8px 18px rgba(0,100,224,.20)",
      },
      default: {},
    }),
  },
  buttonPressed: {
    backgroundColor: colors.brandDeep,
  },
  buttonDisabled: {
    backgroundColor: colors.stone,
  },
  buttonText: {
    ...typography.bodyStrong,
    color: colors.canvas,
  },
  empty: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyCompact: {
    minHeight: 112,
    padding: spacing.base,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    ...typography.title3,
    color: colors.inkDeep,
    textAlign: "center",
  },
  emptyDesc: {
    ...typography.callout,
    color: colors.secondaryLabel,
    textAlign: "center",
  },
  loading: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
  },
});

import type { ReactNode } from "react";
import {
  ActivityIndicator,
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
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  icon?: ReactNode;
  right?: ReactNode;
  onPress?: PressableProps["onPress"];
}) {
  const content = (
    <>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
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
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.row}>{content}</View>;
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
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.empty}>
      <AlertTriangle size={24} color={colors.tertiaryLabel} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.footnote,
    color: colors.secondaryLabel,
    textTransform: "uppercase",
  },
  sectionCaption: {
    ...typography.footnote,
    color: colors.tertiaryLabel,
  },
  group: {
    backgroundColor: colors.secondaryGrouped,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  pressed: {
    backgroundColor: colors.tertiaryGrouped,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.bodyStrong,
    color: colors.label,
  },
  rowSub: {
    ...typography.callout,
    color: colors.secondaryLabel,
  },
  rowMeta: {
    ...typography.footnote,
    color: colors.tertiaryLabel,
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pill_neutral: {
    backgroundColor: colors.fill,
  },
  pill_attention: {
    backgroundColor: colors.attentionSoft,
  },
  pill_critical: {
    backgroundColor: colors.criticalSoft,
  },
  pillText: {
    ...typography.caption,
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
    backgroundColor: colors.fill,
  },
  stageActive: {
    backgroundColor: "rgba(0, 100, 224, 0.12)",
  },
  stageText: {
    ...typography.caption,
    color: colors.secondaryLabel,
  },
  stageTextActive: {
    color: colors.brand,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    backgroundColor: colors.brandDeep,
  },
  buttonDisabled: {
    backgroundColor: colors.tertiaryLabel,
  },
  buttonText: {
    ...typography.bodyStrong,
    color: colors.canvas,
  },
  empty: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.title3,
    color: colors.label,
  },
  emptyDesc: {
    ...typography.callout,
    color: colors.secondaryLabel,
    textAlign: "center",
  },
  loading: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
});

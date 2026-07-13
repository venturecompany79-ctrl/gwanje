import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ChevronRight } from "@/ui/Icons";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { ddayLabel } from "@/lib/dates";

type Tone = "critical" | "attention" | "success" | "neutral";

/* ---------- Section label ---------- */

export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <Text style={styles.sectionLabelText}>{children}</Text>
    </View>
  );
}

/* ---------- Grouped list container ---------- */

export function Group({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{
    last?: boolean;
  }>[];
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) =>
        cloneElement(child, { key: child.key ?? i, last: i === items.length - 1 }),
      )}
    </View>
  );
}

/* ---------- List cell (row) ---------- */

export function Cell({
  children,
  onPress,
  last,
  first,
  grouped = false,
  sepInset = 16,
  style,
  align = "center",
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  disabled,
}: {
  children: ReactNode;
  onPress?: PressableProps["onPress"];
  last?: boolean;
  first?: boolean;
  grouped?: boolean;
  sepInset?: number;
  style?: StyleProp<ViewStyle>;
  align?: "center" | "flex-start";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: PressableProps["accessibilityState"];
  disabled?: boolean;
}) {
  const inner = (
    <>
      {children}
      {!last ? <View style={[styles.sep, { left: sepInset }]} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
        style={({ pressed }) => [
          styles.cell,
          grouped && styles.cellGrouped,
          grouped && first && styles.cellGroupedFirst,
          grouped && last && styles.cellGroupedLast,
          { alignItems: align },
          style,
          pressed && !disabled && styles.cellPressed,
        ]}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      style={[
        styles.cell,
        grouped && styles.cellGrouped,
        grouped && first && styles.cellGroupedFirst,
        grouped && last && styles.cellGroupedLast,
        { alignItems: align },
        style,
      ]}
    >
      {inner}
    </View>
  );
}

export function Chevron() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ChevronRight size={17} color={colors.quaternary} strokeWidth={2.1} />
    </View>
  );
}

/* ---------- D-day badge ---------- */

export function ddayTone(daysLeft: number | null | undefined): Tone {
  if (daysLeft === null || daysLeft === undefined) return "neutral";
  if (daysLeft < 0 || daysLeft <= 3) return "critical";
  if (daysLeft <= 7) return "attention";
  return "neutral";
}

export function DdayBadge({
  daysLeft,
  label,
  tone,
}: {
  daysLeft?: number | null;
  label?: string;
  tone?: Tone;
}) {
  const t = tone ?? ddayTone(daysLeft);
  const text = label ?? ddayLabel(daysLeft);
  return (
    <View style={[styles.dday, styles[`ddayBg_${t}`]]}>
      <Text style={[styles.ddayText, styles[`ddayText_${t}`]]}>{text}</Text>
    </View>
  );
}

/* ---------- Stage badge (small, inline) ---------- */

export function StageBadge({ label, done }: { label: string; done?: boolean }) {
  return (
    <View style={[styles.stage, done && styles.stageDone]}>
      <Text style={[styles.stageText, done && styles.stageTextDone]}>{label}</Text>
    </View>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Chips (horizontal scroller) ---------- */

export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScroll}
    >
      {children}
    </ScrollView>
  );
}

export function Chip({
  label,
  active,
  onPress,
  variant = "dark",
}: {
  label: string;
  active?: boolean;
  onPress?: PressableProps["onPress"];
  variant?: "dark" | "tint";
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active), disabled: !onPress }}
      disabled={!onPress}
      style={[
        styles.chip,
        variant === "tint" && styles.chipTintPad,
        active
          ? variant === "dark"
            ? styles.chipDarkActive
            : styles.chipTintActive
          : styles.chipInactive,
      ]}
    >
      <Text
        style={[
          variant === "tint" ? styles.chipTextTint : styles.chipText,
          active
            ? variant === "dark"
              ? styles.chipTextDarkActive
              : styles.chipTextTintActive
            : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- Primary button ---------- */

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
      accessibilityRole={props.accessibilityRole ?? "button"}
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(props.disabled) }}
      style={(state) => [
        styles.button,
        state.pressed && !props.disabled && styles.buttonPressed,
        props.disabled && styles.buttonDisabled,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Text style={[styles.buttonText, props.disabled && styles.buttonTextDisabled]}>
        {children}
      </Text>
    </Pressable>
  );
}

/* ---------- States ---------- */

export function EmptyText({ children }: { children: ReactNode }) {
  return (
    <View style={styles.emptyText}>
      <Text style={styles.emptyTextLabel}>{children}</Text>
    </View>
  );
}

export function InlineEmpty({ children }: { children: ReactNode }) {
  return (
    <View style={styles.inlineEmpty}>
      <Text style={styles.emptyTextLabel}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View
      style={styles.loading}
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
    >
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sectionLabelText: {
    ...typography.sectionLabel,
    color: colors.secondaryLabel,
  },
  group: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 3px rgba(10,19,23,0.04)" },
      default: {},
    }),
  },
  cell: {
    minHeight: 44,
    flexDirection: "row",
    paddingLeft: 16,
    paddingRight: 15,
    paddingVertical: 12,
    gap: 12,
    position: "relative",
  },
  cellGrouped: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.card,
  },
  cellGroupedFirst: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: "hidden",
  },
  cellGroupedLast: {
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    overflow: "hidden",
  },
  cellPressed: {
    backgroundColor: "rgba(60,60,67,0.06)",
  },
  sep: {
    position: "absolute",
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  dday: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  ddayBg_critical: { backgroundColor: colors.criticalTint },
  ddayBg_attention: { backgroundColor: colors.attentionTint },
  ddayBg_success: { backgroundColor: colors.successTint },
  ddayBg_neutral: { backgroundColor: colors.fill },
  ddayText: { ...typography.badge },
  ddayText_critical: { color: colors.critical },
  ddayText_attention: { color: colors.attention },
  ddayText_success: { color: colors.success },
  ddayText_neutral: { color: colors.secondaryLabel },
  stage: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radius.xs,
    backgroundColor: colors.fill,
    alignSelf: "flex-start",
  },
  stageDone: {
    backgroundColor: colors.successTint,
  },
  stageText: {
    ...typography.smallBadge,
    color: colors.subText,
  },
  stageTextDone: {
    color: colors.success,
  },
  segment: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    backgroundColor: colors.segmentTrack,
    borderRadius: radius.chip,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 7,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: colors.canvas,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(0,0,0,0.13)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.13,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
    }),
  },
  segmentText: {
    fontSize: 13.5,
    letterSpacing: -0.2,
    fontWeight: "500",
    color: colors.subText,
  },
  segmentTextActive: {
    color: colors.label,
    fontWeight: "600",
  },
  chipScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.chip,
    justifyContent: "center",
  },
  chipTintPad: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipInactive: {
    backgroundColor: colors.fill,
  },
  chipDarkActive: {
    backgroundColor: colors.label,
  },
  chipTintActive: {
    backgroundColor: colors.brandTintStrong,
  },
  chipText: {
    fontSize: 13.5,
    letterSpacing: -0.2,
    fontWeight: "500",
    color: colors.chipText,
  },
  chipTextTint: {
    fontSize: 13,
    letterSpacing: -0.2,
    fontWeight: "500",
    color: colors.subText,
  },
  chipTextDarkActive: {
    color: colors.canvas,
    fontWeight: "600",
  },
  chipTextTintActive: {
    color: colors.brand,
    fontWeight: "600",
  },
  button: {
    width: "100%",
    minHeight: 52,
    borderRadius: radius.card,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    backgroundColor: colors.brandDeep,
  },
  buttonDisabled: {
    backgroundColor: colors.fillStrong,
  },
  buttonText: {
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.canvas,
  },
  buttonTextDisabled: {
    color: colors.tertiaryLabel,
  },
  emptyText: {
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  inlineEmpty: {
    paddingVertical: 22,
    paddingHorizontal: spacing.base,
    alignItems: "center",
  },
  emptyTextLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  loading: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

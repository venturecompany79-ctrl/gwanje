/**
 * Minimal Lucide-compatible icon set used by the mobile app.
 *
 * Icon paths are derived from lucide-react-native v1.22.0 (ISC). Keeping the
 * small set local prevents Metro from bundling the package's full icon barrel.
 * See THIRD_PARTY_NOTICES.md for the required license notices.
 */
import type { ReactNode } from "react";
import { Circle, Path, Rect, Svg, type SvgProps } from "react-native-svg";

export type IconProps = SvgProps & {
  size?: number;
  absoluteStrokeWidth?: boolean;
};

function Icon({
  children,
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  absoluteStrokeWidth = false,
  ...props
}: IconProps & { children: ReactNode }) {
  const resolvedStrokeWidth = absoluteStrokeWidth
    ? (Number(strokeWidth) * 24) / size
    : strokeWidth;

  return (
    <Svg
      {...props}
      accessible={false}
      focusable={false}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={resolvedStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function Bell(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <Path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </Icon>
  );
}

export function Building2(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M10 12h4" />
      <Path d="M10 8h4" />
      <Path d="M14 21v-3a2 2 0 0 0-4 0v3" />
      <Path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
      <Path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    </Icon>
  );
}

export function CalendarDays(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18" />
      <Path d="M8 14h.01" />
      <Path d="M12 14h.01" />
      <Path d="M16 14h.01" />
      <Path d="M8 18h.01" />
      <Path d="M12 18h.01" />
      <Path d="M16 18h.01" />
    </Icon>
  );
}

export function ClipboardList(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M12 11h4" />
      <Path d="M12 16h4" />
      <Path d="M8 11h.01" />
      <Path d="M8 16h.01" />
    </Icon>
  );
}

export function Home(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <Path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

export function Lock(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  );
}

export function Mail(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <Rect x="2" y="4" width="20" height="16" rx="2" />
    </Icon>
  );
}

export function Check(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function X(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Icon>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function Search(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m21 21-4.34-4.34" />
      <Circle cx="11" cy="11" r="8" />
    </Icon>
  );
}

export function Plus(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </Icon>
  );
}

export function Trash2(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <Path d="M3 6h18" />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
  );
}

export function Phone(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </Icon>
  );
}

export function ShieldCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <Path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

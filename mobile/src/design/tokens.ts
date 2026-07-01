import { Platform } from "react-native";

export const colors = {
  brand: "#0064E0",
  brandDeep: "#0457CB",
  canvas: "#FFFFFF",
  grouped: "#F2F2F7",
  secondaryGrouped: "#FFFFFF",
  tertiaryGrouped: "#F7F7FA",
  label: "#111827",
  secondaryLabel: "#667085",
  tertiaryLabel: "#98A2B3",
  separator: "rgba(60, 60, 67, 0.18)",
  fill: "rgba(120, 120, 128, 0.12)",
  critical: "#E41E3F",
  criticalSoft: "#FBE1E5",
  attention: "#B9760A",
  attentionSoft: "#FDEED6",
  success: "#147A49",
  successSoft: "#E2F0E6",
  ink: "#0A1317",
} as const;

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

export const typography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
    letterSpacing: Platform.OS === "ios" ? 0.2 : 0,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
  },
  title3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700" as const,
  },
  callout: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
} as const;

export const colors = {
  brand: "#0064E0",
  brandDeep: "#0457CB",
  brandLight: "#E2EEFC",
  canvas: "#FFFFFF",
  grouped: "#E7EBEF",
  secondaryGrouped: "#FFFFFF",
  tertiaryGrouped: "#F1F4F7",
  surfaceSoft: "#F1F4F7",
  surfaceMuted: "#EEF2F6",
  label: "#0A1317",
  ink: "#0A1317",
  inkDeep: "#071115",
  charcoal: "#31414F",
  secondaryLabel: "#5F6F80",
  tertiaryLabel: "#8595A4",
  stone: "#8595A4",
  separator: "#DEE3E9",
  hairline: "#D3DAE3",
  hairlineSoft: "#E6EAF0",
  fill: "#F1F4F7",
  critical: "#E41E3F",
  criticalSoft: "#FBE1E5",
  criticalBorder: "#F3C4CB",
  attention: "#B9760A",
  attentionSoft: "#FDEED6",
  attentionBorder: "#F6D9B0",
  success: "#147A49",
  successSoft: "#E2F0E6",
  purple: "#6F3FC0",
  purpleSoft: "#EFE8FA",
  stage: "#E7EBEF",
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
    letterSpacing: 0,
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

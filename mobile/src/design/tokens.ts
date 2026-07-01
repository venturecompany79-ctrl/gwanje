// iOS Native Calm Ops — design tokens
// Authority: Gwanje Mobile.dc.html (Claude Design project)
// Quiet grouped background, thin separators, restrained status colors.

export const colors = {
  // brand
  brand: "#0064E0",
  brandDeep: "#0457CB",
  brandTint: "rgba(0,100,224,0.10)",
  brandTintStrong: "rgba(0,100,224,0.11)",

  // surfaces
  canvas: "#FFFFFF",
  card: "#FFFFFF",
  grouped: "#F2F2F7",
  stage: "#E5E7EB", // outer background behind the app frame (web)

  // text
  label: "#1C1C1E",
  ink: "#1C1C1E",
  inkDeep: "#1C1C1E",
  secondaryLabel: "#8A8A8E",
  tertiaryLabel: "#B0B0B5",
  quaternary: "#C7C7CC",
  muted: "#98A2B3",
  subText: "#6B7280",
  chipText: "#4B4B50",
  // legacy aliases (kept so stray references still resolve)
  charcoal: "#4B4B50",
  stone: "#8A8A8E",

  // lines
  separator: "rgba(60,60,67,0.11)",
  separatorStrong: "rgba(60,60,67,0.14)",
  hairline: "rgba(60,60,67,0.12)",
  hairlineSoft: "rgba(60,60,67,0.11)",

  // fills
  fill: "rgba(120,120,128,0.12)",
  fillStrong: "rgba(118,118,128,0.14)",
  searchFill: "rgba(118,118,128,0.11)",
  segmentTrack: "rgba(118,118,128,0.10)",

  // status
  critical: "#E4243B",
  criticalTint: "rgba(228,36,59,0.10)",
  attention: "#B9760A",
  attentionTint: "rgba(185,118,10,0.12)",
  success: "#147A49",
  successTint: "rgba(20,122,73,0.10)",

  // tab bar
  tabInactive: "#B0B0B5",
  tabBar: "rgba(249,249,251,0.82)",
  navBar: "rgba(242,242,247,0.80)",
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  xs: 6,
  sm: 7, // d-day / status badge
  chip: 9, // filter chips
  md: 10, // search bar
  card: 14, // grouped list containers
  lg: 16,
  sheet: 22, // bottom sheets, floating surfaces
  full: 999,
  circle: 999,
} as const;

export const typography = {
  screenTitle: {
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  detailTitle: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  rowTitle: {
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  rowTitleLg: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  rowBody: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: -0.3,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  kpi: {
    fontSize: 27,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  badge: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  smallBadge: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  time: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "500",
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    letterSpacing: -0.3,
  },
  // legacy aliases still referenced by a few spots
  callout: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  caption: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
} as const;

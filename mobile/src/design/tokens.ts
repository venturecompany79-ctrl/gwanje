import type { TextStyle } from "react-native";

// Mission Control DS · Light — design tokens
// 톤앤무드: SpaceX(밝은 면 · austerity) × x.ai(구조 · pill · hairline 규율)
// 웹(app/globals.css)은 같은 시스템의 다크 반전판이다 — 여기는 밝은 지면 위 순검정 글씨.
// 권위: /CLAUDE.md §5-1 (+ 톤앤무드 원본은 /docs/design.md)
//
// ★ SpaceX 시그니처인 "대문자 트래킹 마이크로캡션"은 한글에 uppercase 가 없어
//   그대로 옮길 수 없다 → 양수 letterSpacing + 작은 크기 + 두꺼운 굵기로 치환한다.

export const colors = {
  // brand — SpaceX 는 밝은 면에서도 액센트를 쓰지 않는다. 1차 액션은 순검정.
  brand: "#000000",
  brandDeep: "#1C1C20",
  brandTint: "rgba(10,10,15,0.06)",
  brandTintStrong: "rgba(10,10,15,0.08)",

  // surfaces — spacex canvas-light / canvas-cool
  canvas: "#FFFFFF",
  card: "#FFFFFF",
  grouped: "#F0F0FA",
  stage: "#E0E0E8", // outer background behind the app frame (web)

  // text — 순검정 본문. 아래로 갈수록 대비가 낮아지는 단일 램프.
  label: "#000000",
  ink: "#000000",
  inkDeep: "#000000",
  secondaryLabel: "#5A5A5F", // spacex ink-mute
  tertiaryLabel: "#747480",
  quaternary: "#93939D",
  muted: "#8A8A92",
  subText: "#5A5A5F",
  chipText: "#3A3A40",
  // legacy aliases (kept so stray references still resolve)
  charcoal: "#3A3A40",
  stone: "#8A8A92",

  // lines — spacex hairline-on-light
  separator: "rgba(10,10,15,0.10)",
  separatorStrong: "rgba(10,10,15,0.14)",
  hairline: "#E0E0E8",
  hairlineSoft: "#ECECF2",

  // fills — 무채색 wash (액센트 틴트 금지)
  fill: "rgba(10,10,15,0.05)",
  fillStrong: "rgba(10,10,15,0.07)",
  searchFill: "rgba(10,10,15,0.05)",
  segmentTrack: "rgba(10,10,15,0.05)",

  // status — 제품 핵심 시맨틱.
  // 배지는 "같은 색 틴트 배경 + 같은 색 글자" 구조라 대비가 구조적으로 눌린다.
  // grouped(#F0F0FA) 위 최악 케이스에서 AA(4.5:1)를 넘도록 딥하게 잡았다.
  // 틴트는 base 에서 파생되므로 둘을 함께 바꿀 것.
  critical: "#BE0F2A",
  criticalTint: "rgba(190,15,42,0.10)",
  attention: "#8A5400",
  attentionTint: "rgba(138,84,0,0.11)",
  success: "#116B40",
  successTint: "rgba(17,107,64,0.10)",

  // tab bar
  tabInactive: "#747480",
  tabBar: "rgba(255,255,255,0.86)",
  navBar: "rgba(240,240,250,0.84)",
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
  // SpaceX austerity — 커머스풍 둥근 카드를 걷어내고 각지게. 버튼만 pill.
  xs: 4,
  sm: 4, // d-day / status badge
  chip: 6, // filter chips
  md: 8, // search bar
  card: 10, // grouped list containers
  lg: 12,
  sheet: 16, // bottom sheets, floating surfaces
  full: 999, // ★ 버튼은 항상 pill
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.6,
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
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
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
    letterSpacing: -0.6,
  },
  badge: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
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
    letterSpacing: 0.2,
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

/** 자릿수 고정 — D-day·KPI 처럼 세로로 훑는 수치에만. (SpaceX/x.ai 의 mono 캡션 역할) */
export const tabularNums: TextStyle = { fontVariant: ["tabular-nums"] };

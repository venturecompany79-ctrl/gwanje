---
version: alpha
name: Mission-Control-design-analysis
source: x.ai (구조·색) × spacex (타이포·톤) — voltagent/awesome-design-md
description: >-
  「관제」의 디자인 시스템. x.ai의 엄격한 근-검정 캔버스와 흰색 pill 아웃라인을 구조로,
  SpaceX의 미션 컨트롤 특유의 절제 — 대문자 트래킹 마이크로 캡션, 극도로 축소된 카드 라운딩,
  사진/데이터가 곧 UI가 되는 austerity — 를 톤으로 얹었다. 액센트는 흰색이 1차이며
  채도는 상태(status)에만 허용한다. 라이트 테마 없음. 단일 다크.
---

colors:
  # 1차 액션 — x.ai button-primary: 흰색 채움 + 근-검정 텍스트
  primary: "#ffffff"
  primary-deep: "#dadbdf"      # hover
  primary-soft: "#a0c3ec"      # x.ai accent-breeze — 보조 정보 액센트
  on-primary: "#0a0a0a"
  # 마케팅(랜딩) 1차 CTA — x.ai accent-sunset
  ink-button: "#ff7a17"
  on-ink-button: "#0a0a0a"
  # 폼 활성 (라디오·체크·인풋 포커스) — x.ai는 흰색 아웃라인으로 처리
  fb-blue: "#ffffff"
  meta-link: "#a0c3ec"
  oculus-purple: "#7c3aed"     # x.ai accent-dusk
  # 시맨틱 — 두 브랜드 모두 상태색이 없어 다크 캔버스 기준으로 직접 파생
  success: "#35d07f"
  attention: "#ffb224"
  warning: "#ffc94d"
  critical: "#ff4d63"
  critical-strong: "#ff6076"
  # 표면 — x.ai
  canvas: "#191919"            # 패널·카드 (x.ai canvas-card)
  surface-soft: "#0a0a0a"      # body·함몰 영역 (x.ai canvas)
  # 텍스트 램프 — 위에서 아래로 대비 감소
  ink-deep: "#ffffff"
  ink: "#fafaf7"
  charcoal: "#dadbdf"
  slate: "#b9bcc2"
  steel: "#9aa0a6"
  stone: "#858a92"
  disabled-text: "#5f636a"
  # 라인
  hairline: "#2c2f34"
  hairline-soft: "#212327"     # x.ai hairline

rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 10px       # 일반 피처 카드 (Meta 16px → SpaceX 수준으로 축소)
  xxl: 12px
  xxxl: 14px     # 큰 카드 (Meta 32px → 축소)
  feature: 16px
  full: 100px    # ★ 버튼 — x.ai·spacex 모두 pill 유지
  circle: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 10px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section-sm: 48px
  section: 64px
  section-lg: 80px
  hero: 120px

typography:
  # spacex D-DIN / x.ai Universal Sans·Geist Mono 모두 비공개 폰트 → 폴백 고정.
  # 한국어 앱이므로 Noto Sans KR 필수.
  font-body: "Inter, Noto Sans KR, Apple SD Gothic Neo, Helvetica Neue, Arial, sans-serif"
  font-mono: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Roboto Mono, monospace"
  micro-cap:   # spacex 시그니처 — eyebrow·마이크로 캡션은 대문자 트래킹 mono
    fontFamily: "{typography.font-mono}"
    fontSize: 12px
    letterSpacing: 1.2px
    textTransform: uppercase

elevation:
  # 다크 캔버스에서 회색 그림자는 보이지 않는다 → 순검정 + hairline 분리가 기본
  flat: "1px solid {colors.hairline-soft}"
  sticky: "rgba(0,0,0,.6) 0 2px 12px"

components:
  button-primary:      # 앱 내부 1차 — 흰색 pill
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  button-marketing:    # 랜딩 1차 — sunset pill
    backgroundColor: "{colors.ink-button}"
    textColor: "{colors.on-ink-button}"
    rounded: "{rounded.full}"
  button-ghost:        # x.ai·spacex 시그니처 — 채움 없는 흰색 아웃라인 pill
    backgroundColor: transparent
    textColor: "{colors.ink-deep}"
    borderColor: "rgba(255,255,255,.18)"
    rounded: "{rounded.full}"
  badge-status:        # 밝은 채움 + 근-검정 전경 (다크에서 흰 전경은 대비 미달)
    backgroundColor: "{colors.critical} | {colors.attention} | {colors.success}"
    textColor: "{colors.on-primary}"
  card:
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline-soft}"
    rounded: "{rounded.xl}"

notes:
  - 액센트 추가 금지. 채도는 status(success/attention/warning/critical) + sunset(마케팅) + breeze/dusk(보조)로 한정.
  - 상태 매핑은 불변: 자격 유효=success · 임박=warning|attention · 만료=critical.
  - 카테고리 색(category.color)은 사용자 데이터이지 토큰이 아니다. 팔레트는 lib/categoryColors.ts.
  - 다크 단일 테마. 라이트 토큰 없음.

# 관제 모바일 리디자인 브리프

작성일: 2026-07-01
대상: `mobile/` React Native + Expo 모바일 앱
현재 배포 확인 URL: `https://gwanje-mobile.vercel.app`
목표 도메인: `https://mobile.gwanje.com`

## 1. 리디자인 목적

관제 모바일은 기존 웹 서비스를 그대로 축소한 앱이 아니라, 컨설턴트가 이동 중에 운영 상황을 빠르게 확인하고 가벼운 처리를 하는 모바일 운영 보조 앱이다.

이번 리디자인의 목표는 다음이다.

- 현재 구현된 기능과 정보 구조는 유지한다.
- 전체 톤을 더 완성도 높은 iPhone 앱처럼 다듬는다.
- 관리형 SaaS 특유의 조용하고 밀도 있는 정보 구조를 살린다.
- 카드와 pill이 반복되어 보이는 느낌을 줄이고, 리스트 기반의 스캔성을 높인다.
- 모바일 웹에서도 앱처럼 보이게 한다. 데스크톱 브라우저에서는 모바일 폭으로 중앙 정렬되는 프리뷰 경험도 고려한다.
- 기능 설명용 문구가 아니라, 실제 업무 처리 화면처럼 보이게 한다.

핵심 방향:

```text
iOS Native Calm Ops
```

조용한 회색 grouped background, 명확한 hierarchy, 얇은 separator, 큰 타이틀, bottom tab, sheet, 리스트 중심 UI, 중요한 D-day만 색으로 강조하는 방향이다.

## 2. 제품 포지션

관제 모바일 앱은 컨설턴트용 모바일 운영 보조 앱이다.

주요 사용자는 다음 상황에서 앱을 연다.

- 오늘 마감이 있나 빠르게 확인한다.
- 알림을 읽고 급한 것만 처리한다.
- 오늘 업무 메모를 남긴다.
- Task의 단계나 메모를 현장에서 수정한다.
- 기업 담당자 연락처와 요약 정보를 확인한다.

리디자인 시 피해야 할 방향:

- 마케팅 랜딩 페이지처럼 보이는 구성
- 큰 히어로 카드, 장식용 그래픽, 과한 gradient
- 대시보드 위젯을 과도하게 카드화하는 방식
- 색이 많은 CRM 스타일
- 웹 테이블을 모바일에 억지로 넣는 방식

## 3. 현재 구현 요약

### 기술 구조

- App: React Native + Expo Router + TypeScript
- Mobile path: `mobile/`
- Auth: Supabase Auth
- Read: Supabase direct query
- Write: Next.js mobile API
- Mobile web deploy: Vercel static Expo Web export
- Web/API origin: 현재 `https://gwanje.vercel.app`

주요 파일:

- Layout: `mobile/app/_layout.tsx`
- Tabs: `mobile/app/(tabs)/_layout.tsx`
- Design tokens: `mobile/src/design/tokens.ts`
- Screen shell: `mobile/src/ui/Screen.tsx`
- Common primitives: `mobile/src/ui/Primitives.tsx`
- Login: `mobile/app/(auth)/login.tsx`
- Home: `mobile/app/(tabs)/index.tsx`
- Notifications: `mobile/app/(tabs)/notifications.tsx`
- Today: `mobile/app/(tabs)/today.tsx`
- Tasks: `mobile/app/(tabs)/tasks.tsx`
- Task edit sheet: `mobile/app/task/[id].tsx`
- Companies: `mobile/app/(tabs)/companies.tsx`
- Company detail: `mobile/app/company/[id].tsx`

### 현재 탭 구조

탭은 5개로 고정한다.

```text
홈 / 알림 / 오늘 / Task / 기업
```

각 탭의 현재 역할:

| 탭 | 역할 |
|---|---|
| 홈 | KPI, 기한 지남, 다가오는 마감, 빠른 이동 |
| 알림 | 알림 목록, 필터, 단건 읽음, 전체 읽음 |
| 오늘 | 업무일지 노트 작성, 태그 선택, 완료 체크 |
| Task | 과제 목록, 단계 필터, Task 수정 sheet 진입 |
| 기업 | 검색, 기업 목록, 기업 상세 진입 |

## 4. 현재 디자인 토큰

현재 토큰은 `mobile/src/design/tokens.ts` 기준이다.

### 색상

| Token | Value | 용도 |
|---|---:|---|
| `brand` | `#0064E0` | 주요 액션, 선택 상태 |
| `brandDeep` | `#0457CB` | 버튼 pressed |
| `canvas` | `#FFFFFF` | 카드, 리스트 그룹 |
| `grouped` | `#F2F2F7` | 화면 배경 |
| `secondaryGrouped` | `#FFFFFF` | grouped list |
| `tertiaryGrouped` | `#F7F7FA` | 입력/pressed 배경 |
| `label` | `#111827` | 주요 텍스트 |
| `secondaryLabel` | `#667085` | 보조 텍스트 |
| `tertiaryLabel` | `#98A2B3` | 약한 텍스트, 비활성 아이콘 |
| `separator` | `rgba(60, 60, 67, 0.18)` | iOS식 hairline |
| `fill` | `rgba(120, 120, 128, 0.12)` | icon background, disabled surface |
| `critical` | `#E41E3F` | 지연, 긴급 |
| `attention` | `#B9760A` | 주의 |
| `success` | `#147A49` | 완료 |
| `ink` | `#0A1317` | 강한 선택 배경 |

리디자인 시 유지할 원칙:

- `#0064E0`은 주요 액션과 선택 상태에만 사용한다.
- critical, attention, success는 상태 표시용으로만 사용한다.
- 배경은 `#F2F2F7` 계열을 유지하되, 표면의 단계 차이를 더 섬세하게 조정해도 된다.

### 타이포그래피

현재 타입 스케일:

| Token | Size / Line | Weight |
|---|---:|---:|
| `largeTitle` | 34 / 41 | 700 |
| `title2` | 22 / 28 | 700 |
| `title3` | 18 / 24 | 700 |
| `body` | 16 / 22 | 400 |
| `bodyStrong` | 16 / 22 | 700 |
| `callout` | 15 / 20 | 500 |
| `footnote` | 13 / 18 | 500 |
| `caption` | 12 / 16 | 600 |

리디자인 시 보완:

- 탭 화면 최상단은 iOS large title을 유지한다.
- 리스트 내부 제목은 너무 굵게 보이지 않도록 600 또는 650 수준의 시각적 무게를 권장한다.
- section heading은 uppercase보다 자연스러운 한국어 섹션 레이블이 더 적합할 수 있다.
- 숫자 KPI는 크기를 유지하되, 설명 label과 관계가 더 분명해야 한다.

### 간격과 반경

현재 spacing:

```text
xs 6 / sm 8 / md 12 / base 16 / lg 20 / xl 24 / xxl 32
```

현재 radius:

```text
sm 8 / md 12 / lg 16 / xl 22 / full 999
```

리디자인 시 보완:

- 운영 도구 특성상 카드 반경은 12-16 중심으로 낮춘다.
- sheet와 floating surface만 22 이상을 허용한다.
- 리스트 row는 더 정돈된 좌우 padding과 separator rhythm이 필요하다.
- 버튼과 pill의 과도한 pill 반복은 줄인다.

## 5. 핵심 리디자인 문제

현재 구현은 기능 구조가 명확하지만, 시각적으로는 MVP 느낌이 남아 있다.

우선 개선할 문제:

1. 화면별 정보 위계가 비슷하게 느껴진다.
2. Row, pill, card가 반복되어 스캔 포인트가 단조롭다.
3. 필터 pill의 선택 상태가 강하지만, 업무 앱보다는 프로토타입처럼 보인다.
4. 홈 KPI가 카드 4개로 보이지만 우선순위가 약하다.
5. Task 수정 sheet는 기능은 충분하지만 iOS sheet polish가 더 필요하다.
6. empty/error/loading 상태가 화면 중앙을 크게 차지해 실제 운영 화면의 밀도를 깨뜨린다.
7. 모바일 웹에서 desktop viewport로 보면 앱 전용 제품처럼 보이지 않을 수 있다.

## 6. 리디자인 원칙

### 원칙 1. 리스트가 기본이다

관제 모바일은 확인과 처리 중심 앱이다. 카드형 대시보드보다 grouped list와 compact row가 기본이어야 한다.

권장:

- 홈의 KPI는 카드보다 summary strip 또는 priority cluster로 재구성한다.
- 알림, Task, 기업은 grouped list를 유지하되 row hierarchy를 개선한다.
- D-day, stage, unread 같은 상태만 오른쪽 보조 영역에 둔다.

### 원칙 2. 색은 이벤트에만 쓴다

일반 상태는 회색과 검정 텍스트로 처리하고, 색상은 사용자의 주의를 끌어야 하는 정보에만 사용한다.

색 사용 기준:

| 색 | 사용 |
|---|---|
| Blue | 선택, 저장, 주요 액션 |
| Red | 지연, D-0, D-3 이하, urgent |
| Amber | D-7 이하 |
| Green | 완료, 성공 |
| Gray | 일반 상태, 비활성, 보조 정보 |

### 원칙 3. 탭바와 navigation만 blur를 쓴다

Liquid Glass 또는 blur는 navigation layer에만 제한한다.

허용:

- bottom tab
- modal/sheet header
- sticky navigation

비허용:

- content card
- KPI card
- table/list body
- empty state box

### 원칙 4. 모바일 웹도 앱처럼 보이게 한다

`mobile.gwanje.com`은 데스크톱에서도 열릴 수 있다. 데스크톱 viewport에서는 앱 화면이 너무 넓어지지 않아야 한다.

권장:

- Web에서 root max width를 430-480px로 제한
- 중앙 정렬
- 배경은 바깥 영역 `#E5E7EB` 또는 `#F2F2F7`
- 앱 내부는 safe area와 bottom tab을 유지

### 원칙 5. 업무 속도를 방해하지 않는다

리디자인은 예뻐지는 작업이 아니라 더 빨리 판단하게 만드는 작업이다.

각 화면은 다음 질문에 3초 안에 답해야 한다.

| 화면 | 사용자의 즉시 질문 |
|---|---|
| 로그인 | 기존 계정으로 안전하게 들어갈 수 있나? |
| 홈 | 지금 급한 일이 있나? |
| 알림 | 읽지 않은 것 중 중요한 게 있나? |
| 오늘 | 오늘 내가 처리할 일은 무엇인가? |
| Task | 어떤 단계의 과제가 밀려 있나? |
| 기업 | 이 회사 담당자와 가까운 마감은 무엇인가? |

## 7. 화면별 리디자인 요구사항

### 7.1 로그인

현재:

- 중앙 정렬 카드 없이 브랜드와 입력 필드가 세로 배치됨
- `관` 마크와 앱 설명 표시
- 이메일/비밀번호 로그인
- 회원가입과 결제 관리는 웹에서 진행한다는 안내 표시
- 인증 전에는 `(auth)/login` 화면을 보여주고, 인증 후 5탭 앱으로 진입

리디자인 방향:

- iOS 앱 onboarding 느낌의 단정한 로그인으로 다듬는다.
- 브랜드 영역은 너무 큰 로고 카드보다 텍스트 중심으로 차분하게 둔다.
- 입력 필드는 iOS Settings/Form처럼 얇은 border와 충분한 높이를 유지한다.
- 로그인 버튼은 full-width primary action.
- 도움말 문구는 더 작고 조용하게.
- 배경은 `grouped` 계열을 유지하되, 로그인 form은 너무 카드처럼 떠 보이지 않게 한다.
- 첫 화면에서 “모바일 운영 보조 앱”이라는 성격은 드러내되, 마케팅 카피처럼 길어지지 않게 한다.
- 비밀번호 입력에는 보기/숨기기 토글을 추가하는 것을 권장한다.
- 모바일 웹에서도 iPhone 앱 로그인처럼 보이도록 desktop viewport에서는 390-430px 폭으로 중앙 정렬한다.

권장 구조:

```text
Status-safe top space
Brand mark: 관제
Subtitle: 컨설턴트 모바일 운영

Email input
Password input + show/hide
Primary CTA: 로그인

Error / env notice
Footnote: 회원가입과 결제 관리는 웹에서 진행합니다
```

필수 상태:

- 기본
- 입력 중
- 비밀번호 숨김/표시 가능 여부 검토
- 로그인 중
- 로그인 실패
- env 미설정 notice
- 세션 만료 후 재로그인
- 키보드 open 상태
- desktop browser preview 상태

금지:

- 큰 hero 이미지나 마케팅 일러스트
- 과한 로고 카드
- 회원가입 CTA 강조
- 소셜 로그인 버튼 추가
- 앱 기능을 설명하는 긴 문단

### 7.2 홈

현재:

- 4개 KPI 카드
- 기한 지남 section
- 다가오는 마감 section
- 빠른 이동 row

리디자인 방향:

- 홈은 “오늘의 관제 요약”이어야 한다.
- 4개 KPI 카드를 그대로 나열하기보다 urgent summary를 먼저 보여준다.
- 기한 지남이 있으면 최상단에서 강하게 드러나야 한다.
- 다가오는 마감은 날짜순 grouped list.
- 빠른 이동은 과한 별도 카드보다 compact action row 또는 secondary section으로 처리.

권장 구조:

```text
Large Title: 관제
Subtitle: 2026-07-01 · 모바일 운영

Priority Summary
- 기한 지남 N
- 7일 내 마감 N
- 진행 Task N

긴급/기한 지남
다가오는 마감
빠른 이동
```

개선 포인트:

- KPI 숫자와 label의 관계를 더 분명하게 한다.
- critical 정보는 배경 전체를 빨갛게 하지 말고, 왼쪽 accent나 D-day badge로 충분히 강조한다.
- 마감 row에는 회사명, 항목명, due date, D-day가 명확히 보여야 한다.

### 7.3 알림

현재:

- `전체 / 만료 / 마감 / 매칭` pill filter
- 전체 읽음 icon
- 최근 알림 grouped list
- unread dot

리디자인 방향:

- iOS Mail/Reminders 느낌의 읽음/안읽음 hierarchy.
- 필터는 pill보다 segmented control 또는 compact chip row로 정리한다.
- unread dot은 row 왼쪽 또는 제목 옆에 작게 붙여 스캔성을 높인다.
- urgent 알림은 icon 색상만으로 부족하므로 label 또는 left accent를 검토한다.

필수 상태:

- 전체
- 필터 선택
- unread 있음
- unread 없음
- 전체 읽음 disabled
- 빈 목록
- 네트워크 오류

### 7.4 오늘

현재:

- 새 노트 composer
- 태그 pill
- 추가 버튼
- 오늘의 노트 list
- 완료 toggle

리디자인 방향:

- “빠른 업무 메모” 느낌이 더 강해야 한다.
- composer는 독립 카드처럼 보이되, 카드 남발이 되지 않게 compact하게 만든다.
- 태그 선택은 segmented chip이 적합하다.
- 추가 버튼은 draft가 있을 때만 강하게 보인다.
- 완료된 노트는 체크 아이콘, text opacity, optional strikethrough 중 하나로 명확히 표시한다.

권장 구조:

```text
Large Title: 오늘
Subtitle: 2026-07-01 · 업무일지

Quick Composer
Tag Segments
Add CTA

오늘의 노트
```

### 7.5 Task 목록

현재:

- 단계 필터
- Task row
- Stage pill
- row press 시 edit modal

리디자인 방향:

- Task는 가장 업무적인 화면이므로 조용하고 밀도 있게 만든다.
- 단계 필터는 horizontal scroll segmented control 권장.
- row에서 회사명, 제목, 기한, 단계가 한눈에 구분되어야 한다.
- Stage는 pill보다 작은 status label 또는 badge로 충분할 수 있다.
- D-day가 급한 task는 오른쪽에 우선 표시한다.

필수 상태:

- 전체
- 단계 필터
- 긴급 task
- 완료 stage
- 빈 필터 결과
- refresh

### 7.6 Task 수정 sheet

현재:

- 하단 sheet
- grabber
- close button
- 회사명, 제목, meta
- 단계 선택
- memo input
- 저장 버튼

리디자인 방향:

- iOS bottom sheet polish를 가장 우선한다.
- sheet 상단의 grabber, close, title hierarchy를 정교하게 다듬는다.
- 단계 변경은 현재 stage가 명확하고 터치 target이 충분해야 한다.
- memo는 큰 회색 입력 영역이지만, 실제 업무 메모처럼 읽기/쓰기 편해야 한다.
- 저장 버튼은 keyboard와 safe area에 가리지 않아야 한다.

권장 구조:

```text
Grabber
Header: Task 수정 / Close
Company + Task Title
Due Date + D-day + Category
Stage Picker
Memo
Sticky Save Button
```

필수 상태:

- 로딩
- 저장 중
- 저장 성공 후 dismiss
- 저장 실패
- keyboard open
- 긴 제목

### 7.7 기업 목록

현재:

- 검색 field
- 기업 list
- 회사명, 업종/지역/담당자
- 가장 가까운 일정
- D-day pill

리디자인 방향:

- 기업 목록은 연락처/마감 확인에 최적화한다.
- 검색 필드는 iOS search bar에 더 가깝게 다듬는다.
- row subtitle은 너무 많은 정보를 한 줄에 넣지 말고, 담당자/업종/지역을 우선순위화한다.
- 가까운 마감이 없을 때는 오른쪽 badge를 약하게 숨기거나 neutral 처리한다.

### 7.8 기업 상세

현재:

- 뒤로가기 action
- 담당자
- 다가오는 일정
- 자격/인증
- Task

리디자인 방향:

- 상단에는 회사명과 연락 액션이 명확해야 한다.
- 전화/메일은 row 안에 숨기기보다 action button으로 빠르게 접근할 수 있게 검토한다.
- 상세 화면은 section이 많으므로 section 간 rhythm이 중요하다.
- 일정, 자격, Task는 모두 row 패턴을 공유하되 각 정보의 핵심 field가 다르게 보여야 한다.

권장 상단:

```text
Back
Company Name
Industry · Region
Quick Actions: Call / Mail
```

## 8. 컴포넌트 리디자인 범위

### Screen

현재 `Screen`은 ScrollView + title/subtitle/action + pull refresh를 제공한다.

리디자인 요구:

- large title 유지
- action button 위치와 크기 재정리
- web max-width 대응
- bottom tab padding 안정화
- content gap 재조정

### Section

현재 `Section`은 heading + white group container로 구성된다.

리디자인 요구:

- section heading의 uppercase 제거 검토
- iOS grouped list처럼 section title은 더 작고 자연스럽게
- group border/radius/separator 정리
- nested card 느낌 방지

### Row

현재 `Row`는 icon, text, right, chevron을 받는다.

리디자인 요구:

- title/subtitle/meta hierarchy 개선
- 긴 텍스트 truncation 기준 명확화
- right 영역 fixed width 또는 min width 검토
- pressed state를 더 subtle하게
- 마지막 row separator 제거 가능 여부 검토

### DdayPill

현재 D-day tone:

- `<= 3` 또는 overdue: critical
- `<= 7`: attention
- 나머지 neutral

리디자인 요구:

- D-day badge는 row 전체에서 가장 눈에 띄는 상태 요소다.
- critical은 빨간 배경을 작게 유지하고, 텍스트 대비를 높인다.
- neutral badge는 너무 튀지 않게 한다.

### Filter

현재 각 화면에서 filter style이 중복 구현되어 있다.

리디자인 요구:

- 공통 `SegmentedFilter` 또는 `FilterChip` 컴포넌트로 통일
- active state는 너무 무겁지 않게
- horizontal scroll과 wrapping 기준 결정

### PrimaryButton

현재 full pill blue button.

리디자인 요구:

- primary action은 유지
- disabled color는 `tertiaryLabel`보다 더 의도적인 disabled surface 필요
- pressed/disabled/loading state 분명히

## 9. 모바일 웹 전용 요구사항

`mobile.gwanje.com`은 실제 모바일 앱 이전에 디자인 검토와 운영 테스트 용도로도 쓰인다.

Web 대응 요구:

- desktop browser에서 앱이 full width로 늘어나지 않게 한다.
- root max-width: 430-480px 검토
- 중앙 정렬
- 외부 background와 앱 background 분리
- bottom tab 위치가 viewport 하단에 자연스럽게 고정
- pointer hover는 과하게 넣지 않는다.
- iPhone Safari safe area와 Chrome desktop responsive mode 모두 확인한다.

권장 QA viewport:

| Device | Size |
|---|---:|
| iPhone SE | 375 x 667 |
| iPhone 15 | 393 x 852 |
| iPhone 15 Pro Max | 430 x 932 |
| Android compact | 360 x 800 |
| Desktop preview | 1440 x 900 |

## 10. 콘텐츠 가이드

앱 안에서 기능 설명을 길게 하지 않는다.

권장 문구:

- 짧은 명사형 section title
- 상태 중심 empty text
- 오류는 사용자가 취할 수 있는 다음 행동이 보이게

예:

| 현재/일반 | 개선 방향 |
|---|---|
| 오늘 처리할 일을 적어보세요 | 업무 메모 입력 |
| 표시할 Task가 없습니다 | 조건에 맞는 Task가 없습니다 |
| 홈 데이터를 불러오지 못했습니다 | 데이터를 불러오지 못했습니다 |

단, 실제 구현 시 너무 건조하지 않게 업무 맥락을 살린다.

## 11. 접근성 및 터치 기준

필수 기준:

- 주요 tap target: 최소 44 x 44
- 텍스트 대비: WCAG AA 수준 목표
- 상태를 색으로만 구분하지 않기
- D-day, unread, urgent는 텍스트나 모양으로도 구분
- 버튼 disabled 상태는 명확하되 읽기 어려워지지 않게
- keyboard open 시 저장 버튼 접근 가능
- VoiceOver label 검토

## 12. 리디자인 산출물 요구

1차 산출물:

- 핵심 4화면 mock: 로그인, 홈, 알림, Task 수정 sheet
- 추가 2화면 mock: 오늘, 기업 상세
- 디자인 토큰 제안
- 공통 컴포넌트 스펙: AuthScreen, Screen, Section, Row, Badge, Filter, Button, Sheet, TextInput

2차 산출물:

- 전체 5탭 적용
- 인증 전/후 전환 플로우 적용
- 모바일 웹 desktop viewport 대응
- iOS/Android smoke QA
- 실제 데이터가 들어갔을 때 긴 텍스트/빈 데이터/오류 상태 QA

## 13. 리디자인 우선순위

| 우선순위 | 범위 | 이유 |
|---:|---|---|
| 1 | Screen, Section, Row 공통 구조 | 전체 앱 인상 결정 |
| 2 | 로그인 | 인증 전 첫 경험, 신뢰감 결정 |
| 3 | 홈 | 로그인 후 첫 화면, 앱 가치 전달 |
| 4 | Task 수정 sheet | 실제 write workflow |
| 5 | 알림 | 사용 빈도 높음 |
| 6 | 오늘 | 간단하지만 업무성 중요 |
| 7 | 기업 목록/상세 | 정보량 조정 필요 |

## 14. 구현 시 주의사항

- 기능 추가보다 현재 기능의 polish에 집중한다.
- Supabase/API 로직은 리디자인 범위 밖이다.
- 탭 개수는 유지한다.
- 앱 내 회원가입/결제/설정 전체는 추가하지 않는다.
- 캠페인 발송, 파일 업로드, 전체 CRUD는 모바일 v1 범위 밖이다.
- `lucide-react-native` 아이콘 사용은 유지 가능하다.
- iOS-first지만 Android에서도 back gesture와 터치 흐름을 해치지 않는다.

## 15. 디자인 프롬프트

아래 프롬프트는 Figma, v0, 이미지 생성, 또는 다른 AI 디자인 도구에 리디자인 지시문으로 사용할 수 있다.

```text
Redesign the current Gwanje mobile app as an iOS-first operations assistant for business consultants.

Do not make it look like a marketing page. Keep it as a real work app.

Design direction: iOS Native Calm Ops.
Use a white and light gray grouped background, quiet dense lists, thin separators, large iOS-style titles, bottom tabs, sheets, subtle blur only in navigation layers, and restrained status colors.

Keep the 5 tabs:
Home, Notifications, Today, Task, Companies.

Core workflows:
- Login: email and password sign-in for existing web accounts, error state, loading state, session-expired state
- Home: overdue items, D-7 deadlines, KPI summary, quick navigation
- Notifications: list, filters, unread state, read all
- Today: write a todo note, select tag, mark complete
- Task: filter by stage, open task edit sheet
- Companies: search, company list, company detail with contact, deadlines, credentials, tasks

Brand color:
#0064E0 only for primary action and selected states.

Avoid:
- decorative gradients
- oversized cards
- heavy shadows
- marketing hero layout
- one-note blue palette
- content cards with blur
- dense tables

Priority screens to mock:
1. Login
2. Home
3. Notifications
4. Task edit bottom sheet
5. Today
6. Company detail

Make the UI feel like a polished iPhone productivity app: calm, useful, compact, and operational.
```

## 16. 완료 기준

리디자인이 완료되었다고 판단하는 기준:

- 로그인 화면이 기존 웹 계정 전용 앱이라는 신뢰감을 준다.
- 로그인 기본/입력/오류/로딩/키보드 상태가 모두 자연스럽다.
- 첫 화면에서 급한 마감/Task 상태가 3초 안에 파악된다.
- 리스트 row가 실제 데이터로도 정돈되어 보인다.
- D-day, unread, stage 상태가 과하지 않지만 즉시 보인다.
- Task 수정 sheet가 iOS native sheet처럼 자연스럽다.
- desktop browser에서 `mobile.gwanje.com`을 열어도 모바일 앱 preview처럼 보인다.
- iPhone viewport에서 bottom tab과 content가 겹치지 않는다.
- Empty, loading, error 상태가 MVP처럼 보이지 않는다.
- 색상 사용이 절제되어 있고 브랜드 blue가 남발되지 않는다.

# 관제 모바일 리디자인 브리프

작성일: 2026-07-01
최근 업데이트: 2026-07-01
대상: `mobile/` React Native + Expo 모바일 앱
현재 배포 확인 URL: `https://gwanje-mobile.vercel.app`
목표 도메인: `https://mobile.gwanje.com`

## 0. 현재 배포 기준

이 문서는 현재 production 배포 기준으로 다시 정리한 리디자인 브리프다.

현재 확인된 배포 상태:

| 항목 | 상태 |
|---|---|
| Production URL | `https://gwanje-mobile.vercel.app` |
| Vercel deployment | Ready |
| 최근 모바일 커밋 | `d324724 fix: derive mobile web api origin at runtime` |
| 인증 전 라우팅 | `/login` 화면 표시 |
| 인증 후 라우팅 | 5탭 앱 진입 |
| Web API base URL | 웹 배포에서는 현재 origin을 runtime fallback으로 사용 |
| Supabase Auth | 기존 웹 계정 이메일/비밀번호 로그인 |
| 목표 도메인 | Vercel alias는 연결됨 |
| DNS 상태 | `mobile.gwanje.com` DNS 레코드 설정 필요 |

배포 기준으로 로그인 화면은 추가되어 있으며, 인증되지 않은 사용자가 홈/탭/상세 화면에 접근하면 로그인 화면으로 이동한다. 로그인 후에는 홈 탭으로 진입한다.

`mobile.gwanje.com`은 제품 목표 도메인이지만, 현재 실제 테스트는 `https://gwanje-mobile.vercel.app` 기준으로 진행한다.

## 1. 리디자인 목적

관제 모바일은 기존 웹 서비스를 그대로 축소한 앱이 아니라, 컨설턴트가 이동 중에 운영 상황을 빠르게 확인하고 가벼운 처리를 하는 모바일 운영 보조 앱이다.

리디자인 목표:

- 현재 구현된 기능과 정보 구조는 유지한다.
- 로그인부터 홈 진입까지 앱다운 신뢰감을 만든다.
- 전체 톤을 더 완성도 높은 iPhone 앱처럼 다듬는다.
- 관리형 SaaS 특유의 조용하고 밀도 있는 정보 구조를 살린다.
- 카드와 pill이 반복되어 보이는 느낌을 줄이고, 리스트 기반의 스캔성을 높인다.
- 모바일 웹에서도 앱처럼 보이게 한다.
- 데스크톱 브라우저에서는 모바일 폭으로 중앙 정렬되는 preview 경험을 제공한다.
- 기능 설명용 문구가 아니라 실제 업무 처리 화면처럼 보이게 한다.

핵심 방향:

```text
iOS Native Calm Ops
```

조용한 회색 grouped background, 명확한 hierarchy, 얇은 separator, 큰 타이틀, bottom tab, sheet, 리스트 중심 UI, 중요한 D-day만 색으로 강조하는 방향이다.

## 2. 제품 포지션

관제 모바일 앱은 컨설턴트용 모바일 운영 보조 앱이다.

주요 사용 상황:

- 기존 웹 계정으로 로그인한다.
- 오늘 급한 마감이 있는지 빠르게 확인한다.
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
- 앱 기능 설명 문구가 화면 대부분을 차지하는 방식

## 3. 현재 구현 요약

### 기술 구조

| 구분 | 현재 구현 |
|---|---|
| App | React Native + Expo Router + TypeScript |
| Mobile path | `mobile/` |
| Auth | Supabase Auth |
| Read | Supabase direct query |
| Write | Next.js mobile API |
| Push 준비 | Expo Notifications + mobile device API |
| Mobile web deploy | Vercel static Expo Web export |
| Web API 호출 | `/api/mobile/*` rewrite |
| Web API origin | 웹에서는 현재 origin fallback |

주요 파일:

| 역할 | 파일 |
|---|---|
| Root layout | `mobile/app/_layout.tsx` |
| Auth login | `mobile/app/(auth)/login.tsx` |
| Tabs layout | `mobile/app/(tabs)/_layout.tsx` |
| Home | `mobile/app/(tabs)/index.tsx` |
| Notifications | `mobile/app/(tabs)/notifications.tsx` |
| Today | `mobile/app/(tabs)/today.tsx` |
| Tasks | `mobile/app/(tabs)/tasks.tsx` |
| Task edit sheet | `mobile/app/task/[id].tsx` |
| Companies | `mobile/app/(tabs)/companies.tsx` |
| Company detail | `mobile/app/company/[id].tsx` |
| Auth context | `mobile/src/context/AuthContext.tsx` |
| Supabase client | `mobile/src/lib/supabase.ts` |
| API helper | `mobile/src/lib/api.ts` |
| Query layer | `mobile/src/lib/queries.ts` |
| Design tokens | `mobile/src/design/tokens.ts` |
| Screen shell | `mobile/src/ui/Screen.tsx` |
| Common primitives | `mobile/src/ui/Primitives.tsx` |

### 현재 라우팅과 인증

현재 흐름:

```text
App loading
-> Supabase session 확인
-> session 없음: /login
-> session 있음: /(tabs)
```

현재 구현된 인증 관련 상태:

- 초기 로딩: `관제 준비 중`
- 로그인 화면: 이메일/비밀번호 입력
- 로그인 중: 버튼 문구 `확인 중...`
- 로그인 실패: error text 표시
- env 미설정: notice + `모바일 env를 먼저 설정해 주세요.`
- 로그인 성공: 홈으로 redirect
- 로그아웃: 홈 우측 상단 logout icon
- 인증 없는 상세 접근: `/login` redirect

리디자인에서 보완할 인증 UX:

- env notice는 production에서는 보이지 않는 상태가 정상이다.
- 로그인 실패 문구를 Supabase 원문 그대로 노출하지 않도록 다듬는다.
- 비밀번호 보기/숨기기 토글을 추가한다.
- 키보드가 열렸을 때 CTA가 자연스럽게 보이도록 한다.
- desktop preview에서는 로그인 form이 너무 넓어지지 않게 제한한다.

### 현재 탭 구조

탭은 5개로 고정한다.

```text
홈 / 알림 / 오늘 / Task / 기업
```

각 탭의 현재 역할:

| 탭 | 현재 역할 |
|---|---|
| 홈 | KPI, 기한 지남, 다가오는 마감, 빠른 이동, 로그아웃 |
| 알림 | 알림 목록, 필터, 단건 읽음, 전체 읽음 |
| 오늘 | 업무일지 노트 작성, 태그 선택, 완료 체크 |
| Task | 과제 목록, 단계 필터, Task 수정 sheet 진입 |
| 기업 | 검색, 기업 목록, 기업 상세 진입 |

현재 navigation 특징:

- 하단 탭은 `BlurView`를 사용한다.
- header는 각 화면의 `Screen` 컴포넌트 안에서 large title 형태로 직접 렌더링한다.
- 상세 화면은 별도 Stack route다.
- Task 수정은 modal presentation이다.

## 4. 현재 디자인 토큰

현재 토큰은 `mobile/src/design/tokens.ts` 기준이다.

### 색상

| Token | Value | 현재 용도 |
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
| `criticalSoft` | `#FBE1E5` | 긴급 soft surface |
| `attention` | `#B9760A` | 주의 |
| `attentionSoft` | `#FDEED6` | 주의 soft surface |
| `success` | `#147A49` | 완료 |
| `successSoft` | `#E2F0E6` | 완료 soft surface |
| `ink` | `#0A1317` | 강한 선택 배경 |

리디자인 원칙:

- `#0064E0`은 주요 액션과 선택 상태에만 사용한다.
- critical, attention, success는 상태 표시용으로만 사용한다.
- 일반 화면은 iOS system gray 계열로 유지한다.
- 선택 filter의 `ink` 사용은 유지할 수 있지만, active chip이 너무 강하면 segmented control로 낮춘다.

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

리디자인 보완:

- 탭 화면 최상단은 iOS large title을 유지한다.
- 리스트 내부 제목은 현재 700보다 살짝 낮은 600-650 수준을 검토한다.
- section heading은 uppercase보다 자연스러운 한국어 레이블이 적합하다.
- 숫자 KPI는 크기를 유지하되 label과의 관계를 더 분명하게 만든다.
- Korean text는 line height를 넉넉하게 유지하고 negative letter spacing을 쓰지 않는다.

### 간격과 반경

현재 spacing:

```text
xs 6 / sm 8 / md 12 / base 16 / lg 20 / xl 24 / xxl 32
```

현재 radius:

```text
sm 8 / md 12 / lg 16 / xl 22 / full 999
```

리디자인 보완:

- 운영 도구 특성상 content group 반경은 12-16 중심으로 낮춘다.
- sheet와 floating surface만 22 이상을 허용한다.
- 리스트 row는 좌우 padding과 separator rhythm을 더 정돈한다.
- 버튼과 pill의 과도한 반복은 줄인다.

## 5. 현재 화면별 상태

### 5.1 로그인

현재 구현:

- `관` mark + `관제` title + `모바일 운영 보조 앱` subtitle
- 이메일 input
- 비밀번호 input
- full-width primary button
- env 미설정 notice
- error text
- `회원가입과 결제 관리는 웹에서 진행합니다.` footnote
- 로그인 성공 시 `/` redirect

현재 문제:

- desktop viewport에서 form max-width가 제한되지 않으면 앱 전용 화면처럼 보이지 않을 수 있다.
- 비밀번호 보기/숨기기 토글이 없다.
- env notice 문구는 개발자용에 가깝다.
- 로그인 실패 문구의 tone이 아직 제품화되어 있지 않다.

리디자인 방향:

- iOS 앱 onboarding 느낌의 단정한 로그인으로 다듬는다.
- 브랜드 영역은 로고 카드보다 텍스트 중심으로 차분하게 둔다.
- 입력 필드는 iOS Form처럼 얇은 border와 충분한 높이를 유지한다.
- primary CTA는 full-width로 유지한다.
- 도움말 문구는 더 작고 조용하게 둔다.
- 모바일 웹 desktop preview에서는 390-430px 폭으로 중앙 정렬한다.

권장 구조:

```text
Safe top space
Brand mark + 관제
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
- 비밀번호 숨김/표시
- 로그인 중
- 로그인 실패
- env 미설정 notice
- 세션 만료 후 재로그인
- 키보드 open
- desktop browser preview

금지:

- 큰 hero 이미지나 마케팅 일러스트
- 과한 로고 카드
- 회원가입 CTA 강조
- 소셜 로그인 버튼 추가
- 앱 기능을 설명하는 긴 문단

### 5.2 홈

현재 구현:

- large title `관제`
- subtitle `YYYY-MM-DD · 모바일 운영`
- 우측 logout icon
- 4개 KPI: 기업, 7일 내 마감, 30일 내 만료, 진행 Task
- 기한 지남 section
- 다가오는 마감 section
- 빠른 이동 section

현재 문제:

- KPI 4개가 같은 무게로 보여 긴급도 hierarchy가 약하다.
- 실제 운영 관점에서는 `기업` 수보다 `기한 지남`, `7일 내 마감`, `진행 Task`가 먼저 보여야 한다.
- 빠른 이동 section이 별도 리스트로 들어가면서 홈의 업무 밀도가 다소 분산된다.
- 빈/오류 상태가 화면 중앙에 크게 보여 실제 앱 polish가 약해 보일 수 있다.

리디자인 방향:

- 홈은 “오늘의 관제 요약”이어야 한다.
- urgent summary를 최상단에 둔다.
- 기한 지남이 있으면 최상단에서 강하게 드러낸다.
- 다가오는 마감은 날짜순 grouped list로 유지한다.
- 빠른 이동은 compact action row 또는 홈 하단 secondary section으로 낮춘다.

권장 구조:

```text
Large Title: 관제
Subtitle: 2026-07-01 · 모바일 운영

Priority Summary
- 기한 지남 N
- 7일 내 마감 N
- 진행 Task N

긴급 · 기한 지남
다가오는 마감
빠른 이동
```

### 5.3 알림

현재 구현:

- title `알림`
- subtitle `안읽음 N건`
- 우측 전체 읽음 icon
- `전체 / 만료 / 마감 / 매칭` filter chip
- 최근 알림 grouped list
- row icon, type/time meta, D-day text, unread dot
- row press 시 단건 읽음 처리

현재 문제:

- filter chip active state가 강해 화면 상단이 무겁다.
- 전체 읽음 버튼의 disabled affordance가 약하다.
- unread dot이 오른쪽에 있어 일부 row에서는 우선순위 파악이 느릴 수 있다.
- urgent 알림은 icon color만으로는 충분하지 않다.

리디자인 방향:

- iOS Mail/Reminders 느낌의 읽음/안읽음 hierarchy를 만든다.
- filter는 segmented control 또는 compact chip row로 통일한다.
- unread dot은 row 왼쪽 또는 제목 옆에 작게 붙이는 방식을 검토한다.
- urgent 알림은 left accent 또는 small text label을 같이 둔다.

필수 상태:

- 전체
- 필터 선택
- unread 있음
- unread 없음
- 전체 읽음 disabled
- 빈 목록
- 네트워크 오류

### 5.4 오늘

현재 구현:

- title `오늘`
- subtitle `YYYY-MM-DD · 업무일지`
- `새 노트` section
- multiline note input
- 태그 chip: 업무, 미팅, 기록
- 추가 button
- `오늘의 노트` list
- 완료 toggle은 row press로 처리

현재 문제:

- composer가 기능적으로는 충분하지만 실제 업무 메모 앱의 compact polish가 부족하다.
- 태그 chip이 다른 화면 filter chip과 시각적으로 중복된다.
- 완료된 노트의 상태 차이가 icon만으로는 약할 수 있다.
- 추가 버튼은 draft가 없을 때도 큰 비중으로 보인다.

리디자인 방향:

- “빠른 업무 메모” 느낌을 강화한다.
- composer는 독립 surface로 보이되 카드 남발처럼 보이지 않게 한다.
- 태그 선택은 segmented chip으로 통일한다.
- 추가 버튼은 draft가 있을 때만 강하게 보인다.
- 완료된 노트는 체크 아이콘, text opacity, optional strikethrough 중 하나로 명확히 표시한다.

### 5.5 Task 목록

현재 구현:

- title `Task`
- subtitle `단계와 메모 수정`
- 단계 filter: 전체, 진단, 제안, 신청, 결과
- Task grouped list
- row title, company, category/due/D-day meta
- stage pill
- row press 시 `/task/[id]` modal

현재 문제:

- filter가 wrap되며 viewport별 리듬이 달라질 수 있다.
- stage pill이 모든 row에서 강하게 보여 실제 우선순위인 due date와 경쟁한다.
- D-day가 meta text 안에 있어 긴급 task 스캔성이 약하다.
- row 오른쪽 영역 width가 고정되어 있지 않아 긴 stage label과 chevron/텍스트 균형을 확인해야 한다.

리디자인 방향:

- Task는 가장 업무적인 화면이므로 조용하고 밀도 있게 만든다.
- 단계 filter는 horizontal scroll segmented control을 권장한다.
- row에서 회사명, 제목, 기한, 단계가 한눈에 구분되어야 한다.
- D-day가 급한 task는 오른쪽에 우선 표시한다.
- Stage는 작은 status label 또는 secondary badge로 낮춘다.

### 5.6 Task 수정 sheet

현재 구현:

- modal presentation
- 하단 sheet
- grabber
- 우측 close button
- 회사명, 제목, meta
- 단계 선택
- memo input
- `변경 저장` button
- 저장 성공 시 haptic + dismiss

현재 문제:

- sheet 자체는 동작하지만 iOS native polish가 더 필요하다.
- 저장 실패가 inline error로 보이지 않고 console warning에 머문다.
- keyboard open 시 저장 버튼이 항상 편하게 보이는지 QA가 필요하다.
- 단계 선택 chip이 많은 경우 줄바꿈 리듬이 어색할 수 있다.
- 긴 제목/긴 메모/작은 화면에서 spacing 검증이 필요하다.

리디자인 방향:

- iOS bottom sheet polish를 가장 우선한다.
- sheet 상단의 grabber, close, title hierarchy를 정교하게 다듬는다.
- 단계 변경은 현재 stage가 명확하고 touch target이 충분해야 한다.
- memo는 실제 업무 메모처럼 읽기/쓰기 편해야 한다.
- 저장 버튼은 keyboard와 safe area에 가리지 않아야 한다.
- 저장 실패는 sheet 내부에서 조용하지만 분명하게 보여준다.

권장 구조:

```text
Grabber
Header: Task 수정 / Close
Company + Task Title
Due Date + D-day + Category
Stage Picker
Memo
Inline Error
Sticky Save Button
```

### 5.7 기업 목록

현재 구현:

- title `기업`
- subtitle `담당자와 요약 조회`
- iOS search bar 형태의 검색 field
- 기업 list
- 회사명, 업종/지역/담당자
- 가장 가까운 일정 meta
- D-day pill

현재 문제:

- 가까운 마감이 없는 row에도 neutral D-day pill이 보여 시각적 noise가 생길 수 있다.
- subtitle에 업종/지역/담당자를 한 줄로 이어 붙여 정보 우선순위가 약하다.
- 검색 결과 없음 상태의 다음 행동 안내가 약하다.

리디자인 방향:

- 기업 목록은 연락처/마감 확인에 최적화한다.
- search field는 현재 방향을 유지하되 더 iOS native하게 다듬는다.
- row subtitle은 담당자와 업종/지역을 분리하거나 우선순위를 정한다.
- 가까운 마감이 없을 때는 오른쪽 badge를 숨기거나 neutral text로 낮춘다.

### 5.8 기업 상세

현재 구현:

- company name large title
- subtitle industry/region
- 우측 back icon action
- 담당자 section
- 전화/메일 row action
- 다가오는 일정 section
- 자격·인증 section
- Task section

현재 문제:

- back action이 우측에 있어 iOS navigation expectation과 다를 수 있다.
- 전화/메일이 row 형태라 빠른 action이라는 느낌이 약할 수 있다.
- section이 많아 vertical rhythm과 density 조정이 중요하다.
- 회사명, 연락 액션, 가까운 마감의 우선순위가 더 명확해야 한다.

리디자인 방향:

- 상단에는 회사명과 연락 액션이 명확해야 한다.
- 전화/메일은 compact action button으로 빠르게 접근할 수 있게 검토한다.
- 상세 화면은 section 간 rhythm이 중요하다.
- 일정, 자격, Task는 row 패턴을 공유하되 각 정보의 핵심 field가 다르게 보여야 한다.

권장 상단:

```text
Back
Company Name
Industry · Region
Quick Actions: Call / Mail
Nearest Deadline
```

## 6. 공통 컴포넌트 리디자인 범위

### Screen

현재 `Screen`은 ScrollView + title/subtitle/action + pull refresh를 제공한다.

리디자인 요구:

- large title 유지
- action button 위치와 크기 재정리
- web max-width 대응
- bottom tab padding 안정화
- content gap 재조정
- loading/error/empty 배치가 화면을 과도하게 비우지 않도록 조정

### Section

현재 `Section`은 heading + white group container로 구성된다.

리디자인 요구:

- section heading의 uppercase 제거
- iOS grouped list처럼 section title은 더 작고 자연스럽게
- group border/radius/separator 정리
- nested card 느낌 방지
- 첫 row와 마지막 row의 separator 처리 정리

### Row

현재 `Row`는 icon, text, right, chevron을 받는다.

리디자인 요구:

- title/subtitle/meta hierarchy 개선
- 긴 텍스트 truncation 기준 명확화
- right 영역 fixed width 또는 min width 검토
- pressed state를 더 subtle하게
- row icon이 꼭 필요한 화면과 아닌 화면 구분
- 마지막 row separator 제거 가능 여부 검토

### Badge

현재 `DdayPill`, `StagePill`이 따로 존재한다.

리디자인 요구:

- `Badge` 계열로 tone과 size를 통일한다.
- D-day badge는 row 전체에서 가장 눈에 띄는 상태 요소다.
- critical은 작고 선명하게, neutral은 약하게 보인다.
- stage는 D-day보다 시각적 우선순위가 낮아야 한다.

### Filter

현재 알림/Task/오늘 태그에서 유사한 chip style이 중복 구현되어 있다.

리디자인 요구:

- 공통 `SegmentedFilter` 또는 `FilterChip` 컴포넌트로 통일
- active state는 너무 무겁지 않게
- horizontal scroll과 wrapping 기준 결정
- chip 간격과 높이를 화면별로 다르게 만들지 않는다.

### PrimaryButton

현재 full pill blue button이다.

리디자인 요구:

- primary action은 유지한다.
- disabled surface는 더 의도적으로 보이게 한다.
- pressed/disabled/loading state를 분명히 한다.
- sheet 안에서는 sticky bottom button variant를 둔다.

### TextInput

현재 로그인, 오늘 composer, Task memo, 기업 search에서 각각 직접 스타일링한다.

리디자인 요구:

- `FormInput`, `SearchInput`, `MemoInput` variant를 정리한다.
- focus ring은 iOS-first로 subtle하게 처리한다.
- multiline input은 최소 높이와 keyboard behavior를 검증한다.

## 7. 모바일 웹 전용 요구사항

`gwanje-mobile.vercel.app`은 실제 앱 출시 전 디자인 검토와 운영 테스트 용도로 쓰인다. `mobile.gwanje.com`은 DNS 설정 후 같은 경험을 제공해야 한다.

Web 대응 요구:

- desktop browser에서 앱이 full width로 늘어나지 않게 한다.
- root max-width: 430-480px 검토
- 중앙 정렬
- 외부 background와 앱 background 분리
- 앱 내부는 safe area와 bottom tab을 유지
- bottom tab 위치가 viewport 하단에 자연스럽게 고정
- pointer hover는 과하게 넣지 않는다.
- iPhone Safari safe area와 Chrome desktop responsive mode 모두 확인한다.
- production에서는 env notice가 보이지 않아야 한다.

권장 QA viewport:

| Device | Size |
|---|---:|
| iPhone SE | 375 x 667 |
| iPhone 15 | 393 x 852 |
| iPhone 15 Pro Max | 430 x 932 |
| Android compact | 360 x 800 |
| Desktop preview | 1440 x 900 |

## 8. 콘텐츠 가이드

앱 안에서 기능 설명을 길게 하지 않는다.

권장 문구:

- 짧은 명사형 section title
- 상태 중심 empty text
- 오류는 사용자가 취할 수 있는 다음 행동이 보이게
- 개발자용 env/API 문구는 production에서 숨김

문구 개선 예:

| 현재/일반 | 개선 방향 |
|---|---|
| 오늘 처리할 일을 적어보세요 | 업무 메모 입력 |
| 표시할 Task가 없습니다 | 조건에 맞는 Task가 없습니다 |
| 홈 데이터를 불러오지 못했습니다 | 데이터를 불러오지 못했습니다 |
| TypeError: Failed to fetch | 네트워크 연결을 확인해 주세요 |
| 모바일 env를 먼저 설정해 주세요 | 앱 설정을 확인해 주세요 |

단, 실제 구현 시 너무 건조하지 않게 업무 맥락을 살린다.

## 9. 접근성 및 터치 기준

필수 기준:

- 주요 tap target: 최소 44 x 44
- 텍스트 대비: WCAG AA 수준 목표
- 상태를 색으로만 구분하지 않기
- D-day, unread, urgent는 텍스트나 모양으로도 구분
- 버튼 disabled 상태는 명확하되 읽기 어려워지지 않게
- keyboard open 시 저장 버튼 접근 가능
- VoiceOver label 검토
- Android back gesture와 hardware back 동작 검증

## 10. 리디자인 우선순위

현재 배포본 기준 우선순위:

| 우선순위 | 범위 | 이유 |
|---:|---|---|
| 1 | 모바일 웹 max-width / root frame | `gwanje-mobile.vercel.app` 검토 경험을 즉시 개선 |
| 2 | 로그인 | 인증 전 첫 경험, 신뢰감 결정 |
| 3 | Screen, Section, Row 공통 구조 | 전체 앱 인상 결정 |
| 4 | 홈 | 로그인 후 첫 화면, 앱 가치 전달 |
| 5 | Task 수정 sheet | 실제 write workflow |
| 6 | 알림 | 사용 빈도 높음 |
| 7 | 오늘 | 간단하지만 업무성 중요 |
| 8 | 기업 목록/상세 | 정보량 조정 필요 |

1차 리디자인 산출물:

- 핵심 4화면 mock: 로그인, 홈, 알림, Task 수정 sheet
- 추가 2화면 mock: 오늘, 기업 상세
- 디자인 토큰 제안
- 공통 컴포넌트 스펙: AuthScreen, Screen, Section, Row, Badge, Filter, Button, Sheet, TextInput
- 모바일 웹 desktop preview frame 스펙

2차 구현 산출물:

- 전체 5탭 적용
- 인증 전/후 전환 플로우 polish
- 모바일 웹 desktop viewport 대응
- iOS/Android smoke QA
- 실제 데이터가 들어갔을 때 긴 텍스트/빈 데이터/오류 상태 QA

## 11. 구현 시 주의사항

- 기능 추가보다 현재 기능의 polish에 집중한다.
- Supabase/API 로직은 리디자인 범위 밖이다.
- 탭 개수는 유지한다.
- 앱 내 회원가입/결제/설정 전체는 추가하지 않는다.
- 캠페인 발송, 파일 업로드, 전체 CRUD는 모바일 v1 범위 밖이다.
- `lucide-react-native` 아이콘 사용은 유지 가능하다.
- blur는 tab bar/header/sheet navigation layer에만 제한한다.
- content card나 table/list body에는 blur를 쓰지 않는다.
- card inside card 구조를 만들지 않는다.
- iOS-first지만 Android에서도 back gesture와 터치 흐름을 해치지 않는다.
- 웹 배포에서는 production env가 없어도 현재 origin fallback으로 `/api/mobile/*`을 호출할 수 있어야 한다.

## 12. QA 체크리스트

### 배포 확인

- `https://gwanje-mobile.vercel.app` 접속 가능
- `/login` 직접 접속 가능
- 인증 전 홈 접근 시 `/login` 이동
- 로그인 후 홈 진입
- 로그아웃 후 로그인 화면 복귀
- `/api/mobile/*` rewrite 동작
- production에서 env notice 미노출
- `mobile.gwanje.com` DNS 연결 후 동일 동작

### 화면 QA

- iPhone SE에서 bottom tab과 content 겹침 없음
- iPhone 15/15 Pro Max에서 spacing 과밀/과소 없음
- Android compact에서 filter wrapping/scroll 자연스러움
- desktop preview에서 앱 폭이 과하게 넓어지지 않음
- keyboard open 상태에서 로그인 CTA와 Task 저장 button 접근 가능
- 긴 회사명/Task 제목/메모가 레이아웃을 깨지 않음
- empty/loading/error 상태가 MVP처럼 보이지 않음

### 권한/데이터 QA

- 다른 tenant 데이터 조회 불가
- 권한 없는 사용자의 Task 수정 실패
- 읽음 처리 후 refresh 유지
- 업무일지 작성/완료 후 refresh 유지
- Task 단계 변경 후 refresh 유지
- 네트워크 오류 시 사용자 친화적 문구 표시

## 13. 디자인 프롬프트

아래 프롬프트는 Figma, v0, 이미지 생성, 또는 다른 AI 디자인 도구에 리디자인 지시문으로 사용할 수 있다.

```text
Redesign the currently deployed Gwanje mobile web app as an iOS-first operations assistant for business consultants.

Use the deployed product state as the source of truth:
- Production URL: https://gwanje-mobile.vercel.app
- Existing login screen for email/password Supabase Auth
- Authenticated 5-tab app: Home, Notifications, Today, Task, Companies
- Task edit bottom sheet
- Company detail screen
- Expo web deployment that must feel like a mobile app in desktop browsers

Do not make it look like a marketing page. Keep it as a real work app.

Design direction: iOS Native Calm Ops.
Use a white and light gray grouped background, quiet dense lists, thin separators, large iOS-style titles, bottom tabs, sheets, subtle blur only in navigation layers, and restrained status colors.

Core workflows:
- Login: email and password sign-in for existing web accounts, error state, loading state, session-expired state
- Home: overdue items, D-7 deadlines, KPI summary, quick navigation
- Notifications: list, filters, unread state, read all
- Today: write a todo note, select tag, mark complete
- Task: filter by stage, open task edit sheet, change stage, edit memo
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
- card inside card layouts
- long feature explanation copy

Priority screens to mock:
1. Login
2. Home
3. Notifications
4. Task edit bottom sheet
5. Today
6. Company detail
7. Desktop browser mobile preview frame

Make the UI feel like a polished iPhone productivity app: calm, useful, compact, and operational.
```

## 14. 완료 기준

리디자인이 완료되었다고 판단하는 기준:

- 로그인 화면이 기존 웹 계정 전용 앱이라는 신뢰감을 준다.
- 로그인 기본/입력/오류/로딩/키보드 상태가 모두 자연스럽다.
- production에서 env notice가 보이지 않는다.
- 첫 화면에서 급한 마감/Task 상태가 3초 안에 파악된다.
- 리스트 row가 실제 데이터로도 정돈되어 보인다.
- D-day, unread, stage 상태가 과하지 않지만 즉시 보인다.
- Task 수정 sheet가 iOS native sheet처럼 자연스럽다.
- desktop browser에서 `gwanje-mobile.vercel.app` 또는 `mobile.gwanje.com`을 열어도 모바일 앱 preview처럼 보인다.
- iPhone viewport에서 bottom tab과 content가 겹치지 않는다.
- Empty, loading, error 상태가 MVP처럼 보이지 않는다.
- 색상 사용이 절제되어 있고 브랜드 blue가 남발되지 않는다.

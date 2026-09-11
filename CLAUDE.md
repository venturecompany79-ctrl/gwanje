# CLAUDE.md

> Claude Code가 **매 세션 자동으로 읽는** 프로젝트 헌법. 모든 화면 작업은 이 규칙을 따른다.
> 세부 원본(`/docs`)을 **권위(source of truth)**로 삼는다:
> - `supabase/migrations/*.sql` — **DB 스키마 (실제 권위)**. `/docs/schema.sql`은 초기 스냅숏으로 이후 테이블(billing·mobile·drive 등)이 빠져 있다 — 참고용으로만.
> - `/docs/design.md` — **디자인 시스템(Mission Control DS = x.ai × SpaceX) 토큰·컴포넌트 (디자인 최우선 권위)**
> - `/docs/wireframes/*.html` — 화면 레이아웃 참조 (Mission Control DS 토큰 · `_ds/tokens.css` 공유)
> - `/docs/화면설계_기획자료.md` — 화면별 구성요소·동작·상태

---

## 1. 제품 한 줄 정의
한 명의 경영컨설턴트가 다수의 중소기업을 동시에 관리하며, 인증·정부지원·융자의 **만료/마감을 통합 관제**하고, **관리포인트를 추천**받고, 공통 이벤트를 **조건별 일괄 안내**하는 B2B SaaS.
현재 단계: 멀티테넌트 + **회원가입(Google OAuth·이메일 즉시 가입)** (서버 플래그 `SIGNUP_ENABLED`로 개방 제어).

## 2. 기술 스택
- **Next.js (App Router)** + TypeScript, Vercel
- **Supabase** (Postgres + Auth + RLS), `@supabase/ssr`
- 파일 저장 **Cloudinary** / 알림톡 게이트웨이(추후)

## 3. 레포 구조 (라우팅은 `middleware.ts`의 `/app` 보호와 일치)
```
app/
  page.tsx                      / 랜딩(공개)
  login/ signup/ reset/         인증 (signup은 Google OAuth + 이메일 즉시 가입 — SIGNUP_ENABLED로 제어)
  signup/complete/              가입 온보딩(워크스페이스 프로비저닝)
  auth/callback/                Google OAuth PKCE 콜백 (route.ts)
  terms/ privacy/               이용약관·개인정보 처리방침(공개, 문안 초안)
  app/
    layout.tsx                  ★ 앱 셸: 사이드바(240px)+상단바 — 모든 솔루션 화면 공유
    page.tsx                    /app 대시보드
    companies/page.tsx          기업 목록
    companies/[id]/page.tsx     기업 상세(탭)
    board/ campaigns/ notifications/ settings/
components/ui/                  ★ 공통 프리미티브 (Mission Control DS 토큰 기반)
app/globals.css                 ★ design.md 토큰을 CSS 변수로 포팅 (아래 5절)
lib/supabase/                   server.ts / client.ts (typed)
lib/labels.ts                   enum(영문) ↔ 한국어 라벨 매핑
docs/                           schema.sql / design.md / wireframes / 화면설계_기획자료.md
```

## 4. 라우팅 규칙 (이미 `middleware.ts`에 구현 — 깨지 말 것)
- 세션 **있음(active)** + `/`·`/login`·`/signup` → `/app` 자동 진입
- 세션 **없음** + `/app/*` → `/login` (복귀용 `?redirect=`)
- 세션 있음 + **profile 없음**(Google OAuth 가입 직후) → `/signup/complete` 온보딩으로 고정 (가입 OFF면 `/login?status=inactive`)
- `/auth/callback`(OAuth 코드 교환)은 middleware matcher에서 제외 — 콜백 라우트가 자체 분기
- 그 외 공개 페이지(`/terms`·`/privacy` 포함)는 통과

## 5. 디자인 시스템 — **Mission Control DS** (★ 핵심 / 권위: `/docs/design.md`)
**x.ai(구조·색) × SpaceX(타이포·톤)** 기반. **다크 단일 테마, 흰색 1차 액션, 풀 pill 버튼**이 시그니처.
토큰은 `{colors.x}`·`{typography.x}`·`{rounded.x}`·`{spacing.x}`·`{components.x}` 네임스페이스로 정의돼 있다.
design.md 토큰은 이미 `app/globals.css`의 `:root`에 1:1 포팅돼 있다(약 100줄). 모든 컴포넌트는 이 토큰만 참조한다.
**임의 색·radius·폰트 생성 금지. 토큰 이름 변경 금지**(1,400곳 이상이 참조 중 — 이름 유지, 값만 교체).

**시그니처 규칙**
- 버튼은 **항상 pill** (`rounded.full` = 100px). 사각 버튼 금지.
- 카드 라운딩은 **작게**: 큰 카드 14px(`rounded.xxxl`) / 일반 피처 10px(`rounded.xl`) / 입력·라디오 8px(`rounded.lg`). SpaceX의 austerity.
- 엘리베이션 **기본 flat**(테두리 `hairline-soft`). 다크 캔버스에서 회색 그림자는 보이지 않으므로 **그림자는 순검정**(`rgba(0,0,0,.6) 0 2px 12px`)으로, sticky/떠 있는 패널에만.
- 단색 지향 — **1차 액션은 흰색**(`primary` #fff + `on-primary` #0a0a0a). 채도는 **status·마케팅 CTA·보조 액센트에만** 허용, 그 외 액센트 추가 금지.
- **밝은 채움 위 전경은 근-검정**(`on-primary`). 다크 팔레트에서 흰 전경은 대비 미달(#ffb224 위 2.0:1).
- eyebrow·마이크로 캡션·수치는 **대문자 트래킹 mono**(`--font-mono`) — SpaceX 시그니처.

**토큰 요약 (권위는 design.md — 값 충돌 시 design.md 우선)**
| 그룹 | 토큰 : 값 |
|---|---|
| 1차 액션 | `primary` #ffffff · `primary-deep` #dadbdf · `primary-soft` #a0c3ec · `on-primary` #0a0a0a |
| 마케팅 1차 | `ink-button` #ff7a17 (sunset pill) / `on-ink-button` #0a0a0a |
| 폼 활성 | `fb-blue` #ffffff (선택 라디오·체크·인풋 포커스 — 흰색 아웃라인) |
| 표면 | `canvas` #191919 (패널) · `surface-soft` #0a0a0a (body·함몰) |
| 텍스트 | `ink-deep` #ffffff · `ink` #fafaf7 · `charcoal` #dadbdf · `slate` #b9bcc2 · `steel` #9aa0a6 · `stone` #858a92 |
| 라인 | `hairline` #2c2f34 · `hairline-soft` #212327 |
| 시맨틱 | `success` #35d07f · `attention` #ffb224 · `warning` #ffc94d · `critical` #ff4d63 · `critical-strong` #ff6076 |
| radius | xs2 · sm4 · md6 · lg8 · **xl10** · xxl12 · **xxxl14** · feature16 · full100 · circle |
| spacing(4px base) | xxs4 · xs8 · sm10 · md12 · base16 · lg20 · xl24 · xxl32 · xxxl40 · section-sm48 · section64 · section-lg80 · hero120 |

**문서화된 프리미티브** (design.md `components:`): `button-primary`(흰색 pill) / `button-marketing`(sunset pill) / `button-ghost`(흰색 아웃라인 pill) · `badge-status` · `card` · `text-input` · `pill-tab(+active)` 등.

### ★ 갭 & 적응
1. **카테고리 색은 토큰이 아니라 사용자 데이터.** `category.color`는 설정에서 사용자가 고르며 팔레트는 `lib/categoryColors.ts`. 칩 렌더는 `components/shell/CategoryColorStyle.tsx`가 다크 캔버스 위 `color-mix`로 처리한다.
2. **SaaS 컴포넌트(DataTable·Kanban·Sidebar·SlideOver·Tabs·앱 셸)는 원본 브랜드에 없음.** x.ai/SpaceX는 마케팅 사이트라 데이터 밀도 UI가 없다 → 토큰(색·타이포·radius·spacing) + `badge`·`pill-tab`·`card` 프리미티브 기반으로 **앱 확장 컴포넌트**로 구현하고, 레이아웃은 와이어프레임을 따른다.
3. **버튼 2단**: 앱 내부 1차 액션은 **흰색 pill**(`button-primary`), **sunset pill**(`ink-button`)은 **랜딩/마케팅 페이지의 1차 CTA에만**.
4. **상태 매핑(불변)**: 자격 유효=`success` / 임박=`warning`(또는 `attention`) / 만료=`critical`. D-day 긴급도·과제 단계 배지도 같은 시맨틱 토큰 재사용.
5. **폰트 ★**: SpaceX의 `D-DIN`, x.ai의 `Universal Sans`·`Geist Mono` 모두 비공개 → 폴백 고정. 라틴 **Inter**, **한글 Noto Sans KR**(한국어 앱이므로 필수), mono는 시스템 스택(`--font-mono`, 다운로드 없음).
6. **웹은 다크 단일 테마.** `:root`에 `color-scheme: dark`가 선언돼 네이티브 폼 컨트롤·스크롤바·autofill이 다크로 따라간다. 새 CSS에 라이트 전제(`#fff` 배경, 어두운 알파 그림자) 하드코딩 금지. **모바일은 같은 시스템의 밝은 반전판이다 — 아래 5-1절.**
7. **와이어프레임(`/docs/wireframes/*.html`)도 새 토큰으로 재작성됨.** 8종 모두 `_ds/tokens.css`(= `app/globals.css`의 `:root` 사본) 한 파일을 공유하므로 하드코딩 색이 없다. 토큰 값을 바꾸면 앱과 와이어프레임을 **함께** 갱신할 것.

## 5-1. 모바일 — **Mission Control DS · Light** (권위: `mobile/src/design/tokens.ts`)
모바일(`mobile/`, React Native + Expo)은 CSS를 쓰지 않는다. 토큰은 `mobile/src/design/tokens.ts` **한 곳**에만 있고, 화면은 `colors.*`/`typography.*`/`radius.*`/`spacing.*`만 참조한다. **임의 색 금지.**

웹과 **같은 톤앤무드(SpaceX × x.ai), 반대 지면**이다. 모바일은 이동 중 짧게 보는 화면이라 밝은 지면 위 **순검정 본문**으로 간다.

| | 웹 (다크) | 모바일 (라이트) |
|---|---|---|
| 지면 | `canvas` #191919 / body #0a0a0a | `card` #FFFFFF / `grouped` #F0F0FA (spacex canvas-cool) |
| 본문 | `ink-deep` #ffffff | `label` #000000 (순검정 · 21:1) |
| 1차 액션 | 흰색 pill + 근검정 글자 | **검정 pill + 흰 글자** (`brand` #000000) |
| 라인 | `hairline-soft` #212327 | `hairline` #E0E0E8 (spacex hairline-on-light) |

**시그니처 규칙 (웹과 공통)**
- 버튼은 **항상 pill**(`radius.full`). 사각 버튼 금지.
- 카드 라운딩은 작게: `card` 10 / `md` 8 / `chip` 6 / `sm`·`xs` 4.
- 액센트 추가 금지. 채도는 **status(critical/attention/success)에만**. 선택·활성 상태는 검정 채움 또는 무채색 wash(`brandTint`).
- ★ SpaceX의 **대문자 트래킹 마이크로캡션은 한글에 uppercase가 없어 그대로 못 옮긴다** → `sectionLabel`·`eyebrow`는 **양수 letterSpacing(+0.5~0.6) + 두꺼운 굵기**로 치환했다. `textTransform: 'uppercase'` 쓰지 말 것(한글에 무효).
- D-day·KPI 수치는 `tabularNums`를 함께 적용해 자릿수를 고정한다.

**대비 (흰 카드 기준, 실측)**: `label` 21.0 · `secondaryLabel` 6.9 · `tertiaryLabel` 4.6 · `critical` 4.6 · `attention` 5.2 · `success` 5.4 · 1차버튼 21.0. `quaternary`(3.0)는 chevron·비활성 화살표 등 **비텍스트 전용**.

> 모바일은 자체 StyleSheet를 쓰므로 `app/globals.css` 변경이 전파되지 않는다. 토큰을 바꾸면 **양쪽을 함께** 갱신할 것.

## 6. 와이어프레임 → 화면 매핑 (`/docs/wireframes/`)
| 와이어프레임 파일 | 화면 | 라우트 |
|---|---|---|
| `dashboard__MC_DS_.html` | 통합 대시보드 | `/app` |
| `company_detail__MC_DS_.html` | 기업 상세(탭) | `/app/companies/[id]` |
| `mgt_point__MC_DS_.html` | 관리포인트 보드 | `/app/board` |
| `guide__MC_DS_.html` | **일괄안내(캠페인)** ※파일명과 다름 | `/app/campaigns` |
| `notification__MC_DS_.html` | 알림 센터 | `/app/notifications` |
| `settings__MC_DS_.html` | 설정 | `/app/settings` |
| `landing_page__MC_DS_.html` | 랜딩 | `/` |
| `login__MC_DS_.html` | 로그인/회원가입 | `/login`, `/signup` |
| (없음 — 스펙 2-3로 구현) | **기업 목록** | `/app/companies` |

> 와이어프레임은 React+Babel 데모다. **그대로 붙여넣지 말고** 레이아웃·시각 기준으로만 쓰고, Mission Control DS 토큰으로 프로덕션 Server Component를 재구현한다.

## 7. 데이터 레이어
- 데이터 페치는 **Server Component + Supabase 서버 클라이언트**. 클라이언트 컴포넌트는 상호작용에만.
- 타입: `supabase gen types`로 만든 `Database` 타입 사용. **`any` 금지.**
- **RLS가 tenant 격리를 자동 처리**(`auth_tenant_id()`) → 일반 쿼리에서 `tenant_id` 수동 필터 불필요. 단, **새 테이블 추가 시** `tenant_id` + `enable row level security` + 격리 정책을 반드시 함께 만든다.

### 테이블 요약 (전체·최신은 `supabase/migrations/`)
| 테이블 | 용도 | 핵심 컬럼 |
|---|---|---|
| `tenant` / `profile` | 워크스페이스 / 컨설턴트 | profile에 알림규칙·발신정보 |
| `category` | 분류 5종(설정에서 수정) | name, color, sort_order |
| `company` | 고객사 | industry, founded_date, revenue, headcount, condition_tags[] |
| `credential` | 자격·인증 | type, category_id, issued_date, expires_date, renew_lead_days |
| `task` | 관리포인트 | category_id, stage, due_date, assignee_id |
| `schedule` | 일정 | date, type, related_task_id |
| `document` | 자료 | doc_category, version, uploaded_by, storage_url |
| `campaign` / `campaign_recipient` | 일괄안내 / 수신·응답 | segment(jsonb), status / delivered, responded |
| `notification` | 알림 | type, is_read, ref_table/ref_id |
| `rule` | 룰엔진(Phase2, 테이블만) | eligibility(jsonb) |
| **`deadline_item`**(뷰) | **대시보드 D-day 통합** | source, due_date, **days_left**, status |

> 대시보드 D-day 리스트/캘린더는 **`deadline_item` 뷰**를 쓴다(자격+과제+일정 통합). 3개 테이블 직접 조인 금지.

## 8. enum ↔ 한국어 라벨 (DB 영문 / UI 한국어 — `lib/labels.ts`)
- `task_stage`: diagnosis 현황진단 · proposal 제안 · application 신청 · result 결과
- `schedule_type`: expiry 만료 · deadline 마감 · meeting 미팅 · renewal 갱신 · etc 기타
- `document_uploader`: consultant 컨설턴트 · client 고객사
- `campaign_status`: draft 임시저장 · scheduled 예약됨 · sending 발송중 · sent 발송완료
- `campaign_channel`: alimtalk 알림톡 · email 이메일
- `notification_type`: expiry 만료 · deadline 마감 · program_match 공고매칭
- 자격 상태(파생): valid 유효 · expiring 임박 · expired 만료

## 9. 작업 방식 (중요)
- **한 세션에 한 화면.** 커밋도 화면 단위.
- 화면 작업 입력 3종: ① 해당 와이어프레임(6절) ② 스펙 섹션(`화면설계_기획자료.md`) ③ 데이터 바인딩(7절 표).
- 모든 화면에 **로딩 / 빈 상태 / 에러 상태** 필수.
- 권장 순서: design.md 토큰 포팅 + 폰트 폴백 확정 + 앱 셸 + 프리미티브 → 대시보드 → 기업목록(테이블) → 기업상세(탭) → 보드 → 일괄안내 → 알림 → 설정 → 로그인/랜딩.

## 10. 명령어
```bash
npm run dev
npm run typecheck      # PR 전 필수
npm run lint
npx supabase gen types typescript --local > lib/database.types.ts
```

## 11. 범위 밖 (자리만 / 건드리지 말 것)
- 룰엔진 추천(기업상세 추천 탭) — Phase2, 테이블만
- 고객사 포털 — Phase3 / 구독·팀 권한 — Phase4

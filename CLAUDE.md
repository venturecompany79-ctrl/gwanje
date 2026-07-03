# CLAUDE.md

> Claude Code가 **매 세션 자동으로 읽는** 프로젝트 헌법. 모든 화면 작업은 이 규칙을 따른다.
> 세부 원본(`/docs`)을 **권위(source of truth)**로 삼는다:
> - `/docs/schema.sql` — DB 스키마
> - `/docs/design.md` — **디자인 시스템(Meta DS) 토큰·컴포넌트 (디자인 최우선 권위)**
> - `/docs/wireframes/*.html` — 화면 레이아웃 참조 (Meta DS 토큰 + 앱 확장)
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
components/ui/                  ★ 공통 프리미티브 (Meta DS 토큰 기반)
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

## 5. 디자인 시스템 — **Meta DS** (★ 핵심 / 권위: `/docs/design.md`)
Meta의 커머스(Quest·Ray-Ban) 디자인 시스템 기반. **라이트 테마, cobalt 액센트, 풀 pill 버튼**이 시그니처.
토큰은 `{colors.x}`·`{typography.x}`·`{rounded.x}`·`{spacing.x}`·`{components.x}` 네임스페이스로 정의돼 있다.
**셋업 시 design.md 토큰을 `app/globals.css`의 CSS 변수(또는 Tailwind `theme.extend`)로 1:1 포팅**하고, 모든 컴포넌트는 이 토큰만 참조한다. **임의 색·radius·폰트 생성 금지.**

**시그니처 규칙**
- 버튼은 **항상 pill** (`rounded.full` = 100px). 사각 버튼 금지.
- 카드: 사진형 32px(`rounded.xxxl`) / 일반 피처 16px(`rounded.xl`) / 입력·라디오 8px(`rounded.lg`).
- 엘리베이션 **기본 flat**(테두리 `hairline-soft`). 그림자는 sticky 패널에만(`rgba(20,22,26,.3) 0 1px 4px`).
- 단색 지향 — 액센트는 **cobalt(`primary` #0064e0) + oculus-purple**만. 그 외 액센트 추가 금지.
- 헤딩은 Optimistic VF의 `ss01,ss02`를 **항상 함께** 켠다.

**토큰 요약 (권위는 design.md — 값 충돌 시 design.md 우선)**
| 그룹 | 토큰 : 값 |
|---|---|
| 주요 | `primary` #0064e0 · `primary-deep` #0457cb · `primary-soft` #0091ff · `on-primary` #fff |
| 마케팅 1차 | `ink-button` #000 (검정 pill) / `on-ink-button` #fff |
| 폼 활성 | `fb-blue` #1876f2 (선택 라디오·체크·인풋 포커스) |
| 표면 | `canvas` #ffffff · `surface-soft` #f1f4f7 |
| 텍스트 | `ink-deep` #0a1317 · `ink` #1c1e21 · `charcoal` #444950 · `slate` #4b4c4f · `steel` #5d6c7b · `stone` #8595a4 |
| 라인 | `hairline` #ced0d4 · `hairline-soft` #dee3e9 |
| 시맨틱 | `success` #31a24c · `attention` #f2a918 · `warning` #f7b928 · `critical` #e41e3f · `critical-strong` #f0284a |
| radius | xs2 · sm4 · md6 · lg8 · xl16 · xxl24 · xxxl32 · feature40 · full100 · circle |
| spacing(4px base) | xxs4 · xs8 · sm10 · md12 · base16 · lg20 · xl24 · xxl32 · xxxl40 · section-sm48 · section64 · section-lg80 · hero120 |

**문서화된 프리미티브** (design.md `components:`): `button-primary` / `button-buy-cta`(cobalt) / `button-secondary`(outline) / `button-ghost` / `button-pill-tab(+active)` / `button-icon-circular` · `text-input(+focused/error)` · `search-pill` · `radio-option(+selected)` · `color-swatch-circle` · `badge-{promo-yellow/attention/success/critical}` · `card-*` · `footer-region` 등.

### ★ 갭 & 적응 (Meta DS는 커머스용 → SaaS 보강 필수)
1. **카테고리 색이 design.md에 없음.** 와이어프레임의 `cat-gov/vc/lab/tax/fund`는 임의 확장 토큰 → **팀이 정식 정의해야 함**(자격·과제 분류 칩 필수). 정하기 전까지 칩은 `surface-soft` 배경 + `ink` 텍스트로 임시 처리.
2. **SaaS 컴포넌트(DataTable·Kanban·Sidebar·SlideOver·Tabs·앱 셸)는 Meta DS에 없음.** Meta 토큰(색·타이포·radius·spacing) + `badge`·`pill-tab`·`card` 프리미티브를 기반으로 **앱 확장 컴포넌트**로 구현하고, 레이아웃은 와이어프레임을 따른다.
3. **버튼 적응**: Meta는 "cobalt는 buy-now 전용, 마케팅 1차는 검정 pill" 규칙이지만, 본 SaaS엔 구매 플로우가 없다 → **앱 내부 1차 액션은 cobalt pill(`button-buy-cta`)로 통일**, 검정 pill(`button-primary`)은 **랜딩/마케팅 페이지의 1차 CTA에만**.
4. **상태 매핑**: 자격 유효=`success` / 임박=`warning`(또는 `attention`) / 만료=`critical`. D-day 긴급도·과제 단계 배지도 같은 시맨틱 토큰 재사용.
5. **폰트 라이선스 ★**: `Optimistic VF`는 **Meta 비공개 폰트라 사용 불가**. 폴백 체인으로 대체한다 — 라틴: **Inter 또는 Montserrat**, **한글: Noto Sans KR**(한국어 앱이므로 필수). `--font-body`를 이 폴백으로 확정할 것.
6. **다크모드 토큰 없음** — 라이트 단일 테마.

앱 셸(사이드바+상단바)은 **`app/app/layout.tsx` 한 곳**에서만 정의. 화면마다 재구현 금지.

## 6. 와이어프레임 → 화면 매핑 (`/docs/wireframes/`)
| 와이어프레임 파일 | 화면 | 라우트 |
|---|---|---|
| `dashboard__Meta_DS_.html` | 통합 대시보드 | `/app` |
| `company_detail__Meta_DS_.html` | 기업 상세(탭) | `/app/companies/[id]` |
| `mgt_point__Meta_DS_.html` | 관리포인트 보드 | `/app/board` |
| `guide__Meta_DS_.html` | **일괄안내(캠페인)** ※파일명과 다름 | `/app/campaigns` |
| `notification__Meta_DS_.html` | 알림 센터 | `/app/notifications` |
| `settings__Meta_DS_.html` | 설정 | `/app/settings` |
| `landing_page__Meta_DS_.html` | 랜딩 | `/` |
| `login__Meta_DS_.html` | 로그인/회원가입 | `/login`, `/signup` |
| (없음 — 스펙 2-3로 구현) | **기업 목록** | `/app/companies` |

> 와이어프레임은 React+Babel 데모다. **그대로 붙여넣지 말고** 레이아웃·시각 기준으로만 쓰고, Meta DS 토큰으로 프로덕션 Server Component를 재구현한다.

## 7. 데이터 레이어
- 데이터 페치는 **Server Component + Supabase 서버 클라이언트**. 클라이언트 컴포넌트는 상호작용에만.
- 타입: `supabase gen types`로 만든 `Database` 타입 사용. **`any` 금지.**
- **RLS가 tenant 격리를 자동 처리**(`auth_tenant_id()`) → 일반 쿼리에서 `tenant_id` 수동 필터 불필요. 단, **새 테이블 추가 시** `tenant_id` + `enable row level security` + 격리 정책을 반드시 함께 만든다.

### 테이블 요약 (전체는 `/docs/schema.sql`)
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

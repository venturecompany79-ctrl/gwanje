# 모바일 최적화 중심 종합 코드리뷰 (2026-07-02)

> 대상: `main` 기준 전체 코드베이스 (커밋 `bd69aa4`)
> 방법: 5개 영역(모바일 UX / 성능·아키텍처 / 보안·RLS / 코드품질·더미코드 / DB·데이터흐름) 병렬 정밀 리뷰 + `typecheck`·`lint`·`build` 실검증. 모든 발견은 file:line 단위로 코드 확인을 거침.

---

## A. 전체 평가

| 항목 | 점수 | 근거 |
|---|---|---|
| **코드 품질** | **8.5 / 10** | `any`·`@ts-ignore`·디버그 로그·죽은 주석 블록 **0건**, typecheck/lint 무경고 통과, 레이어 분리(data/actions/UI) 일관. 감점: 1,166줄 SettingsView, 슬라이드오버 5중 중복(+접근성 누락), D-day 라벨 4중 구현 |
| **모바일 UX** | **6.5 / 10** | 앱 셸(하단 탭바+safe-area)·대시보드·기업목록·슬라이드오버·랜딩/인증은 상급. 감점: **설정 페이지 모바일 사용 불가(P0)**, 캠페인 마법사 3곳 오버플로, 기업상세 테이블 4곳 카드 미변환, iOS 포커스 줌 입력 7종 |
| **보안** | **7 / 10** | RLS 전 테이블 적용, service-role 서버 격리, 웹훅 HMAC, AES-256-GCM, 오픈 리다이렉트 방어 등 기본기 우수. 감점: **결제 API 4개 라우트 권한 검사 누락**, **레포에 체험계정 평문 비밀번호**, payment_method 컬럼 grant 무력화 |
| **배포 가능 여부** | **조건부 가능** | Vercel(환경변수 설정)에서는 빌드·배포 가능. 단 ① 아래 P0 3건 수정 전 신규 사용자 오픈 비권장 ② 환경변수 없는 CI에서는 `/reset/confirm` 프리렌더로 **빌드 실패**(재현 완료) |

### 가장 위험한 이슈 3개

1. **결제 API 권한 상승** — `app/api/billing/{cancel,confirm,issue,change-card}/route.ts`가 로그인만 확인하고 `billing.manage` 권한을 검사하지 않음. 결제 권한 없는 팀원이 `POST /api/billing/cancel` 호출만으로 테넌트 구독을 취소 가능(입력값 불필요, 즉시 악용 가능).
2. **레포에 커밋된 실계정 자격증명** — `scripts/provision-trial-account.sql:2-20`에 `venturecompany@naver.com` / `admin1234` 평문 존재. 이 계정이 프로덕션에 존재하면 소스 접근자 누구나 로그인 가능.
3. **설정 페이지 모바일 전면 불능** — `.set-grid`(236px 고정 네비, `globals.css:4348`)에 모바일 규칙이 전혀 없어 360px에서 본문 폭이 **약 76px**로 구겨짐. 프로필·알림규칙·팀 관리 전부 모바일에서 조작 불가.

---

## B. 우선순위별 개선 리스트

### P0 — 즉시 수정 (치명)

| # | 이슈 | 위치 |
|---|---|---|
| P0-1 | 결제 API 4개 라우트 `billing.manage` 권한 검사 누락 | `app/api/billing/{cancel,confirm,issue,change-card}/route.ts` |
| P0-2 | 체험계정 이메일·비밀번호(`admin1234`) 평문 커밋 — 값 제거 + 해당 계정 비밀번호 강제 재설정 + git 히스토리 정리 | `scripts/provision-trial-account.sql:2-20` |
| P0-3 | 설정 페이지 `.set-grid` 모바일 규칙 부재 → 모바일 사용 불가 | `globals.css:4348`, `SettingsView.tsx:1115` |

### P1 — 배포 전 수정 권장

**보안·DB**
| # | 이슈 | 위치 |
|---|---|---|
| P1-1 | `payment_method` 테이블에 default privileges로 SELECT가 이미 부여되어 있어, 컬럼 grant로 `encrypted_billing_key`를 숨기려던 의도가 무력화 — authenticated가 암호문 select 가능 | `20260612…:328` vs `20260629…:227-237` |
| P1-2 | 웹훅 시크릿(`TOSS_PAYMENTS_WEBHOOK_SECRET`) 미설정 시 서명 검증이 통째로 생략 — 프로덕션에서 필수화 | `app/api/billing/webhook/toss/route.ts:23-32` |
| P1-3 | `generate_due_notifications()`가 팀 도입(20260630) 후 활성 멤버 수만큼 **중복 알림 생성**, invited/disabled 멤버도 포함 | `20260613000004_due_notifications_cron.sql` |
| P1-4 | `docs/schema.sql` 대규모 드리프트 — todo/task_file/drive/billing/팀 권한/region 미반영, deadline_item 뷰 구버전. CLAUDE.md가 권위 문서로 선언한 파일 | `docs/schema.sql` |

**모바일 UX** (상세는 C절)
| # | 이슈 | 위치 |
|---|---|---|
| P1-5 | 기업상세 자격(7열)·일정(5열)·자료(8열) + 캠페인상세 수신자(5열) 테이블이 `dlist--cards` 미적용 → 360px에서 680px 가로 스크롤 | `CertsTab.tsx:548`, `ScheduleFilesTabs.tsx:170,522`, `campaigns/[id]/page.tsx:101` |
| P1-6 | 캠페인 마법사 3곳 오버플로 — 조건 빌더 `.cond-row`(416px>336px), 스텝 인디케이터 `.steps`(~490px), 발송시점 `.radio-row`(~484px) | `CampaignWizard.tsx:209-233, 259-330, 492-531` |
| P1-7 | Task 탭 행(`.tname` min-width 210px) 오버플로 | `TasksTab.tsx:58-83`, `globals.css:2266` |
| P1-8 | 대시보드 마감패널 헤더 인라인 flex(no-wrap) pill 3개 → 메인 패널 가로 스크롤 | `DeadlinePanel.tsx:32` |
| P1-9 | 설정 `.field-grid` 2열이 640px에서 안 접힘 | `globals.css:4454`, 접힘목록 `6058-6064`에 누락 |
| P1-10 | iOS 포커스 줌 유발 입력 7종(`.search-pill input` 14px, `.memo-input` 14px, `.cond-input` 14px, `.dt-input` 13px, `.todo-draft-date`, `.selbox`, `.select-pill`) | `globals.css:925, 2419, 3697, 4006, 3207, 4563, 5600` |

**성능·안정성**
| # | 이슈 | 위치 |
|---|---|---|
| P1-11 | 미들웨어가 매 요청(prefetch 포함) DB 1~2회 조회(profile status + tenant_subscription) — 레이아웃 `getSubscriptionGate()`와 이중 조회 | `middleware.ts:60-71, 95-110` |
| P1-12 | 요청 1회당 auth/profile 중복 페치 — `/app/board` 첫 로드에 auth 왕복 3회·profile 조회 4회. React `cache()` 미사용 | `lib/supabase/server.ts:16`, `lib/data/{shell,board,todos,settings}.ts` |
| P1-13 | 무제한 목록 쿼리 — companies(기업+**자격 전량**), board(task 전량, 완료 무기한 누적), campaigns(campaign_recipient **전 행**을 JS 집계) | `lib/data/companies.ts:40-56`, `board.ts:36-40`, `campaigns.ts:85-105` |
| P1-14 | 130KB(gzip 22KB) 단일 CSS 전 페이지 렌더블로킹 — 랜딩에 앱 CSS, 앱에 랜딩 CSS 상호 배포 | `app/layout.tsx:4`, `globals.css` |
| P1-15 | 환경변수 없는 빌드에서 `/reset/confirm` 프리렌더 실패(빌드 중단, 재현 완료) — `createClient()`가 렌더 시점 throw | `ResetConfirmForm.tsx:18` |
| P1-16 | 사이드바에 캠페인(일괄안내) 메뉴 부재 — 완성된 화면인데 상시 진입 경로 없음 | `components/shell/Sidebar.tsx:14-20` |

### P2 — 모바일 UX/성능/품질 개선

- **터치 타깃 40px 미만 다수**: `.pill-btn` 32px, `.abtn` 34px, `.todo-check` 22px, `.todo-row-action` 30px, `.lead-day-chip button` **18px**, `.cat-sw` 30px, `.link-btn` 패딩 0 (`globals.css` 각 위치는 C절)
- **알림 행 액션 hover 전용** → 터치에서 발견 불가 + 첫 탭이 의도치 않은 읽음 처리 (`NotificationsView.tsx:119-144`, `globals.css:4294-4302`)
- **토스트가 모바일 하단 탭바(z-index 35 vs 60, bottom 32px)를 가림** (`globals.css:3344`)
- 캠페인 3단계 `.sum-grid` 3열 고정 + `.wz-foot` 3버튼 오버플로
- 대시보드 CSV 버튼 라벨이 360px 2열 그리드에서 돌출 (`ExportButton.tsx:49`)
- `notification` 쓰기 정책이 `notifications.read`로 게이트 — viewer가 알림 생성/삭제 가능 (`20260630…:396-414`)
- `program-matches` 라우트 권한 계층 미명시(RLS가 실질 방어) (`app/api/companies/[id]/program-matches/route.ts:12-20`)
- 문서 스토리지 MIME 허용목록에 `application/octet-stream` — 사실상 임의 파일 (`20260615000001…:18`)
- `getShellData` 레거시 폴백이 owner+전권 기본값 — viewer 기본값으로 전환 (`lib/data/shell.ts:99-111,152-162`)
- **DB**: `campaign_recipient(campaign_id,company_id)`·`category(tenant_id,name)` 유니크 부재 / `campaign_recipient` tenant_id 인덱스 부재 / company_id의 tenant 정합 FK 부재(`addCredential`·`addTask`에 `assertCompanyAccess` 누락 — `addSchedule`은 있음) / 날짜 형식·순서(만료<발급) 서버 검증 부재 / `addCompany` 문서 insert 실패 시 스토리지 고아 파일 / `updateCompany` 성장단계 태그 정규화 누락 / 문서 version 산정 race / '모두 읽음'이 팀 전체 알림에 적용(user_id 부재 — 설계 확인 필요)
- **성능**: `/app/board` 비활성 탭 데이터 동시 페치 / SettingsView 1,166줄 단일 클라이언트 청크 / OCR 자산(unpkg + tesseract CDN, kor traineddata 수 MB)을 외부 CDN 의존 → self-host / `app/app/billing/loading.tsx` 부재 / 루트 `error.tsx`·`not-found.tsx` 부재(영문 기본 화면 노출) / `getShellData` 순차 폴백 최대 4회
- **품질**: 슬라이드오버 5중 중복 + **5곳 모두 ESC 닫기·포커스 트랩 없음**(`aria-modal` 선언과 불일치) → `components/ui/SlideOver.tsx` 프리미티브 통합 / SettingsView 섹션별 분할 / gov-programs 소스 4종 TODO(공공 API 필드 매핑 미검증 — 실키 발급 후 검증 필수) / `verify-migrations.mjs`가 마이그레이션 4개(renewal_merge, normalize_tags, region, credential_link) 미검증
- `CampaignWizard.tsx:244` 세그먼트 규칙 index key → 중간 삭제 시 상태 어긋남

### P3 — 향후 고도화

- 미사용 export 정리: `ComingSoon.tsx`(삭제), `IconSparkle`, `cancelPayment`, `CAMPAIGN_CHANNEL_LABEL`, `MEMBER_STATUSES` 등 + 내부 전용 함수의 `export` 키워드 제거
- D-day 라벨 4중 구현 → `lib/format.ts`의 `formatDday()` 단일화 (`DdayBadge.tsx:5`, `export.ts:14`, `NotificationsView.tsx:63`, `CompaniesTable.tsx:234`)
- `lib/actions/export.ts:62` 무검증 캐스트 → `normalizeDeadlineItems` 재사용 / `company-detail.ts:231` status 가드
- `app/app/companies/**/actions.ts` → `lib/actions/companies.ts` 위치 통일 / `ScheduleFilesTabs.tsx`(588줄) → Schedule/Files 분리
- 칸반 카드에 모바일 "단계 이동" 퀵 액션(현재는 슬라이드오버 경유로 기능은 유지됨)
- 데모 UUID hex 교정(`lib/demo-data.ts`의 `…t2` 등 비16진수 문자)
- 기업목록 서버 페이지네이션(`.range()`), 캠페인 응답률 집계 RPC/뷰 전환
- deadline_item 뷰 not-exists에 `and t.due_date is not null` 방어 추가
- `notification.ref_id` 고아 정리(credential/task 삭제 시)
- 초대 origin을 `x-forwarded-host` 대신 신뢰 env(`NEXT_PUBLIC_SITE_URL`)로 고정

---

## C. 페이지별 모바일 UX 리뷰 (360/390/430/768px)

> 공통 전제(확인됨): viewport 정상(`app/layout.tsx:28`), `body{overflow-x:hidden}`, `.btn/.pill-tab/.select-pill/.prof-btn{min-height:40px}`(`globals.css:5604`). 앱 셸은 1180px 아이콘 레일 → 900px 하단 탭바(safe-area 포함) 전환이 잘 구현되어 있음.

### /app/settings — 심각도 P0
- **문제**: `.set-grid{grid-template-columns:236px 1fr}`(`globals.css:4348`)이 어떤 @media에도 재정의 없음. `.field-grid` 2열도 640px 접힘 목록에 누락.
- **사용자 불편**: 360px에서 본문 컬럼 ~76px — 프로필/알림규칙/분류/Drive/팀 전 섹션 사용 불가.
- **수정**:
```css
@media (max-width: 900px) {
  .set-grid { grid-template-columns: 1fr; }
  .set-nav { position: static; display: flex; overflow-x: auto; padding: 6px; gap: 4px; }
  .set-nav .sn { flex: 0 0 auto; white-space: nowrap; }
  .set-nav .sn.is-active::before { display: none; }
}
/* 640px 접힘 목록(globals.css:6058)에 .field-grid 추가 */
```
- **효과**: 설정 전체가 모바일에서 정상 동작. 알림 lead-day 설정(모바일 사용 빈도 높음) 접근 가능.

### /app/campaigns/new — 심각도 P1
- **문제 3곳**: ① 조건 빌더 `.cond-row` 최소폭 416px(>336px) — 삭제(×) 버튼이 화면 밖 ② 스텝 인디케이터 ~490px ③ 3단계 발송시점 `.radio-row`+datetime-local ~484px. `.sum-grid` 3열·`.wz-foot` 3버튼도 비좁음(P2). `.dt-input` 13px → iOS 줌.
- **사용자 불편**: 캠페인 생성 1단계(대상 정의)와 3단계(발송 확정)가 모바일에서 조작 불가에 가까움 — 핵심 플로우 단절.
- **수정**:
```css
@media (max-width: 640px) {
  .cond-row { flex-wrap: wrap; }
  .cond-row .cond-input { flex: 1 1 calc(50% - 24px); min-width: 0; }
  .step-conn { width: 18px; margin: 0 6px; }
  .step:not(.is-active) .step-label { display: none; }
  .radio-row { flex-direction: column; }
  .dt-input { font-size: 16px; }
  .sum-grid { grid-template-columns: 1fr; }
  .wz-foot { flex-wrap: wrap; }
  .wz-foot .btn { flex: 1 1 auto; }
}
```
- **효과**: 모바일에서 캠페인 작성 전 단계 완주 가능.

### /app/companies/[id] (기업 상세) — 심각도 P1
- **문제**: 자격(7열, `CertsTab.tsx:548`)·일정(5열, `ScheduleFilesTabs.tsx:170`)·자료(8열, `:522`) 테이블이 `dlist--cards` 미적용 → `table.dlist:not(.dlist--cards){min-width:680px}`에 걸려 가로 스크롤. Task 탭은 `.tname{min-width:210px}`로 행 오버플로.
- **사용자 불편**: 컨설턴트가 이동 중 가장 자주 볼 화면(만료일·D-day)이 좌우 스크롤 없이는 안 보임. 대시보드·기업목록은 카드인데 상세만 테이블 — 일관성 붕괴.
- **수정**: 각 `<table className="dlist">` → `"dlist dlist--cards"` + 각 `<td data-label="…">` 부여(기존 카드 CSS 재사용, 행 클릭 동작 유지). Task 탭:
```css
@media (max-width: 640px) {
  .task { flex-wrap: wrap; gap: 10px; }
  .task .tname { min-width: 0; }
  .task > .spacer { display: none; }
}
```
- **효과**: 상세 화면 4개 탭이 세로 카드로 읽힘 — 이 앱의 모바일 핵심 시나리오(외근 중 만료 확인) 완성.

### /app (대시보드) — 심각도 P1(1건)
- **문제**: 마감 패널 헤더가 인라인 `style={{display:"flex",…}}`(no-wrap)에 pill 3개(~420px) → 카드 변환을 해놓고도 패널 가로 스크롤 발생(`DeadlinePanel.tsx:32`). CSV 버튼 라벨 돌출(P2).
- **수정**: 인라인 스타일에 `flexWrap:"wrap"` 추가 또는 준비 중 pill 2개를 640px에서 숨김. CSV 라벨은 모바일 축약("CSV 내보내기").
- **잘된 점**: KPI 4→2→1열, D-day·연체 테이블 카드 변환+data-label 완비, 스켈레톤·빈 상태·데모 배너.

### /app/campaigns/[id] — P1
- 수신자 테이블(5열, `page.tsx:101`) `dlist--cards` 미적용 — 상세 탭들과 동일 수정.

### /app/notifications — P2
- 행 액션 `.n-actions`가 hover/focus-within 전용(`globals.css:4294`) → 터치에서 첫 탭이 곧바로 읽음 처리, 액션 발견 불가.
- **수정**: `@media (hover:none){ .n-actions{display:flex} .n-time{display:none} }` 또는 행 탭=이동, 읽음=명시 버튼으로 분리.

### /app/board — P2
- 업무일지는 640px 전용 밀도 조정까지 완비(양호). 칸반 DnD는 터치 미지원이나 카드 탭→슬라이드오버 단계 라디오로 기능 유지 — 퀵 액션 추가는 P3. `.todo-check` 22px 터치 타깃만 보강 필요.
- 토스트가 하단 탭바를 가림: `@media (max-width:900px){ .toast{ bottom: calc(84px + env(safe-area-inset-bottom)); max-width: calc(100vw - 24px);} }`

### 이슈 없음(모바일 완성도 높음)
- **/app/companies**(카드 변환+필터 풀폭), **/app/companies/new**(1열 접힘+16px 입력+OCR 상태 UI), **/app/billing**(1열 전환), **/**·**/login**·**/reset**·**/signup**(햄버거·1열·16px 입력).

### 공통 — iOS 포커스 줌 일괄 수정 (P1-10)
```css
@media (max-width: 640px) {
  .search-pill input, .memo-input, .cond-input, .dt-input,
  .todo-draft-date, .selbox, .select-pill { font-size: 16px; }
}
```

### 공통 — 터치 타깃 보강 (P2)
```css
@media (max-width: 900px) {
  .pill-btn, .abtn, .todo-row-action, .cat-sw-opt { min-height: 40px; }
  .todo-check { width: 28px; height: 28px; }
  .lead-day-chip button { min-width: 28px; min-height: 28px; }
  .link-btn { padding: 8px 4px; }
}
```

---

## D. 파일별 코드리뷰 (핵심)

### app/api/billing/cancel/route.ts (외 confirm/issue/change-card 동일)
- **문제**: `getTenantContext(supabase)`만 호출 — 로그인·테넌트 확인뿐, `billing.manage` 권한 미검사.
- **왜 문제**: 동일 기능의 서버 액션(`lib/actions/billing.ts:35,70`)은 `requirePermission`을 거침 — UI 경로만 막히고 raw API가 열린 전형적 불일치. cancel은 요청 본문조차 필요 없음.
- **수정**:
```ts
const perm = await requirePermission(supabase, "billing.manage");
if (!perm.ok) {
  return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
}
```

### scripts/provision-trial-account.sql
- **문제**: 실이메일 + `admin1234` 평문. **수정**: 값 제거·`\set` 변수/환경변수화, 기존 계정 비밀번호 재설정, 히스토리 정리(BFG 등).

### supabase/migrations (신규 1건 필요)
```sql
-- 1) payment_method 컬럼 grant 의도 복원
revoke all on payment_method from authenticated;
grant select (id, tenant_id, card_company, card_number_masked, status, created_at)
  on payment_method to authenticated;
revoke insert, update, delete on billing_customer, tenant_subscription,
  payment_transaction, webhook_event from authenticated;

-- 2) 중복 알림 수정: profile JOIN → EXISTS + active 필터
create or replace function generate_due_notifications() ...
  from deadline_item d
  where exists (select 1 from profile p
    where p.tenant_id = d.tenant_id and p.status = 'active'
      and d.days_left = any (p.notify_lead_days))
    and not exists (...);

-- 3) 무결성 제약
alter table campaign_recipient
  add constraint campaign_recipient_uniq unique (campaign_id, company_id);
create unique index category_tenant_name_uniq on category (tenant_id, name);
create index campaign_recipient_tenant_idx on campaign_recipient (tenant_id);

-- 4) notification 쓰기 정책 축소 (viewer가 insert/delete 불가하도록)
```

### app/api/billing/webhook/toss/route.ts:23-32
- **문제**: `if (secret) { verify }` — 미설정 시 무검증 통과. **수정**: `if (isBillingEnabled() && !secret) return 503;`

### middleware.ts:60-110
- **문제**: 매 요청 profile status + (빌링 ON 시) tenant_subscription DB 조회 — 레이아웃 `getSubscriptionGate()`와 이중. 모바일 TTFB에 상시 가산.
- **수정**: 구독 체크는 레이아웃으로 일원화, profile status는 JWT app_metadata 또는 짧은 TTL 쿠키 캐시, prefetch 요청은 스킵.

### lib/supabase/server.ts + lib/data/*.ts
- **문제**: `createClient`/`getUser`/profile 조회가 요청당 최대 4회 중복(`/app/board` 기준 auth 왕복 3회).
- **수정**:
```ts
import { cache } from "react";
export const createClient = cache(async () => { /* 기존 본문 */ });
export const getCurrentProfile = cache(async () => { /* getClaims 기반 */ });
```

### lib/data/campaigns.ts:85-105
- **문제**: `campaign_recipient` 전 행 페치 후 JS 카운트 — 캠페인 누적 시 선형 비대.
- **수정**: `select("campaign_id, total:id.count, responded:responded.sum")` 집계 또는 카운트 뷰/RPC.

### lib/data/board.ts:36-40 / lib/data/companies.ts:40-56
- **문제**: task 전량(완료 무기한 누적) / credential 전 테넌트 전량, limit 없음.
- **수정**: board는 `.neq("stage","result")` + result 최근 N건, 안전판 `.limit(500)`. companies는 upcoming deadline 범위 제한 + `.limit()`.

### app/layout.tsx:4 + app/globals.css
- **문제**: 130KB(gzip 22KB) 단일 CSS가 랜딩 포함 전 페이지 렌더블로킹.
- **수정**: `.lp-*` 랜딩 블록(~1,700줄) → 랜딩 세그먼트 CSS로, 앱 대형 블록 → `app/app/` 레이아웃 CSS로 분리. 토큰·프리미티브만 루트 유지.

### app/reset/confirm/ResetConfirmForm.tsx:18
- **문제**: 렌더 시점 `createClient()` → env 없는 빌드에서 프리렌더 throw(빌드 실패 재현).
- **수정**: `useState(() => { try { return createClient(); } catch { return null; } })` 또는 페이지에 `export const dynamic = "force-dynamic"`.

### components/shell/Sidebar.tsx:14-20
- **문제**: 완성된 `/app/campaigns` 화면으로 가는 상시 내비게이션 부재. **수정**: NAV_ITEMS에 일괄안내 항목 추가(하단 탭바 6개 폭은 420px 규칙이 이미 수용).

### app/app/companies/[id]/actions.ts:306 (addCredential) / lib/actions/tasks.ts:168 (addTask)
- **문제**: `addSchedule`과 달리 `assertCompanyAccess` 미호출 — 타 테넌트 company_id로 행 생성 가능(조회는 RLS 차단, 무결성·UUID 탐지 이슈).
- **수정**: 두 액션에 `assertCompanyAccess` 추가 + D절 마이그레이션의 복합 FK로 DB 수준 봉인.

### 슬라이드오버 5개 파일 (TaskSlideOver×2, EditCompanySlideOver, CertsTab, ScheduleFilesTabs)
- **문제**: 동일 골격 5중 복제 + **전부 ESC 닫기·포커스 트랩 없음**(`role="dialog" aria-modal` 선언과 불일치).
- **수정**: `components/ui/SlideOver.tsx` 프리미티브 신설(ESC/포커스 트랩/바디 스크롤 잠금 내장) 후 5곳 치환.

### app/app/settings/_components/SettingsView.tsx (1,166줄)
- **문제**: 5개 섹션+12개 내부 컴포넌트가 단일 클라이언트 청크. **수정**: 섹션별 파일 분할 + `next/dynamic`(특히 Team/Drive).

### CompanyIntakeForm.tsx:153,183 (OCR)
- **문제**: pdf.worker를 unpkg, tesseract core/kor traineddata(수 MB)를 jsdelivr에서 런타임 로드 — 모바일 대용량 다운로드 + CDN 장애·CSP 리스크. (지연 로딩 자체는 모범적)
- **수정**: `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` self-host, tesseract `corePath`/`langPath`를 `public/`로.

---

## E. 보안 체크리스트

| 영역 | 상태 | 비고 |
|---|---|---|
| 인증(미들웨어) | ✅ | `/app/*` 보호, 세션 리다이렉트 정상. 데모 모드는 `NODE_ENV=development && !Vercel`로만 활성 — 프로덕션 우회 불가 |
| 인가(서버 액션) | ✅ | 전 액션 `requirePermission`/`getTenantContext`, owner 최후 1인 보호 포함 |
| 인가(API 라우트) | ❌ **P0** | billing 4개 라우트 권한 미검사 / program-matches 권한 계층 미명시(P2) / cron 2종은 Bearer+503 안전 실패 ✅ |
| RLS | ✅(1건 예외) | 전 테이블 RLS+테넌트 정책, `deadline_item` security_invoker. 예외: notification 쓰기 정책이 read 권한으로 게이트(P2) |
| tenant_id/user_id 검증 | ⚠️ | service-client 사용처는 전부 tenant 재대조 ✅. 단 addCredential/addTask가 company 소속 미검증(P2), company_id 복합 FK 부재 |
| 환경변수 | ✅(1건 예외) | NEXT_PUBLIC 3종 모두 정당한 공개값, service key 서버 전용. 예외: **레포 내 평문 계정(P0)** |
| 웹훅/암호화 | ⚠️ | HMAC+timingSafeEqual, AES-256-GCM, 멱등 적재 ✅. 시크릿 미설정 시 무검증(P1), payment_method grant 무력화(P1) |
| 입력값 검증 | ✅(보강 여지) | enum 화이트리스트·숫자 가드·경로 접두사 검증 ✅. 날짜 형식/순서 미검증(P2), octet-stream MIME(P2) |
| XSS / 리다이렉트 | ✅ | `dangerouslySetInnerHTML` 1곳(화이트리스트 색상값), login redirect path-only 검증 |
| 크로스 테넌트 접근 | ✅ | RLS로 조회 차단 확인. 쓰기 측 무결성만 보강 필요(위 항목) |

---

## F. 더미코드 제거 리스트

| 파일 | 내용 | 삭제? | 방향 |
|---|---|---|---|
| `lib/demo-data.ts` (736줄) | 로컬 데모 폴백 픽스처. 프로덕션 노출 불가 구조 확인됨(`!supabase`일 때만, Vercel에서는 env 누락 시 에러) | 유지 | 비16진수 UUID(`…t2` 등)만 hex 교정 |
| `lib/gov-programs/demo-data.ts` | 공고 데모 5건 | 유지 | 동일 폴백 |
| `lib/data/shell.ts:105-111` | 구스키마 폴백 — 성공 시 **owner+전권 부여** | **마이그레이션 정착 후 삭제** | 그 전까지 기본값을 viewer/빈 권한으로 |
| `components/shell/ComingSoon.tsx` | 어디서도 import 안 됨(전수 확인) | **삭제** | — |
| `components/ui/icons.tsx:296 IconSparkle`, `lib/billing/toss.ts:138 cancelPayment`, `CAMPAIGN_CHANNEL_LABEL`, `MEMBER_STATUSES`, `SOURCE_CODES` | 미사용 export | 삭제 | cancelPayment는 환불 티켓과 연결 후 결정 |
| `lib/gov-programs/sources/{bizinfo,kstartup,smes,msit}.ts` TODO 4건 | 공공 API 필드 매핑이 실키 발급 전 추정치 | 유지 | **API 키 승인 후 실응답으로 필드 검증**(미검증 sync ON 금지 — env 게이트 유지) |
| `scripts/provision-trial-account.sql` | 실계정 자격증명 | **즉시 제거** | 변수화 + 계정 비밀번호 재설정 |
| 하드코딩 테스트 계정/이메일/UUID, console.log, 주석 코드 | **0건** (console.error/info는 정상 운영 로깅) | — | `scripts/audit-test-data.mjs`로 운영 DB 테스트 행 정리만 병행 |

---

## G. 실제 수정 실행 계획

### 1단계 — 모바일 UI 필수 수정 (CSS 위주, 반나절)
1. `.set-grid` 모바일 규칙 (P0-3) + `.field-grid` 접힘
2. iOS 줌 입력 7종 16px 일괄 (P1-10)
3. 기업상세·캠페인상세 테이블 4곳 `dlist--cards`+`data-label` (P1-5)
4. 캠페인 마법사 오버플로 3곳+sum-grid/wz-foot (P1-6)
5. Task 탭 행 wrap (P1-7), 대시보드 헤더 flexWrap (P1-8)
6. 토스트 위치, 터치 타깃 보강, 알림 hover 액션 (P2)
7. 사이드바 캠페인 메뉴 (P1-16)

### 2단계 — 보안/RLS/권한 (마이그레이션 1건 + 라우트 4건, 반나절)
1. billing 라우트 4개 `requirePermission` (P0-1)
2. provision-trial-account.sql 자격증명 제거 + 계정 비밀번호 재설정 (P0-2)
3. 신규 마이그레이션: payment_method grant 회수 / generate_due_notifications 수정 / campaign_recipient·category 유니크 / notification 쓰기 정책 축소 (P1-1,3 + P2)
4. 웹훅 시크릿 필수화 (P1-2), addCredential/addTask에 `assertCompanyAccess`

### 3단계 — 코드 정리·더미 제거 (반나절)
1. ComingSoon 등 미사용 export 정리, D-day 라벨 통합
2. SlideOver 프리미티브 통합(+ESC/포커스 트랩)
3. companies actions 위치 통일, export.ts 캐스트 정리
4. docs/schema.sql 재생성(마이그레이션 기준), verify-migrations.mjs에 누락 4건 추가

### 4단계 — 성능 최적화 (1일)
1. 미들웨어 DB 조회 제거/캐시 + 구독 체크 일원화 (P1-11)
2. React `cache()`로 auth/profile 요청 단위 memoize (P1-12)
3. board/companies/campaigns 쿼리 한도·집계 전환 (P1-13)
4. 랜딩 CSS 분리 (P1-14), SettingsView 분할, OCR 자산 self-host
5. billing loading.tsx, 루트 error/not-found 추가

### 5단계 — 배포 전 QA
1. `/reset/confirm` 프리렌더 수정 (P1-15) 후 env 없는 클린 빌드 통과 확인
2. `npm run typecheck && npm run lint && npm run build` (현재 typecheck/lint 통과 확인됨)
3. `npm run verify:migrations`(누락 4건 추가 후) + `npm run audit:test-data`로 운영 DB 테스트 행 정리
4. 실기기 검증: iPhone SE(375px)·갤럭시(360px)·태블릿(768px)에서 설정→캠페인 작성→기업상세 탭 3대 플로우
5. Vercel 환경변수 체크리스트: `TOSS_PAYMENTS_WEBHOOK_SECRET`, `CRON_SECRET`, 암호화 키 2종, Supabase Auth Redirect 허용목록

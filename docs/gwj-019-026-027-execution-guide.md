# GWJ-019/026/027 실행 가이드

작성일: 2026-06-19  
대상 이슈: GWJ-019 전체 스켈레톤 재로딩, GWJ-026 전역 검색 입력 피드백, GWJ-027 테스트 데이터 잔존

## 1. 실행 원칙

이 세 작업은 서로 성격이 다르다. 안전한 순서는 다음으로 고정한다.

1. **GWJ-027 데이터 정리 준비**: 운영 DB를 수정하지 않고 read-only 후보 리포트만 만든다.
2. **GWJ-026 검색 UX 1차 개선**: 자동완성 없이 "Enter로 검색" 피드백을 먼저 제공한다.
3. **GWJ-019 성능 구조 개선**: 캐시/PPR을 바로 켜지 말고, 측정과 캐시 정책 가이드부터 적용한다.

공통 금지사항:

- 운영 DB에서 `delete`, `update`, `truncate`를 임의 실행하지 않는다.
- `force-dynamic`을 일괄 제거하지 않는다.
- tenant/user/session 의존 데이터를 `unstable_cache`, `revalidate`, ISR, PPR static shell에 무심코 태우지 않는다.
- Supabase RLS가 있더라도, 캐시 계층에서 tenant 간 응답이 공유될 수 있는 구조를 만들지 않는다.

필수 사전 검증:

```bash
npm run typecheck
npm run lint
npm run verify:migrations
```

현재 프로젝트 기준:

- Next.js는 `15.5.x` 라인이다. Next 15의 PPR은 experimental이므로 운영 기본 전략으로 삼지 않는다.
- `/app` 하위 주요 라우트는 `dynamic = "force-dynamic"`이다.
- 서버 Supabase client는 `cookies()`를 사용하므로 요청/세션 의존이다.
- `app/app/layout.tsx`가 profile, tenant, unread notification을 읽어 앱 셸을 만든다.

## 2. GWJ-027 데이터 정리 실행 가이드

목표: 테스트/데모 흔적을 바로 지우는 것이 아니라, 운영자가 승인할 수 있는 후보 목록과 영향 범위를 만든다.

1차 산출물:

- `scripts/audit-test-data.mjs` 또는 SQL 리포트
- 후보 CSV/콘솔 출력
- 정리 승인표

후보 탐지 기준:

- 과제명, 기업명, 메모, 알림 제목에 `테스트`, `test`, `샘플`, `demo`, `fixture`가 포함된 행
- 유사 중복 기업명: 공백/괄호/대소문자 제거 후 같은 이름
- 사업자번호가 같은 기업
- 시드 데이터로 보이는 기업/과제/알림

read-only SQL 예시:

```sql
-- 테스트성 과제 후보
select id, tenant_id, company_id, title, stage, due_date, created_at
from task
where title ilike '%테스트%'
   or title ilike '%test%'
   or memo ilike '%테스트%'
   or memo ilike '%test%'
order by created_at desc;

-- 유사 중복 기업 후보
with normalized as (
  select
    id,
    tenant_id,
    name,
    biz_no,
    regexp_replace(lower(name), '[^0-9a-z가-힣]', '', 'g') as name_key,
    regexp_replace(coalesce(biz_no, ''), '\D', '', 'g') as biz_no_key
  from company
)
select tenant_id, name_key, count(*) as n, array_agg(id) as company_ids, array_agg(name) as names
from normalized
where name_key <> ''
group by tenant_id, name_key
having count(*) > 1
order by n desc, name_key;

-- 같은 사업자번호 후보
with normalized as (
  select
    id,
    tenant_id,
    name,
    regexp_replace(coalesce(biz_no, ''), '\D', '', 'g') as biz_no_key
  from company
)
select tenant_id, biz_no_key, count(*) as n, array_agg(id) as company_ids, array_agg(name) as names
from normalized
where biz_no_key <> ''
group by tenant_id, biz_no_key
having count(*) > 1
order by n desc, biz_no_key;
```

영향 범위 리포트에는 각 후보 company 기준으로 아래 counts를 포함한다.

- `credential`
- `task`
- `schedule`
- `document`
- `campaign_recipient`
- `notification`

승인표 컬럼:

- `candidate_type`: test_task, duplicate_company, seed_data 등
- `record_type`: company, task 등
- `record_id`
- `display_name`
- `linked_counts`
- `recommended_action`: keep, rename, merge, delete
- `approved_action`
- `approved_by`
- `approved_at`

삭제/수정 실행은 별도 승인 후 진행한다. 기본 권장 조치는 다음이다.

- 명백한 테스트 task: 삭제보다 제목 수정 또는 완료 처리 우선 검토
- 중복 company: 삭제보다 병합 기준 company 지정 후 연결 데이터 이전
- seed/demo 데이터: 운영 사용자가 실제로 쓰기 시작했다면 보존 또는 이름 수정

완료 기준:

- 운영 DB 변경 없이 후보 리포트가 생성된다.
- 각 후보의 연결 데이터 영향 범위가 보인다.
- 삭제/수정 SQL은 승인 전 실행되지 않는다.

## 3. GWJ-026 전역 검색 UX 실행 가이드

목표: 큰 구조 변경 없이 입력 중 피드백을 제공해 검색 동작을 예측 가능하게 만든다.

1차 범위:

- 현재 `components/shell/Topbar.tsx`의 GET form 구조 유지
- 자동완성 API/route handler 추가 없음
- 입력창 옆 또는 아래에 `Enter로 검색` 힌트 제공
- `aria-describedby`로 스크린리더 힌트 연결
- 모바일에서도 레이아웃이 깨지지 않도록 CSS 확인

권장 구현 방향:

- Topbar 전체를 Client Component로 바꾸지 않는다.
- 정적 힌트만 추가하면 Server Component로 유지 가능하다.
- 동적 focus 피드백이 필요하면 검색 폼만 작은 Client Component로 분리한다.
- 검색 실행은 계속 `/app/companies?q=...`로 이동하게 둔다.

2차 자동완성은 별도 이슈로 분리한다.

자동완성 도입 전 필요한 결정:

- 최소 입력 글자 수: 기본 2자
- debounce: 기본 200-300ms
- 결과 개수: 기본 5개
- 검색 대상: 기업명 우선, 업종 보조
- 데이터 경로: RLS 적용된 route handler 또는 Server Action
- 빈 결과/로딩/오류 UI
- 키보드 접근성: ArrowUp/ArrowDown/Enter/Escape
- 모바일 드롭다운 위치

완료 기준:

- 사용자가 입력 중 검색 실행 방법을 알 수 있다.
- Enter 제출 시 기존 `/app/companies?q=` 흐름이 유지된다.
- JS 실패 시에도 기본 form 검색이 동작한다.
- `npm run typecheck`, `npm run lint`가 통과한다.

수동 QA:

1. `/app`에서 상단 검색 입력에 포커스한다.
2. 힌트가 보이거나 placeholder/보조문구로 검색 방법이 명확한지 확인한다.
3. 기업명을 입력하고 Enter를 누른다.
4. `/app/companies?q=<검색어>`로 이동하고 목록 필터가 적용되는지 확인한다.
5. 모바일 폭에서 검색창, 알림, 프로필 영역이 겹치지 않는지 확인한다.

## 4. GWJ-019 성능/구조 실행 가이드

목표: "스켈레톤이 매번 크게 보이는 체감"을 줄이되, tenant 데이터 격리와 신선도를 해치지 않는다.

### 4.1 먼저 측정한다

개선 전 baseline을 남긴다.

권장 측정 항목:

- route별 TTFB
- `/app` -> `/app/companies` -> `/app/board` 이동 시 loading UI 노출 시간
- Supabase 쿼리 수
- 가장 느린 데이터 로더
- mutation 후 관련 화면 갱신 시간

측정 대상 라우트:

- `/app`
- `/app/companies`
- `/app/companies/[id]`
- `/app/board`
- `/app/campaigns/new`
- `/app/notifications`
- `/app/settings`

로컬 확인 명령:

```bash
npm run build
npm run start
```

브라우저에서 Network 탭으로 document/RSC 요청 시간을 기록한다. 운영/Preview에서는 Vercel 로그와 Supabase query/log explorer도 함께 본다.

### 4.2 캐시 정책을 먼저 고정한다

캐시 금지:

- `profile`
- `tenant`
- `notification` unread count
- `company`
- `credential`
- `task`
- `schedule`
- `document`
- `campaign`
- `campaign_recipient`
- `deadline_item`
- Supabase Storage signed URL

캐시 가능 후보:

- 정적 라벨 매핑
- 화면 copy/static config
- 공개 랜딩 정적 콘텐츠
- 빌드 산출물, 이미지, CSS, JS

request 안에서 dedupe만 허용 가능한 것:

- 같은 render pass에서 반복 호출되는 `getTenantContext`
- 같은 render pass에서 중복되는 profile/tenant 조회

주의:

- `revalidate = 60` 같은 route-level ISR은 tenant 데이터 페이지에 적용하지 않는다.
- `unstable_cache`를 쓰려면 key에 tenantId/userId가 들어가야 하지만, 세션 쿠키 기반 Supabase client와 섞으면 위험하다. 운영 적용 전 별도 PoC가 필요하다.
- Server Action의 `revalidatePath("/app", "layout")`는 앱 하위 전체를 넓게 무효화한다. 정확한 갱신 범위로 줄일 수 있는지 별도 검토한다.

### 4.3 1차 개선 범위

PPR/ISR 대신 체감 개선부터 한다.

권장 작업:

- 앱 셸이 매 라우트 전환 때 blocking 되는지 확인한다.
- route-level `loading.tsx`가 너무 큰 전체 스켈레톤을 보여주는 페이지는 실제 화면 구조에 맞춘 작은 fallback으로 줄인다.
- `getDashboardData`, `getCompaniesData`, `getSegmentCompanies`에서 불필요한 전량 조회를 줄인다.
- `deadline_item.days_left` 필터는 가능하면 `due_date` 범위 필터로 바꿔 인덱스 활용성을 높인다.
- 동일 화면 내 독립 패널은 Suspense boundary로 쪼개서 먼저 그릴 수 있는 영역과 늦게 오는 영역을 분리한다.

우선 후보:

- `/app`: KPI, deadline panel, widgets를 분리 검토
- `/app/companies`: 기업 목록 전량 조회 + credential/deadline 전량 조회 최적화
- `/app/campaigns/new`: 세그먼트 대상 전량 로드의 규모 제한 또는 검색식 전환 검토

### 4.4 PPR은 별도 실험 브랜치에서만 한다

Next 15에서 PPR을 실험하려면 다음 조건이 필요하다.

- `next.config.ts`에 experimental PPR 설정
- 대상 segment에 `experimental_ppr`
- dynamic 데이터 접근 컴포넌트는 Suspense로 감싸기
- build/runtime 검증
- tenant A/B 계정으로 데이터 누수 확인

운영 반영 조건:

- PPR shell에 tenant/user 데이터가 포함되지 않음
- 로그인 전/후 shell 차이가 보안상 문제가 없음
- 세션 만료/로그아웃 후 개인 데이터가 shell/cache에 남지 않음
- Vercel Preview에서 cold start와 navigation이 실제로 개선됨

PPR은 이 이슈의 1차 완료 조건에 포함하지 않는다.

완료 기준:

- 개선 전/후 측정값이 문서화된다.
- tenant 데이터에 persistent cache를 적용하지 않는다.
- route 이동 시 스켈레톤 노출이 줄거나, 최소한 앱 셸이 안정적으로 유지된다.
- mutation 후 관련 화면의 count/list가 stale하게 남지 않는다.
- `npm run typecheck`, `npm run lint`, `npm run build`가 통과한다.

## 5. 권장 작업 순서 체크리스트

### Step 0. 준비

- [ ] 새 브랜치를 만든다.
- [ ] `npm run typecheck`, `npm run lint`, `npm run verify:migrations`를 실행한다.
- [ ] 운영 DB를 건드리는 작업은 제외한다고 명시한다.

### Step 1. GWJ-027 리포트

- [ ] read-only 후보 탐지 스크립트 또는 SQL을 만든다.
- [ ] 후보별 연결 데이터 count를 출력한다.
- [ ] 승인표 양식을 만든다.
- [ ] 운영 DB 변경 없이 리포트만 확인한다.

### Step 2. GWJ-026 1차 UX

- [ ] Topbar 검색 폼에 `Enter로 검색` 피드백을 추가한다.
- [ ] GET form 동작을 유지한다.
- [ ] 접근성 속성을 연결한다.
- [ ] 데스크톱/모바일 레이아웃을 확인한다.

### Step 3. GWJ-019 baseline

- [ ] route별 측정값을 남긴다.
- [ ] 앱 셸 blocking 여부를 확인한다.
- [ ] 넓은 `revalidatePath` 호출 목록을 정리한다.
- [ ] tenant 데이터 캐시 금지 목록을 PR 설명에 포함한다.

### Step 4. GWJ-019 1차 개선

- [ ] 전량 조회/불필요 조회부터 줄인다.
- [ ] 필요한 곳만 Suspense boundary를 추가한다.
- [ ] route-level loading UI가 과도하면 축소한다.
- [ ] PPR/ISR은 적용하지 않는다.

### Step 5. 최종 검증

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 실제 Supabase 데이터 모드에서 `/app`, `/companies`, `/board`, `/campaigns/new` 수동 QA
- [ ] tenant A/B가 있다면 RLS/캐시 누수 확인

## 6. PR 작성 가이드

PR 설명에는 아래를 반드시 포함한다.

- 어떤 이슈를 해결했는지
- 운영 DB 변경 여부: 기본값 `없음`
- 캐시 정책 변경 여부
- tenant 데이터가 캐시되지 않음을 어떻게 확인했는지
- 성능 측정 전/후 값
- 수동 QA 결과
- 남겨둔 후속 작업: 자동완성, PPR PoC, 승인 후 데이터 정리 등

PR 체크 문구:

```md
## Safety
- [ ] 운영 DB destructive query 없음
- [ ] tenant/user/session 데이터 persistent cache 없음
- [ ] RLS 우회 없음
- [ ] Supabase signed URL 캐시 없음

## Verification
- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm run build
- [ ] 실제 데이터 모드 수동 QA
```


# GWJ-019 성능/구조 — 1차 개선 노트

작성일: 2026-06-19 · 대상: 페이지 이동 시 전체 스켈레톤 재로딩 체감

## 안전 원칙 (이번 PR에서 지킨 것)

- `force-dynamic` 일괄 제거 **안 함**.
- tenant/user/session 의존 데이터에 persistent cache(`unstable_cache`, route `revalidate`, ISR, PPR static shell) **적용 안 함**.
- Supabase signed URL 캐시 **없음**.
- RLS 우회 **없음**.
- 운영 DB 변경 **없음**.

## 1차에서 적용한 변경

- `getCompaniesData`의 `company` 조회를 `select("*")` → 목록에 필요한 컬럼만 선택으로 축소
  (`id, name, industry, founded_date, revenue, headcount, condition_tags, created_at`).
  - 효과: 미사용 컬럼(memo, biz_no, contact_* 등) 전송 제거 → payload·직렬화 비용 감소.
- `getSegmentCompanies`는 이미 명시 컬럼만 조회(추가 변경 없음).
- `getShellData`는 이미 3개 병렬 최소 쿼리(추가 변경 없음).

## 2차에서 적용한 변경 — 대시보드 Suspense 스트리밍 (부분 로딩)

`getDashboardData` 단일 로더를 3개로 분리하고 `/app`을 Suspense 경계로 쪼갰다.

- `getDashboardKpi()` — 카운트 4종(head count) + 가장 시급 1건(limit 1) 만. **page에서 await** → 헤드/KPI 즉시 렌더.
- `getDashboardDeadlines(filter)` — 마감 패널(다가오는 + 기한 지남). `<Suspense fallback={DeadlinePanelSkeleton}>`로 스트리밍.
- `getDashboardActivity()` — 우측 위젯(알림 + 자료). `<Suspense fallback={WidgetsSkeleton}>`로 스트리밍.

효과: 라우트 진입 시 **전체 스켈레톤이 아니라** 헤드·KPI는 바로 보이고, 무거운 마감 목록/위젯만 자리표시자(skeleton) 후 채워진다. 캐시는 도입하지 않았으므로 데이터 신선도·tenant 격리는 그대로다. 두 패널은 서로 독립적으로 그려진다.

검증: `npm run build` 성공, `/app` First Load JS 109 kB(증가 없음).

## 3차에서 적용한 변경 — 쿼리 최적화

- **② deadline_item: `days_left` 필터 → `due_date` 범위 필터 (적용 완료)**
  - 대시보드 KPI 카운트(due7/expire30)·마감 패널·기한지남·헤드라인 쿼리에서 계산 컬럼(`days_left`) 필터를 `due_date` 범위로 교체.
  - 경계는 `lib/datetime`의 `todayKstDate()` + `shiftDateString()`로 계산 — 뷰의 `(now() at time zone 'Asia/Seoul')::date`와 **동일 규칙**(off-by-one 없음).
  - 등가: `days_left>=0 ⟺ due_date>=today`, `<=7 ⟺ <=today+7`, `<0 ⟺ <today`. 표시용 `days_left`는 그대로 반환.
  - 효과: 계산 컬럼 대신 실제 `due_date`로 필터 → 인덱스 활용성 향상.
- **③ `/app/board` `task.select("*")` → 필요한 8개 컬럼만** (`id, title, category_id, stage, due_date, assignee_id, memo, company_id`).

## revalidatePath 감사 (넓은 무효화 점검)

| 위치 | 호출 | 판정 |
|---|---|---|
| settings.updateProfile / updateNotifyRules | `revalidatePath("/app","layout")` | **정당** — 셸이 profile 이름·발신정보·알림 규칙 의존 |
| notifications(mark read/all) | `revalidatePath("/app","layout")` | **정당** — 셸 상단 미읽음 배지 갱신 필요 |
| companies/tasks/todos/campaigns | 경로 단위(`/app/companies`, `/app/board` 등) | 적정 범위 |

결론: 현재 layout-wide 무효화는 셸 표시 데이터(이름·미읽음 수) 때문에 필요한 것으로, 축소 시 배지/이름이 stale해진다. 변경하지 않음.

## ① 측정 절차 — 다른 라우트 Suspense 확장 전 게이트 (Vercel Preview)

> **확인 항목**: 아래 측정을 Preview에서 수행해 표를 채운 뒤에 `/app/companies`·`/app/board` 등으로 Suspense를 확장한다.
> 코드 변경 없이 "측정 → 판단" 단계이며, 샌드박스가 아닌 실제 Preview/운영 데이터에서 본다.

측정 방법(택1):
- Vercel **Preview 배포** URL에서 직접 이동하며 측정(권장 — 실제 cold start/네트워크 반영).
- 로컬 프로덕션 모드: `npm run build && npm run start`.

브라우저 DevTools → Network 탭에서 **document 요청 + 이어지는 RSC 요청**의 시간과 loading UI 노출 시간을 기록한다(스트리밍 확인은 Network의 "Waterfall"에서 RSC chunk가 나눠 도착하는지 본다).

| 라우트 이동 | TTFB | RSC 응답 시간 | loading 노출 시간 | 비고 |
|---|---|---|---|---|
| `/app` 첫 진입(cold) | | | | KPI 즉시/패널 스트리밍 확인 |
| `/app` → `/app/companies` | | | | |
| `/app/companies` → `/app/board` | | | | |
| `/app/companies` → `/app/companies/[id]` | | | | |
| `/app/campaigns/new` 진입 | | | | 세그먼트 전량 로드 규모 확인 |

Supabase Dashboard → Logs/Query에서 라우트별 쿼리 수·가장 느린 로더도 함께 기록한다.

**판단 기준(확장 여부)**: 특정 라우트의 loading 노출이 길고 패널이 분리 가능하면 그 라우트에만 `/app`과 동일한 패널 단위 Suspense를 적용한다. 측정값이 충분히 빠르면 확장하지 않는다(불필요한 복잡도 회피).

## 후속 작업 / 보류 결정 (2026-06-21)

- ~~`/app` 대시보드 패널 단위 Suspense 분리~~ → **2차 적용 완료**.
- ~~`deadline_item.days_left` → `due_date` 범위 필터~~ → **3차 적용 완료**.
- ~~`/app/board` `task.select("*")` 축소~~ → **3차 적용 완료**.
- **① 다른 라우트 Suspense 확장**: 위 "측정 절차"를 Preview에서 수행해 표를 채운 뒤 라우트별로 판단(측정이 선행 게이트). 지금은 확장하지 않음.
- **④ 전역 검색 자동완성**: **보류**. 기업 수가 충분히 늘어난 뒤 별도 이슈로 진행(현재는 GWJ-026 'Enter로 검색' 정적 힌트로 충분). 도입 시 결정 항목은 `docs/gwj-019-026-027-execution-guide.md` §3 참조(최소 글자수·debounce·RLS route handler·키보드 접근성 등).
- **⑤ PPR(Partial Prerendering)**: **보류**. Next 16 업그레이드 또는 PPR 공식 안정화 후 **실험 브랜치에서 PoC만** 진행. tenant A/B 데이터 누수 검증 통과 전 운영 미적용. 1차 완료 조건에 미포함.
- route-level `loading.tsx` 과대 fallback 축소 / 앱 셸 blocking 완화는 측정값을 본 뒤 필요 시.

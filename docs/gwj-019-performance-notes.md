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

## revalidatePath 감사 (넓은 무효화 점검)

| 위치 | 호출 | 판정 |
|---|---|---|
| settings.updateProfile / updateNotifyRules | `revalidatePath("/app","layout")` | **정당** — 셸이 profile 이름·발신정보·알림 규칙 의존 |
| notifications(mark read/all) | `revalidatePath("/app","layout")` | **정당** — 셸 상단 미읽음 배지 갱신 필요 |
| companies/tasks/todos/campaigns | 경로 단위(`/app/companies`, `/app/board` 등) | 적정 범위 |

결론: 현재 layout-wide 무효화는 셸 표시 데이터(이름·미읽음 수) 때문에 필요한 것으로, 축소 시 배지/이름이 stale해진다. 변경하지 않음.

## 측정 방법 (운영자가 Preview에서 수행)

```bash
npm run build && npm run start
```

브라우저 Network 탭에서 다음 라우트 이동의 document/RSC 요청 시간과 loading UI 노출 시간을 기록한다.

| 라우트 이동 | TTFB(전) | loading 노출(전) | TTFB(후) | loading 노출(후) |
|---|---|---|---|---|
| `/app` → `/app/companies` | | | | |
| `/app/companies` → `/app/board` | | | | |
| `/app/companies` → `/app/companies/[id]` | | | | |
| `/app` 첫 진입(cold) | | | | |

Supabase query/log explorer에서 라우트별 쿼리 수·가장 느린 로더도 함께 본다.

## 후속 작업 (이번 1차 범위 밖 — 측정 후 별도 PR)

- `/app` 대시보드를 KPI / 마감 패널 / 위젯 단위 Suspense boundary로 분리해 먼저 그릴 영역과 늦게 오는 영역 분리.
- `deadline_item.days_left` 필터를 `due_date` 범위 필터로 전환(KST today 기준)해 인덱스 활용성 향상 — 경계(off-by-one) 검증 필요.
- route-level `loading.tsx`가 과대한 페이지는 실제 구조에 맞춘 작은 fallback으로 축소.
- 앱 셸 blocking 완화: 셸을 즉시 렌더하고 children을 스트리밍하는 구조 검토(캐시 없이).
- PPR PoC는 실험 브랜치에서만(tenant A/B 누수 검증 통과 시에만 운영 검토).

# 관제 (Compliance Desk)

한 명의 경영컨설턴트가 다수의 중소기업을 동시에 관리하며 인증·정부지원·융자의 **만료/마감을 통합 관제**하는 B2B SaaS. 현재 단계: **단일 컨설턴트 MVP**.

- 프로젝트 헌법: [CLAUDE.md](CLAUDE.md)
- 권위 문서: [docs/design.md](docs/design.md) · [docs/schema.sql](docs/schema.sql) · [docs/화면설계_기획자료.md](docs/화면설계_기획자료.md) · `docs/wireframes/`

## 개발전략 (화면 단위 세션 진행)

| 순서 | 작업 | 상태 |
|---|---|---|
| 0 | 기반: 토큰 포팅(globals.css) · 폰트 폴백(Inter+Noto Sans KR) · 앱 셸 · UI 프리미티브 · 스키마/시드 · 미들웨어 · 데이터 레이어 | ✅ 완료 |
| 1 | 통합 대시보드 `/app` (KPI + D-day 리스트 + 위젯, 로딩/빈/에러 상태) | ✅ 완료 (캘린더·칸반 뷰는 후속) |
| 2 | 기업 목록 `/app/companies` (데이터 테이블 + 기업 추가) | ✅ 완료 |
| 3 | 기업 상세 `/app/companies/[id]` (탭 + 슬라이드오버) | ⬜ |
| 4 | 관리포인트 보드 `/app/board` (4단계 칸반 + DnD) | ⬜ |
| 5 | 일괄안내 `/app/campaigns` (목록 + 3스텝 마법사 + 집계) | ⬜ |
| 6 | 알림 센터 `/app/notifications` | ⬜ |
| 7 | 설정 `/app/settings` | ⬜ |
| 8 | 로그인 고도화 / 랜딩 풀버전 `/` | ⬜ (최소 버전 동작 중) |

원칙: **한 세션에 한 화면, 커밋도 화면 단위.** 각 화면의 입력 3종 = 와이어프레임 + 화면설계 스펙 + 데이터 바인딩(스키마).

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # PR 전 필수
npm run lint
```

### 데모 모드 vs 실제 데이터

- `.env.local` 없이 실행하면 **데모 모드**: 로그인 없이 `/app` 접근 가능, 와이어프레임 시나리오 데이터 표시 (상단에 데모 배너).
- 실제 데이터 연결:
  1. Supabase 프로젝트 생성 → SQL Editor에서 `docs/schema.sql` 실행
  2. Auth에서 본인 계정 생성(이메일/비밀번호) → `docs/seed.sql` 실행(데모 데이터, 선택)
  3. `.env.example`을 `.env.local`로 복사하고 URL/anon key 입력
  4. 재시작 — 미들웨어 세션 보호(`/app/*` → `/login`)와 RLS tenant 격리가 활성화됨

### 타입 재생성 (Supabase 연결 후)

```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

## 구조 요약

```
app/globals.css        ★ design.md 토큰 1:1 CSS 변수 포팅 (+ --app-* SaaS 확장 토큰)
app/app/layout.tsx     ★ 앱 셸 (사이드바 240px + 상단바) — 유일한 정의처
components/ui/         프리미티브 (Button/Badge/DdayBadge/CategoryChip/Input/Panel/EmptyState/icons)
components/shell/      Sidebar(클라이언트) / Topbar / ComingSoon
lib/supabase/          server.ts / client.ts — env 미설정 시 null(데모 모드)
lib/data/              화면별 데이터 로더 (dashboard.ts / shell.ts)
lib/labels.ts          enum(영문) ↔ 한국어 라벨
lib/database.types.ts  schema.sql 대응 타입 (수기 — gen types로 교체 예정)
middleware.ts          세션 라우팅 규칙 (CLAUDE.md 4절)
```

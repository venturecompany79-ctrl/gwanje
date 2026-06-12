# 관제 (Compliance Desk)

한 명의 경영컨설턴트가 다수의 중소기업을 동시에 관리하며 인증·정부지원·융자의 **만료/마감을 통합 관제**하는 B2B SaaS. 현재 단계: **단일 컨설턴트 MVP**.

- 프로젝트 헌법: [CLAUDE.md](CLAUDE.md)
- 권위 문서: [docs/design.md](docs/design.md) · [docs/schema.sql](docs/schema.sql) · [docs/화면설계_기획자료.md](docs/화면설계_기획자료.md) · `docs/wireframes/`
- 런칭 체크리스트: [docs/launch-checklist.md](docs/launch-checklist.md)

## 개발전략 (화면 단위 세션 진행)

| 순서 | 작업 | 상태 |
|---|---|---|
| 0 | 기반: 토큰 포팅(globals.css) · 폰트 폴백(Inter+Noto Sans KR) · 앱 셸 · UI 프리미티브 · 스키마/시드 · 미들웨어 · 데이터 레이어 | ✅ 완료 |
| 1 | 통합 대시보드 `/app` (KPI + D-day 리스트 + 위젯, 로딩/빈/에러 상태) | ✅ 완료 (캘린더·칸반 뷰는 후속) |
| 2 | 기업 목록 `/app/companies` (데이터 테이블 + 기업 추가) | ✅ 완료 |
| 3 | 기업 상세 `/app/companies/[id]` (탭 + 기업/자격/과제 슬라이드오버) | ✅ 완료 |
| 4 | 관리포인트 보드 `/app/board` (4단계 칸반 + DnD + 과제 편집) | ✅ 완료 |
| 5 | 일괄안내 `/app/campaigns` (목록 + 3스텝 마법사 + 집계 상세) | ✅ 완료 |
| 6 | 알림 센터 `/app/notifications` (필터 + 읽음 처리 + 관련 화면 이동) | ✅ 완료 |
| 7 | 설정 `/app/settings` (프로필/발신정보 · 알림 규칙 · 분류 카테고리) | ✅ 완료 |
| 8 | 랜딩 풀버전 `/` (히어로 · 기능 · 요금 준비 상태 · 문의 CTA) | ✅ 완료 |
| 9 | 인증 화면 `/login` `/signup` `/reset` (공용 스테이지 · 데모 모드 · 검증/에러/로딩 상태) | ✅ 완료 |

현재 화면 로드맵은 0~9까지 완료. 다음 단계는 화면 추가가 아니라 **실제 서비스 런칭 준비**이며, 우선순위는 [런칭 체크리스트](docs/launch-checklist.md)를 따른다.

원칙: **한 세션에 한 화면 또는 한 런칭 블로커.** 화면 작업 입력 3종 = 와이어프레임 + 화면설계 스펙 + 데이터 바인딩(스키마). 런칭 작업 입력 3종 = 체크리스트 항목 + 운영 환경 + 검증 시나리오.

## 현재 검증 상태

마지막 로컬 확인 기준:

```bash
npm run typecheck  # ✅ 통과
npm run lint       # ✅ 통과
npm run build      # ✅ 통과
```

`next build`는 성공한다. 빌드 중 Webpack 캐시 직렬화 경고와 Supabase 패키지의 Edge Runtime 경고가 표시될 수 있으나 배포를 막지는 않는다. 운영 Vercel 배포 후에는 미들웨어 로그인/리다이렉트 스모크 테스트가 필요하다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # PR 전 필수
npm run lint
npm run build      # 배포 전 필수
```

### 데모 모드 vs 실제 데이터

- 로컬 개발(`npm run dev`)에서 `.env.local` 없이 실행하면 **데모 모드**: 로그인 없이 `/app` 접근 가능, 와이어프레임 시나리오 데이터 표시 (상단에 데모 배너).
- Vercel Preview/Production 또는 production runtime에서는 Supabase env 누락 시 데모 모드로 열지 않고 `/configuration-error`로 차단한다.
- 실제 데이터 연결:
  1. Supabase 프로젝트 생성 → SQL Editor에서 `docs/schema.sql` 실행
  2. Auth에서 본인 계정 생성(이메일/비밀번호) → `docs/seed.sql` 실행(데모 데이터, 선택)
  3. `.env.example`을 `.env.local`로 복사하고 URL/anon key 입력
  4. 재시작 — 미들웨어 세션 보호(`/app/*` → `/login`)와 RLS tenant 격리가 활성화됨

운영 배포에서는 `.env.local`이 아니라 Vercel Production/Preview 환경변수에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 설정한다.

### Supabase CLI 연결

레포에는 Supabase CLI 구조가 준비되어 있다.

```bash
npm run supabase:version
npm run supabase:link    # 운영 프로젝트 ref 연결
npm run supabase:push    # supabase/migrations 적용
npm run supabase:push:env # .env.local의 SUPABASE_DB_PASSWORD로 원격 DB push
npm run supabase:types   # 연결된 프로젝트 기준 타입 재생성
npm run supabase:smoke   # .env.local + 선택 로그인 정보로 연결/RLS 확인
npm run vercel:env:sync  # .env.local의 Supabase public env를 Vercel Production/Preview에 반영
npm run vercel:env:ls    # Vercel env 반영 상태 확인
```

스키마 마이그레이션은 `supabase/migrations/20260612000000_initial_schema.sql`, 시드 데이터는 `supabase/seed.sql`에 있다.

## 런칭 전 남은 큰 작업

화면 MVP는 완료됐지만 실제 서비스 오픈 전에는 다음 운영 항목이 남아 있다.

- Supabase 운영 프로젝트 구성, RLS 검증, 타입 재생성
- 비밀번호 재설정 완료 플로우 구현
- 알림톡/이메일 실발송 및 예약 발송 처리
- 파일/문서 저장소 연동
- 약관, 개인정보 처리방침, 문의/사업자 정보 정리
- 운영 QA, 배포, 모니터링, 백업 절차 준비

현재 다음 작업: **Supabase 운영 프로젝트 연결**. 세부 절차는 [런칭 체크리스트 1-1](docs/launch-checklist.md#1-1-supabase-운영-프로젝트-연결)을 기준으로 진행한다.

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

# 런칭 체크리스트

화면 로드맵 0~9 완료 이후 실제 서비스 오픈을 위한 실행 체크리스트. 현재 목표는 **단일 컨설턴트 MVP를 운영 가능한 상태로 배포**하는 것이다.

## 0. 현재 기준선

- 화면 구현: 완료
- 로컬 검증: `typecheck`, `lint`, `build` 통과
- 데모 모드: `.env.local` 없이 `/app` 접근 가능
- 실제 데이터 모드: Supabase env 설정 시 로그인 보호와 RLS 기반 데이터 접근 활성화
- 회원가입: 단일 사용자 MVP 정책상 비활성 화면만 제공

## 1. 즉시 진행

현재 진행 항목: **2-1. 비밀번호 재설정 완료 플로우**

현재 대기 입력:

- Supabase reset email redirect URL
- 새 비밀번호 입력/저장 화면 정책

### 1-1. Supabase 운영 프로젝트 연결

- [x] Supabase CLI 구조 생성: `supabase/config.toml`
- [x] 초기 스키마 마이그레이션 추가: `supabase/migrations/20260612000000_initial_schema.sql`
- [x] 초기 시드 추가: `supabase/seed.sql`
- [x] 운영 연결 검증 스크립트 추가: `npm run supabase:smoke`
- [x] 단일 사용자 MVP 정책에 맞게 로컬 Supabase Auth signup 비활성화
- [x] Supabase Data API용 `authenticated` role 권한을 스키마에 명시
- [x] `.env.local`에 Supabase URL/anon key와 스모크 테스트 계정 입력
- [x] Supabase URL/anon key 연결 확인
- [x] Supabase 운영 프로젝트 생성
- [x] `supabase login` 또는 `SUPABASE_ACCESS_TOKEN` 설정
- [x] `npm run supabase:link -- --project-ref <project-ref>`로 운영 프로젝트 연결
- [x] `npm run supabase:push:env`로 운영 스키마 적용
- [x] Auth에서 운영 사용자 1명 생성
- [x] `npm run supabase:push:env -- --include-seed`로 초기 샘플 데이터 적용
- [x] `.env.local`에 운영 또는 스테이징 Supabase URL/anon key 입력
- [x] `npm run dev` 재시작 후 `/login` 로그인 화면 확인
- [x] `SUPABASE_SMOKE_EMAIL` / `SUPABASE_SMOKE_PASSWORD`를 로컬에만 설정 후 `npm run supabase:smoke` 실행
- [x] 세션 없음 상태에서 `/app` 접근 시 `/login?redirect=/app` 이동 확인
- [ ] 세션 있음 상태에서 `/login` 접근 시 `/app` 이동 확인
- [x] RLS 격리 확인: 현재 사용자 tenant 데이터만 조회/수정되는지 확인
- [x] `npm run supabase:types`로 운영 스키마 기준 타입 재생성

완료 기준: 실제 Supabase 계정으로 로그인해 대시보드, 기업, 보드, 캠페인, 알림, 설정 화면의 데이터가 정상 조회된다.

### 1-2. 운영 env 누락 방지

- [x] Vercel 프로젝트 생성/링크: `venturecompany79-2782s-projects/gwanje`
- [x] Vercel Production 환경변수 설정: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] Vercel Preview 환경변수 설정: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] 운영 배포에서 Supabase env 누락 시 데모 모드로 열리지 않도록 정책 결정: 데모는 로컬 개발에서만 허용
- [x] Vercel/production env 누락 시 `/configuration-error`로 차단
- [x] `npm run vercel:env:ls`로 Preview/Production 환경변수 반영 확인
- [x] `VERCEL=1` + env 누락 조건에서 `/app`, `/login` → `/configuration-error` 리다이렉트 확인
- [ ] Vercel 배포 후 실제 Preview/Production URL에서 로그인/리다이렉트 스모크 테스트

완료 기준: Production URL에서 의도치 않은 데모 데이터 접근이 불가능하다.

## 2. 인증

### 2-1. 비밀번호 재설정 완료 플로우

- [ ] Supabase reset email redirect URL 설정
- [ ] 새 비밀번호 입력 페이지 또는 콜백 처리 라우트 추가
- [ ] 재설정 링크 진입 → 새 비밀번호 저장 → 로그인 이동 플로우 구현
- [ ] 만료/오류 링크 상태 처리
- [ ] 재설정 성공/실패 토스트 또는 안내 문구 확인

완료 기준: 운영 이메일로 받은 재설정 링크를 통해 실제 비밀번호를 변경할 수 있다.

### 2-2. 로그인 세션 정책

- [ ] "로그인 상태 유지" 체크박스의 실제 정책 결정
- [ ] Supabase 세션 만료/갱신 동작 확인
- [ ] 로그아웃 버튼 또는 계정 메뉴 제공 여부 결정

완료 기준: 사용자가 로그인 유지와 종료 동작을 예측 가능하게 사용할 수 있다.

## 3. 핵심 업무 플로우 QA

실제 Supabase 데이터 모드에서 확인한다.

- [ ] 기업 추가
- [ ] 기업 정보 수정
- [ ] 자격/인증 추가
- [ ] 임박 자격에서 갱신 과제 생성
- [ ] 관리포인트 추가
- [ ] 보드에서 과제 단계 드래그 이동
- [ ] 과제 상세 메모 저장
- [ ] 캠페인 대상 세그먼트 생성
- [ ] 캠페인 즉시 발송 기록 생성
- [ ] 캠페인 예약 기록 생성
- [ ] 알림 단건 읽음 처리
- [ ] 알림 모두 읽음 처리
- [ ] 설정 프로필 저장
- [ ] 알림 규칙 저장
- [ ] 카테고리 추가/수정

완료 기준: 저장 액션이 새로고침 후에도 유지되고, 관련 화면의 집계/배지가 함께 갱신된다.

## 4. 실발송 연동

현재 캠페인은 DB 기록 중심이며, 실제 알림톡/이메일 게이트웨이는 연결 전이다.

- [ ] 발송 채널 결정: 알림톡, 이메일, 둘 다
- [ ] 알림톡 제공사/API 결정
- [ ] 이메일 제공사/API 결정
- [ ] 발신 프로필 검증 정책 결정
- [ ] 즉시 발송 작업 구현
- [ ] 예약 발송 작업 구현
- [ ] 실패/재시도/부분 성공 상태 설계
- [ ] `campaign_recipient`에 실제 도달/실패 사유 저장
- [ ] 테스트 수신처로 E2E 발송 확인

완료 기준: 캠페인 생성이 실제 수신자에게 발송되고, 수신자별 도달/실패 상태가 화면에 반영된다.

## 5. 파일/문서 저장

- [ ] 저장소 결정: Cloudinary 또는 Supabase Storage
- [ ] 업로드 UI 활성화 범위 결정
- [ ] 파일 크기/확장자 제한 정의
- [ ] 업로드, 다운로드, 삭제 구현
- [ ] tenant별 접근권한 확인
- [ ] 민감 파일 보관/삭제 정책 문서화

완료 기준: 고객사 자료를 안전하게 업로드하고, 권한이 있는 사용자만 열람할 수 있다.

## 6. 법무/신뢰 문서

- [ ] 이용약관 작성
- [ ] 개인정보 처리방침 작성
- [ ] 고객 데이터 보관/삭제 기준 작성
- [ ] 사업자 정보, 문의 이메일, 연락처 정리
- [ ] 랜딩/푸터 링크 연결
- [ ] 개인정보 수집 필드와 처리방침 내용 일치 확인

완료 기준: 공개 페이지에서 법무/문의 문서에 접근할 수 있고, 실제 수집 데이터와 문서가 모순되지 않는다.

## 7. 배포

- [ ] Vercel 프로젝트 연결
- [ ] Preview 배포 생성
- [ ] Preview에서 Supabase 스테이징 또는 운영 env 확인
- [ ] Production 도메인 연결
- [ ] Supabase Auth Site URL과 Redirect URL에 운영 도메인 등록
- [ ] `npm run build` 경고 확인
- [ ] Edge Runtime/Supabase SSR 미들웨어 경고가 실제 로그인 흐름에 영향 없는지 확인

완료 기준: 운영 도메인에서 로그인, 라우팅 보호, 주요 저장 플로우가 정상 동작한다.

## 8. 운영 안정성

- [ ] 에러 로깅 도구 결정
- [ ] 배포 실패/런타임 오류 알림 채널 결정
- [ ] Supabase 백업/복구 절차 확인
- [ ] 운영 계정 접근권한 관리
- [ ] 고객 데이터 수동 복구 절차 작성
- [ ] 장애 시 고객 안내 문구 준비

완료 기준: 장애가 발생했을 때 탐지, 원인 확인, 복구, 고객 안내를 수행할 수 있다.

## 9. 런칭 직전 스모크 테스트

운영 도메인에서 새 브라우저 세션으로 확인한다.

- [ ] `/` 랜딩 접속
- [ ] `/login` 로그인
- [ ] `/app` 대시보드 조회
- [ ] 기업 1개 추가
- [ ] 자격 1개 추가
- [ ] 과제 1개 생성 및 보드 이동
- [ ] 캠페인 테스트 발송
- [ ] 알림 읽음 처리
- [ ] 설정 저장
- [ ] 로그아웃 또는 세션 만료 후 보호 라우트 차단 확인
- [ ] 모바일 화면 주요 페이지 확인

완료 기준: 신규 사용자가 핵심 업무 흐름을 끊김 없이 수행할 수 있다.

## 우선순위 요약

1. Supabase 운영 연결
2. 운영 env 누락 방지
3. 비밀번호 재설정 완료 플로우
4. 실제 데이터 모드 핵심 QA
5. 실발송 연동
6. 파일/문서 저장
7. 법무 문서 및 운영 배포

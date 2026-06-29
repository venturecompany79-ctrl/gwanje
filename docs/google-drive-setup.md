# Google Drive 연동 설정 — 운영자 가이드

> 이 문서는 **운영자(개발/배포 담당)**가 1회 수행하는 준비 작업이다.
> 이 준비가 끝나야 컨설턴트가 설정 화면에서 **버튼 한 번**으로 본인 구글 드라이브를
> 연결할 수 있고, '미인증 앱' 경고 없이 안전한 동의 화면을 보게 된다.

대상 사용자가 40-50대 비기술 컨설턴트이므로, 운영자가 아래를 **프로덕션 게시 + 검증**
까지 마쳐 두는 것이 핵심이다. (테스트 모드로 두면 refresh token이 7일마다 만료되어
동기화가 매주 끊기고, 동의 화면에 겁나는 경고가 뜬다.)

---

## 0. 동작 개요 (왜 이렇게 하나)

- 파일 업로드 → **Supabase Storage가 1차 저장(원본)**. 이건 항상 유지된다.
- 연결한 사용자는 업로드 직후 **본인 구글 드라이브**(`드라이브/관제 자료/{기업명}/`)로
  자동 복제된다. 권한은 **`drive.file`(앱이 만든 파일만)** — 사용자의 다른 드라이브
  파일에는 접근하지 않는다.
- refresh token은 **서버에서 AES-256-GCM으로 암호화**되어 DB에 저장된다.

---

## 1. Google Cloud 프로젝트 + Drive API

1. <https://console.cloud.google.com> → 프로젝트 생성(예: `gwanje-prod`).
2. **APIs & Services → Library → "Google Drive API" → 사용 설정(Enable)**.

## 2. OAuth 동의 화면 (브랜딩 — 신뢰감의 핵심)

**APIs & Services → OAuth consent screen**

- User type: **External**.
- 앱 이름: **관제(Gwanje)** — 사용자가 동의 화면에서 보는 이름.
- 사용자 지원 이메일 / 개발자 연락 이메일 입력.
- **앱 로고** 업로드(선택이지만 권장 — 신뢰도 ↑).
- **승인된 도메인(Authorized domains)**: 운영 도메인 등록(예: `your-domain.com`).
- **범위(Scopes)**: `.../auth/drive.file` **하나만** 추가.
  - `drive.file`은 *restricted*가 아니라 *sensitive* 범위라 검증 부담이 비교적 가볍다.
  - `.../auth/drive`(전체 권한)는 **절대 추가하지 말 것**.

## 3. 프로덕션 게시 + 검증 (토큰 영속 + 경고 제거)

- OAuth consent screen에서 **"앱 게시(PUBLISH APP)" → 게시 상태를 "프로덕션(In production)"**
  으로 전환하고 **검증(Verification)을 제출**한다.
- 효과:
  - ✅ refresh token **7일 만료 없음**(테스트 모드의 가장 큰 함정 해소).
  - ✅ 동의 화면에서 **'이 앱은 Google에서 확인하지 않았습니다' 경고 제거**.
- 검증에는 며칠이 걸릴 수 있다. 검증 완료 전까지는:
  - (a) 테스트 사용자(Test users)에 해당 구글 계정을 등록해 임시 사용하거나,
  - (b) 경고 화면에서 "고급 → 이동"으로 진행 — **단 7일 만료 주의**.
  - 운영 오픈 전 검증을 미리 끝내 두는 것을 권장.

## 4. OAuth 클라이언트 ID (웹)

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**.
- **승인된 리디렉션 URI(Authorized redirect URIs)**:
  - 운영: `https://<도메인>/api/google-drive/callback`
  - 로컬 개발: `http://localhost:3000/api/google-drive/callback`
- 생성 후 **Client ID / Client Secret**을 복사.

## 5. 환경변수 설정 (Vercel / `.env.local`)

`.env.example`의 주석과 동일하게 설정한다. 모두 **비공개(서버 전용)** — `NEXT_PUBLIC_` 금지.

| 변수 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 4번에서 만든 Client ID |
| `GOOGLE_CLIENT_SECRET` | 4번 Client Secret |
| `GOOGLE_REDIRECT_URI` | 콜백 URL 전체(운영/로컬 환경에 맞게) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (32바이트 base64) |
| `CRON_SECRET` | `openssl rand -hex 32` (동기화 워커 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role |

> `GOOGLE_TOKEN_ENCRYPTION_KEY`를 분실/교체하면 **기존 연결을 모두 다시 인증**해야 한다.

## 6. DB 마이그레이션

```bash
npm run supabase:push   # 20260628000000_google_drive_sync.sql 적용
```

## 7. 동기화 워커 스케줄 (안전망)

- 즉시 트리거(업로드 직후 백그라운드 실행)가 **주력**이라 보통 즉시 동기화된다.
- `vercel.json`의 cron(`/api/google-drive/sync`, 매일 00:05 KST)은 **놓친 잡·재시도용 안전망**.
  - ⚠️ Vercel **Hobby 플랜은 cron이 하루 1회만 허용**된다. 즉시 트리거가 주력이라
    실사용엔 충분하지만, 진짜 시간당 1회가 필요하면 **Pro 플랜**이 필요하다.
  - 외부 스케줄러로 대체 가능: `Authorization: Bearer <CRON_SECRET>` 헤더로
    `/api/google-drive/sync` 호출.

---

## 8. 동작 확인 (E2E)

1. 설정 → **Google Drive 연결** 섹션에서 [Google Drive 연결] → 구글 계정 선택 → 허용.
   - 정상 게시(3번)면 경고 없는 깔끔한 동의 화면이 떠야 한다.
2. 기업 상세 → 자료 → 파일 업로드 → 목록 **"드라이브" 컬럼**이 "동기화 중…" → "백업됨 ✓"
   로 바뀌고, ✓를 누르면 드라이브 파일이 열린다.
3. 본인 구글 드라이브에 `관제 자료/{기업명}/` 폴더와 파일이 생겼는지 확인.

## 9. 사용자(컨설턴트) 입장에서 보는 것

- 로그인은 **기존 이메일/비밀번호 그대로** — 바뀌지 않는다.
- 자료 탭에 "구글 드라이브에 자동 백업 — 연결하기" 안내가 보이고, 클릭하면 설정의
  **3단계 안내**(① 버튼 → ② 계정 선택 → ③ 허용)를 거쳐 한 번만 연결하면 끝.
- 연결 후엔 자료마다 **백업됨 / 동기화 중 / 실패(다시 시도)** 상태가 보여 안심할 수 있다.
- 권한이 만료되면 설정에 "다시 연결하기" 안내가 뜬다.

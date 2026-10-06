# Hermes 브리핑 설치 및 운영

개인 브리핑의 실제 연동은 지정한 계정 하나에만 활성화된다. 기본 상태는 꺼짐이며 Gemini 채팅 설정과 독립적으로 동작한다. 앱에 추가한 마이그레이션을 적용하기 전에 기능을 켜지 않는다.

연동이 꺼져 있거나 대상 계정이 아니어도 AI 사용 권한이 있는 사용자의 내 과제 대시보드에는 샘플 미리보기 카드가 표시된다. 미리보기에서는 브리핑 DB 조회, 점검 요청, 폴링, 후속 대화를 실행하지 않는다. 접기·펼치기와 계획 보기만 동작하며 샘플 과제 링크는 비활성화된다. 팀 화면에는 표시하지 않는다.

## 관제 서버 설정

```dotenv
HERMES_BRIEFING_ENABLED=false
HERMES_BRIEFING_PROFILE_ID=<본인 profile UUID>
HERMES_WORKER_SECRET=<전용 랜덤 시크릿>
```

기존 Supabase 서버 환경변수도 필요하다. `HERMES_WORKER_SECRET`은 VPS 작업자와 관제 서버에서만 공유하고 NEXT_PUBLIC 접두어를 붙이지 않는다. 브리핑 테이블은 authenticated의 직접 조회를 허용하지 않는다. 서버 API가 현재 권한과 원본 범위를 재검증한 뒤 결과를 반환한다.

DB 적용은 기존 `npm run supabase:push:env` 절차를 따른다. 운영 적용 전 `npm run verify:migrations`를 실행한다. 이번 기능은 `20261009000000_hermes_briefings.sql`을 추가하며 기존 AI 대화 테이블은 변경하지 않는다.

## Hermes API 준비

설치된 Nous Research Hermes 버전이 `/v1/chat/completions`를 지원하는지 먼저 확인한다. 공식 [API 서버 문서](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)는 loopback 주소의 OpenAI 호환 API와 Bearer 인증을 설명한다. VPS에는 아직 원격 접속하거나 설정을 적용하지 않았다.

기존 개인 대화 환경과 다른 전용 Hermes 프로필/인스턴스를 준비한다. 전용 인스턴스의 환경변수는 다음과 같다.

```dotenv
API_SERVER_ENABLED=true
API_SERVER_KEY=<Hermes 전용 API 키>
```

전용 프로필의 `config.yaml`에 다음을 설정한다. 기존 프로필의 설정 파일 전체를 덮어쓰지 않는다.

```yaml
platform_toolsets:
  api_server: []
memory:
  memory_enabled: false
  user_profile_enabled: false
  provider: ""
```

전용 프로필에는 MCP 서버·외부 메모리 플러그인·개인 자료를 연결하지 않는다. 설치 버전의 유효 도구 목록에서 API용 도구가 비어 있는지 확인한다. 프롬프트의 도구 사용 금지 문구만으로 실행 권한이 차단되었다고 판단하지 않는다. gateway를 실행하고 loopback의 API에 샘플 메시지를 보내 유효한 JSON 결과를 확인한다. 서비스 인스턴스의 API 키와 모델 공급자 설정은 별개다.

## VPS 작업자 설치

Node.js 22 이상을 사용한다. 작업자는 npm 패키지가 필요 없는 단일 파일이다.

1. 전용 시스템 사용자 `hermes-briefing`과 `/opt/gwanje-hermes` 디렉터리를 준비한다.
2. `scripts/hermes-worker.mjs`를 해당 디렉터리에 복사한다.
3. 다음 환경 파일을 `/etc/gwanje-hermes.env`에 만들고 root만 읽고 쓸 수 있도록 권한을 600으로 설정한다.
4. `scripts/hermes-briefing.service`를 `/etc/systemd/system/`에 복사한다. Node 실행 경로가 다르면 `ExecStart`만 실제 경로로 수정한다.
5. `systemctl daemon-reload` 후 `systemctl enable --now hermes-briefing`으로 시작한다.

```dotenv
HERMES_APP_URL=https://<관제 서비스 도메인>
HERMES_WORKER_SECRET=<관제 서버와 같은 시크릿>
HERMES_API_URL=http://127.0.0.1:8642/v1/chat/completions
HERMES_API_KEY=<전용 Hermes API 키>
HERMES_API_MODEL=hermes-agent
HERMES_WORKER_MOCK=false
```

Supabase service-role 키는 VPS에 넣지 않는다. 작업자는 외부에서 들어오는 포트를 열지 않고 관제 서버에 HTTPS 요청을 보낸다. 개발 시 localhost HTTP만 예외로 허용한다. 관제 서버의 배포 보호 기능이 활성화된 경우 작업자 접근 경로를 별도로 구성해야 한다.

## 검증과 활성화

```sh
npm run smoke:briefing
npm run verify:migrations
npm run typecheck
npm run lint
npm run build
```

로컬 검증에서는 테스트 DB와 테스트 계정을 지정하고 `HERMES_WORKER_MOCK=true`로 실행한다. 모의 브리핑은 화면 요약에 `[모의 브리핑]`을 표시한다. `node --env-file=/path/to/worker.env scripts/hermes-worker.mjs --once`는 예약 등록과 작업 처리 한 회만 수행한다. 모의 모드를 운영 데이터에 사용하지 않는다.

관제 서버에서 지정 계정에 한해 `HERMES_BRIEFING_ENABLED=true`로 켠다. 대시보드를 닫은 상태에서도 점검 시각이 갱신되는지, 업무 완료와 다음 날 D-day가 반영되는지, 다시 점검 버튼이 중복 작업을 생성하지 않는지 확인한다. 팀 화면에는 섹션이 나타나지 않고, 대상이 아닌 계정에는 샘플 미리보기만 표시되어야 한다.

로그는 `journalctl -u hermes-briefing`으로 확인한다. 작업 ID, 실행 시간, 실패 분류와 공급자가 반환한 토큰 사용량만 기록한다. `result_submitted`는 서버 접수 완료를 뜻하며 결과 형식 검증 실패·원본 변경 시 서버는 작업을 재시도할 수 있다. 모델 호출 수는 `ai_briefing_state.call_count`에서 확인한다. 재시도를 포함해 한국 날짜 기준 하루 60회로 제한한다.

오류 시 최신 성공 결과를 유지하며 다음 예약 시각에서 5분이 지나면 화면에 지연을 표시한다. 모델 제한 시간은 180초, 작업 유효 시간은 5분이다. 재시도는 최초 시도 이후 1분·5분·15분 간격으로 최대 세 번 수행한다. 점검 기록·브리핑·스냅샷은 30일 기준으로 정리한다.

롤백은 관제 서버의 기능 플래그를 false로 바꾸고 `systemctl stop hermes-briefing`을 실행한다. 추가 테이블은 유지해도 기존 대시보드와 채팅에 영향을 주지 않는다. 원격 DB 적용, 실제 모델 호출 및 VPS systemd 확인은 배포 환경에서 수행해야 한다.

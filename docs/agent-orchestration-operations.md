# 멀티 에이전트 워커 운영

워커는 관제 내부 API에서 한 단계를 선점하고 Hermes의 OpenAI 호환 Chat Completions API에 요청한다. 지휘자 → 전문 역할 1~5개 → 종합 담당자 순서이며, 모의 모드에서는 지휘자 → finance → risk → synthesizer 순서다. 한 사이클은 한 단계다.

## 환경변수

| 변수 | 위치 | 설명 |
| --- | --- | --- |
| `AGENT_APP_URL` | VPS | 관제 앱 URL. HTTPS 필수, `localhost`, `127.0.0.1`, `[::1]`만 HTTP 허용 |
| `AGENT_WORKER_SECRET` | VPS·Vercel | 같은 Bearer 시크릿. Hermes 브리핑 시크릿과 별도 사용 |
| `HERMES_API_URL` | VPS | 기본 `http://127.0.0.1:8642/v1/chat/completions`. 앱 URL과 같은 URL 검증 적용 |
| `HERMES_API_KEY` | VPS | 모델 API 키. 모의 모드가 아니면 필수 |
| `HERMES_API_MODEL` | VPS | 기본 `hermes-agent` |
| `AGENT_WORKER_MOCK` | VPS | 정확히 `true`이면 모델 호출 없이 역할별 고정 응답 사용 |
| `AGENT_ORCHESTRATION_ENABLED` | Vercel | 정확히 `true`여야 내부 agents API 활성화 |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel | 내부 API의 DB 연결 설정. 워커에 DB 키를 전달할 필요 없음 |

URL 사용자명·비밀번호와 HTTP(S) 이외 프로토콜은 거절한다. 모델 요청은 180초, 내부 API 요청은 60초 제한이다. 모델 호출 중 60초마다 heartbeat를 보낸다. 409이면 모델 호출을 중단하고 결과를 제출하지 않는다. 다른 heartbeat 오류는 로그를 남기고 다음 주기에 재시도한다. 성공·실패 제출의 최종 임대 유효성은 DB에서 검사한다.

모델 통신 실패는 `model_unavailable`, JSON 파싱·출력 형식 오류는 `invalid_model_output`으로 보고한다. 재시도·백오프는 DB 큐가 처리한다. 결과 본문은 UTF-8 기준 256KiB, 다른 API는 32KiB 제한이다. 각 대화 메시지는 Unicode 문자 기준 최대 4000자로 잘라 전송한다.

## 로컬 검증

Node.js 22 이상을 사용한다. 워커 자체는 외부 npm 패키지가 필요 없다. 저장소 검증에는 `npm ci`가 필요하다.

```sh
npm run smoke:agent-worker
node scripts/agents-smoke.mjs
npm run verify:migrations
npm run typecheck
npm run lint
```

실제 내부 API와 모의 모델을 함께 확인하려면 개발 앱에 Supabase 설정, `AGENT_ORCHESTRATION_ENABLED=true`, `AGENT_WORKER_SECRET`을 설정하고 `npm run dev`로 실행한다. API와 워커에 동일한 시크릿을 설정한다.

```sh
export AGENT_APP_URL=http://localhost:3000
export AGENT_WORKER_SECRET='로컬-검증용-시크릿'
export AGENT_WORKER_MOCK=true
export CREATOR_UUID='활성-ai.assistant.use-사용자의-UUID'

curl --fail-with-body "$AGENT_APP_URL/api/internal/agents/tasks" \
  -H "Authorization: Bearer $AGENT_WORKER_SECRET" \
  -H 'Content-Type: application/json' \
  --data "{\"createdBy\":\"$CREATOR_UUID\",\"source\":\"app\",\"title\":\"모의 분석\",\"body\":\"확장 계획의 재무와 위험을 검토해 주세요.\"}"

npm run agent:worker -- --once
```

`--once`는 한 단계만 처리하고 종료한다. 모의 태스크를 끝내려면 네 번 실행하거나 `npm run agent:worker`로 계속 실행한다. 다른 대기 태스크가 있다면 가장 오래된 실행 가능 태스크부터 처리한다. 모의 모드도 실제 DB에 결과를 저장하므로 테스트용 태스크·환경을 사용한다. 단계가 없거나 사이클 오류가 발생하면 10초 대기한다. 처리할 단계가 있으면 다음 사이클을 바로 실행한다.

프로덕션 빌드에는 앱의 Supabase 공개 환경변수가 필요하다. 실제 설정 없는 환경에서 컴파일만 검증하려면 다음 더미 값으로 실행할 수 있다. 이 빌드로 운영 연결을 검증한 것은 아니다.

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=build-validation-only npm run build
```

## VPS 설치 (systemd)

원격 DB 마이그레이션 적용과 내부 API 배포를 완료한 뒤 설치한다. 별도 사용자 `gwanje-agent`와 `/etc/gwanje-agent.env`를 사용한다. 기존 Hermes 서비스는 그대로 둔다.

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin gwanje-agent
sudo install -d -o root -g root -m 755 /opt/gwanje-agent
sudo install -o root -g root -m 644 scripts/agent-worker.mjs /opt/gwanje-agent/agent-worker.mjs
sudo install -o root -g root -m 644 scripts/agent-worker.service /etc/systemd/system/agent-worker.service
sudo install -o root -g root -m 600 /dev/null /etc/gwanje-agent.env
sudoedit /etc/gwanje-agent.env
```

환경 파일 예시 (`export` 없이 작성):

```dotenv
AGENT_APP_URL=https://관제-도메인
AGENT_WORKER_SECRET=Vercel과-동일한-시크릿
HERMES_API_URL=http://127.0.0.1:8642/v1/chat/completions
HERMES_API_KEY=모델-API-키
HERMES_API_MODEL=hermes-agent
AGENT_WORKER_MOCK=false
```

`/usr/bin/node --version`으로 Node.js 22 이상인지 확인한다. 설치 위치가 다르면 서비스의 `ExecStart`를 실제 절대 경로로 바꾼다.

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now agent-worker.service
sudo systemctl status agent-worker.service
sudo journalctl -u agent-worker.service -f
```

서비스는 `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome` 옵션을 적용한다. 로그는 태스크 본문·응답 원문·토큰·키를 제외한 JSON 한 줄 형식으로 기록한다. `result_submitted`, `model_failed`, `heartbeat_failed`, `lease_expired`, `step_interrupted`, `cycle_failed` 이벤트를 확인한다.

SIGTERM/SIGINT는 대기와 진행 중인 요청을 중단한다. 중단된 단계는 결과를 제출하지 않고 DB 임대 만료 후 회수된다. 업데이트할 때 워커 파일을 다시 설치한 뒤 `sudo systemctl restart agent-worker.service`를 실행한다. 초기 환경 파일 생성 명령은 기존 환경 파일을 덮어쓰므로 업데이트 시 반복하지 않는다.

# 멀티 에이전트 워커 운영

워커는 관제 내부 API에서 한 단계를 선점하고 Hermes의 OpenAI 호환 Chat Completions API에 요청한다. 지휘자 → 전문 역할 → 종합 담당자 순서이며, 전문 역할은 선택한 최대 5개와 필수 역할을 합쳐 최대 6개다. 기본 역할 파일의 모의 모드에서는 지휘자 → finance → risk → synthesizer 순서다. 한 사이클은 한 단계다.

## 환경변수

| 변수 | 위치 | 설명 |
| --- | --- | --- |
| `AGENT_APP_URL` | VPS | 관제 앱 URL. HTTPS 필수, `localhost`, `127.0.0.1`, `[::1]`만 HTTP 허용 |
| `AGENT_WORKER_SECRET` | VPS·Vercel | 같은 Bearer 시크릿. Hermes 브리핑 시크릿과 별도 사용 |
| `LLM_API_URL` | VPS | 모델 Chat Completions URL. 기본 URL 없음. 모의 모드가 아니면 필수이며 앱 URL과 같은 URL 검증 적용 |
| `LLM_API_KEY` | VPS | 모델 API 키. 모의 모드가 아니면 필수 |
| `LLM_API_MODEL` | VPS | 모델 이름. 기본 `hermes-agent` |
| `AGENT_WORKER_MOCK` | VPS | 정확히 `true`이면 모델 호출 없이 역할별 고정 응답 사용 |
| `AGENT_ORCHESTRATION_ENABLED` | Vercel | 정확히 `true`여야 내부 agents API 활성화 |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel | 내부 API의 DB 연결 설정. 워커에 DB 키를 전달할 필요 없음 |

URL 사용자명·비밀번호와 HTTP(S) 이외 프로토콜은 거절한다. 모델 요청은 180초, 내부 API 요청은 60초 제한이다. 모델 호출 중 60초마다 heartbeat를 보낸다. 409이면 모델 호출을 중단하고 결과를 제출하지 않는다. 다른 heartbeat 오류는 로그를 남기고 다음 주기에 재시도한다. 성공·실패 제출의 최종 임대 유효성은 DB에서 검사한다.

새 `LLM_API_*` 값을 우선 사용한다. 개별 값이 없거나 빈 문자열이면 대응하는 기존 `HERMES_API_*` 값으로 대체하므로 이전 환경 파일도 사용할 수 있다. 모의 모드에서는 URL·키를 생략할 수 있다. 기존 환경에서 URL을 생략했다면 이제 명시적으로 설정해야 한다.

모델 통신 실패는 `model_unavailable`, JSON 파싱·출력 형식 오류는 `invalid_model_output`, claim 역할 정의·버전 불일치는 `invalid_role_definition`으로 보고한다. 잘못된 역할 정의는 LLM 호출 전에 거절한다. 재시도·백오프는 DB 큐가 처리한다. 결과 본문은 UTF-8 기준 256KiB, 다른 API는 32KiB 제한이다. 각 대화 메시지는 Unicode 문자 기준 최대 4000자로 잘라 전송한다.

지휘자는 꼭 필요한 역할만 선택한다. 단순 태스크는 1~2개, 복합 태스크도 3개를 기본으로 하며 4개 이상이면 plan에 이유를 쓰도록 지시한다. 모든 역할에 사실과 추론의 구분, 법률·세무·노무 주장 끝의 `(전문가 확인 필요)` 표기를 지시한다. 종합 결과의 owner는 `대표님`, `에이전트`, `외부 전문가` 중 하나다. 에이전트에는 원문·history만으로 가능한 계산·초안·체크리스트만 배정하고, 문서 열람·외부 연락·계약 확인은 대표님 또는 외부 전문가에게 배정하도록 지시한다.

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
LLM_API_URL=https://llm.example.com/v1/chat/completions
LLM_API_KEY=모델-API-키
LLM_API_MODEL=모델-이름
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

## 역할 수정 방법(Supabase 표 편집기)

역할의 실제 권위는 `public.agent_role`이다. 워커는 md 파일이나 `AGENT_ROLES_DIR`을 사용하지 않는다. 기존 `20261011000000` 마이그레이션은 유지하고 새 `20261012000000_agent_roles.sql`에서 테이블·시드·함수를 추가한다. 배포 순서는 새 마이그레이션 적용 → API 배포 → 워커 교체다. 이 코드 변경 작업에서는 원격 DB 적용을 실행하지 않는다.

1. Supabase Dashboard → Table Editor → `agent_role`을 연다.
2. `tenant_id`로 워크스페이스를 먼저 필터링한다. `company_id = null`은 공통 역할, 값이 있으면 해당 법인 전용이다.
3. `name`(1~40자), `instructions`(1~4000자), `enabled`, 전문 역할의 `mode`를 수정하고 저장한다.
4. 새 전문 역할은 `kind = specialist`, 소문자·하이픈 key(소문자 시작, 1~64자), 한국어 이름, 지침을 입력한다. `mode = optional`은 지휘자 선택 대상, `always`는 자동 포함이다.
5. 저장 후 `agent_role_version`에서 수정 전 `snapshot`과 버전을 확인한다. `version`·`updated_at`은 자동 관리되므로 직접 수정하지 않는다.

DB에 로그인한 owner만 같은 tenant의 역할을 수정할 수 있다. 조회에는 같은 tenant와 `ai.assistant.use` 권한이 필요하다. Supabase 관리 대시보드의 표 편집기는 관리자 권한으로 RLS를 우회할 수 있으므로 tenant 필터를 반드시 확인한다. 사용자 JWT로 수정하면 `updated_by`가 자동 기록된다. 표 편집기에서는 실제 수정자의 같은 tenant profile UUID를 `updated_by`에 지정한다. 시드 행은 수정자 없이 생성된다.

기존 및 신규 tenant에는 지휘자·재무·법무·규제·운영·전략·리스크·종합의 역할 key 7개가 공통으로 생성된다(법무·규제는 `legal` 한 역할). `orchestrator`와 `synthesizer`는 같은 key와 kind를 유지하며 tenant당 공통 한 개씩만 존재한다. 핵심 역할에는 `company_id`를 지정하지 않고 mode 기본값 optional을 유지한다.

같은 key의 공통·법인 역할이 모두 있으면 법인 역할을 우선한다. 법인 역할을 비활성화하면 공통 역할로 되돌아가지 않고 해당 key를 제외한다. 태스크에 법인이 없으면 공통 역할만 사용한다. 다른 법인의 전용 역할과 비활성 역할은 다음 단계 추가 시 DB에서 거절한다. 대기 단계의 역할이 삭제·비활성화된 경우 선점 시 `role_unavailable`로 태스크가 실패한다.

`steps/claim` 응답의 `roles.current`는 실행 역할의 `key, name, instructions, version`을 담는다. 지휘자일 때 `roles.specialists`에 법인 범위까지 병합한 활성 전문 역할의 `key, name, mode` 목록이 담긴다. DB 선점 트랜잭션에서 지침과 `agent_step.role_version`을 함께 확정하므로 실행 중 수정이 들어와도 이미 전달한 프롬프트는 바뀌지 않는다. 다음 선점(재시도 포함)에는 최신 버전을 사용한다. 워커 재시작은 필요 없다.

최종 프롬프트는 공통 안전 규칙 + DB 지침 + 코드의 JSON 출력 형식이다. 표에는 역할 지침만 작성한다. 출력 JSON 형식·검증은 코드에 남아 있다. 모의 모드도 claim의 역할 목록을 사용하며, finance·risk가 없으면 목록의 앞 두 역할을 선택한다.

핵심 역할(orchestrator·synthesizer)은 owner의 삭제 정책에서도 제외된다. 전문 역할은 owner가 삭제할 수 있다. 관리 대시보드·service_role처럼 RLS를 우회하는 권한에는 이 삭제 정책이 적용되지 않는다.

DB의 태스크 총 8단계 제한 때문에 지휘자·종합 담당자를 제외한 전문 역할은 최대 6개다. 지휘자가 고른 최대 5개와 always 역할을 중복 제거해 포함하고, always를 먼저 확보한 뒤 남는 자리에 선택 역할을 배치한다. 적용 가능한 always가 6개를 초과하면 워커는 `invalid_role_definition`으로 보고한다. 변경 전에 법인별 공통·전용 역할의 합계를 확인한다.

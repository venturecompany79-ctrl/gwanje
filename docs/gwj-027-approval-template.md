# GWJ-027 데이터 정리 승인표 (템플릿)

> 운영 DB는 이 승인표가 **확정된 뒤** 별도 단계에서만 수정한다.
> 후보는 `npm run audit:test-data`(READ ONLY)로 생성한다.

## 실행 방법

```bash
# .env.local 에 로컬 전용으로 설정 후
#   SUPABASE_SMOKE_EMAIL=...
#   SUPABASE_SMOKE_PASSWORD=...
npm run audit:test-data
```

출력의 "승인표 CSV" 블록을 아래 표로 옮겨 검토한다.

## 승인표

| candidate_type | record_type | record_id | display_name | linked_counts | recommended_action | approved_action | approved_by | approved_at |
|---|---|---|---|---|---|---|---|---|
| test_task | task | | | | rename_or_complete | | | |
| test_company | company | | | | review | | | |
| duplicate_company | company | | | | merge | | | |
| same_biz_no | company | | | | merge | | | |

## 기본 권장 조치 원칙

- **명백한 테스트 task**: 삭제보다 제목 수정 또는 완료(`stage=result`) 처리 우선.
- **중복 company**: 삭제 대신 병합 기준 company를 정하고 연결 데이터(credential·task·schedule·document·notification)를 이전.
- **seed/demo 데이터**: 운영자가 실제로 사용 중이면 보존하거나 이름만 수정.

## 안전 규칙

- 승인 전 `delete`/`update`/`truncate` 금지.
- 병합 시 연결 데이터 이전 → 검증 → 원본 정리 순서.
- 실행 SQL은 트랜잭션으로 감싸고, 사전 `select`로 영향 행을 재확인.

## 확정 내역 (2026-06-20 승인)

audit-test-data.mjs 1차 결과 기준으로 아래 2건 확정.

| candidate_type | record_id | display_name | approved_action |
|---|---|---|---|
| test_task | ebbbd37d-ee65-45ed-86be-c523ca3419e2 | 테스트 | **delete** (완전 삭제) |
| duplicate_company | cb447982-1a77-46b7-95f4-ebb0ac55bd75 | 유니콘파트너스 | **merge → 삭제** (유지: 유니콘 파트너스 f9d46b10…) |

- 정리 SQL: [`scripts/cleanup-gwj-027.sql`](../scripts/cleanup-gwj-027.sql) — `migrations/`가 아니라 `scripts/`에 있어 `supabase db push`로 자동 실행되지 않는다.
- 적용: 운영자 승인 후 Supabase SQL Editor 또는 psql에서 수동 실행(단일 트랜잭션, 내장 검증 실패 시 자동 rollback).
- 적용 후 `npm run audit:test-data`로 잔여 후보 0건 재확인 권장.

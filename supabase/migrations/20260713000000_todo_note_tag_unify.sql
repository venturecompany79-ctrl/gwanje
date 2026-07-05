-- =============================================================
-- 태그 어휘 통일 (expand 단계): todo_note.tag CHECK 를 신·구 합집합으로 확장
--
-- 앱은 상담·미팅·서류·기타(lib/todos.ts TODO_TAGS)로 표준화하지만,
-- CHECK 는 구 태그(업무·기록)까지 함께 허용해 배포 순서와 무관하게 안전하게 한다:
--   - 구 코드(업무·미팅·기록)와 신 코드(상담·미팅·서류·기타)가 모두 통과
--   - 기존 데이터(업무·기록)를 건드리지 않음 → 무손실
-- 신 앱은 4종만 노출/생성하므로 구 태그는 자연 소멸한다. 완전 소멸이 확인되면
-- 별도 contract 마이그레이션에서 CHECK 를 상담·미팅·서류·기타 4종으로 좁힐 수 있다.
-- =============================================================

alter table todo_note drop constraint if exists todo_note_tag_check;

alter table todo_note
  add constraint todo_note_tag_check
  check (tag in ('업무', '미팅', '기록', '상담', '서류', '기타'));

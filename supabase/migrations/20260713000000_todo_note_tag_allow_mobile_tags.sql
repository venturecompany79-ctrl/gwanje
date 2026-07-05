-- =============================================================
-- todo_note.tag: 모바일 '오늘' 업무일지 태그(상담·서류·기타) 저장 허용
--
-- 배경: 기존 CHECK 제약은 웹 보드 태그(업무·미팅·기록)만 허용했다.
--       모바일 앱은 별도 태그 셋(상담·미팅·서류·기타)을 노출하는데,
--       그대로 저장하면 CHECK 위반이라 서버가 태그를 null로 떨궈 저장했다
--       → 모바일에서 지정한 태그가 유실되는 버그.
-- 조치: 웹·모바일 두 화면 태그의 합집합으로 CHECK를 확장한다.
--       (앱 검증 상수 lib/todos.ts ACCEPTED_TODO_TAGS 와 동일 집합)
-- =============================================================

alter table todo_note drop constraint if exists todo_note_tag_check;

alter table todo_note
  add constraint todo_note_tag_check
  check (tag in ('업무', '미팅', '기록', '상담', '서류', '기타'));

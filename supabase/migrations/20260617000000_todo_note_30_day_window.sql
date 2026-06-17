-- To-dos 보드는 오늘 포함 30일 창을 유지한다.
-- 기존 함수는 오늘-30일까지 보존해 화면 기준보다 하루 더 남길 수 있어
-- 오늘-29일 이전 레코드를 정리하도록 보관 기준을 통일한다.

create or replace function cleanup_old_todo_notes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from todo_note
  where note_date < ((now() at time zone 'Asia/Seoul')::date - 29);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function cleanup_old_todo_notes() from public, anon, authenticated;

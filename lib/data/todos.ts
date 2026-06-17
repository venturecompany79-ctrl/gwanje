import { createClient } from "@/lib/supabase/server";
import { shiftDateString, todayKstDate } from "@/lib/datetime";
import {
  TODO_BOARD_DAY_COUNT,
  isTodoTag,
  type TodoBoardData,
  type TodoNoteRow,
  type TodoTag,
} from "@/lib/todos";

function demoNote(
  id: string,
  noteDate: string,
  content: string,
  tag: TodoTag | null,
  completed = false,
  sortOrder = 0,
): TodoNoteRow {
  const stamp = `${noteDate}T01:00:00.000Z`;
  return {
    id,
    noteDate,
    content,
    tag,
    completed,
    sortOrder,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function DEMO_TODOS(today: string): TodoBoardData {
  const yesterday = shiftDateString(today, -1);
  const twoDaysAgo = shiftDateString(today, -2);
  return {
    demo: true,
    today,
    notes: [
      demoNote("demo-todo-1", today, "세금계산서 발행 확인", "업무", false, 0),
      demoNote("demo-todo-2", today, "바실로바이오 KOICA 미팅 준비", "미팅", false, 1),
      demoNote("demo-todo-3", today, "고객사 요청사항 정리", "기록", true, 2),
      demoNote("demo-todo-4", yesterday, "정책자금 제출 서류 체크", "업무", true, 0),
      demoNote("demo-todo-5", yesterday, "오후 상담 내용 요약", "기록", false, 1),
      demoNote("demo-todo-6", twoDaysAgo, "월간 운영 미팅 메모", "미팅", true, 0),
    ],
  };
}

export async function getTodoBoardData(): Promise<TodoBoardData> {
  const today = todayKstDate();
  const supabase = await createClient();
  if (!supabase) return DEMO_TODOS(today);

  const cutoff = shiftDateString(today, -(TODO_BOARD_DAY_COUNT - 1));
  const { data, error } = await supabase
    .from("todo_note")
    .select("*")
    .gte("note_date", cutoff)
    .lte("note_date", today)
    .order("note_date", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`To-dos를 불러오지 못했습니다: ${error.message}`);
  }

  return {
    demo: false,
    today,
    notes: (data ?? []).map((note) => ({
      id: note.id,
      noteDate: note.note_date,
      content: note.content,
      tag: isTodoTag(note.tag) ? note.tag : null,
      completed: note.completed,
      sortOrder: note.sort_order,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    })),
  };
}

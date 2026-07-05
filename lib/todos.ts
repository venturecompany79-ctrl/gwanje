export const TODO_TAGS = ["업무", "미팅", "기록"] as const;
export const TODO_BOARD_DAY_COUNT = 30;

export type TodoTag = (typeof TODO_TAGS)[number];

export interface TodoNoteRow {
  id: string;
  userId: string;
  userName: string;
  noteDate: string;
  content: string;
  tag: TodoTag | null;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  editable: boolean;
}

export interface TodoMemberOption {
  id: string;
  name: string;
}

export interface TodoBoardData {
  demo: boolean;
  today: string;
  currentUserId: string;
  selectedUserId: string;
  selectedLabel: string;
  canViewTeam: boolean;
  canCreate: boolean;
  members: TodoMemberOption[];
  notes: TodoNoteRow[];
}

export function isTodoTag(value: string | null): value is TodoTag {
  return TODO_TAGS.some((tag) => tag === value);
}

// 웹 보드는 위 TODO_TAGS(업무·미팅·기록)를, 모바일 '오늘' 업무일지는 별도 태그
// 셋(상담·미팅·서류·기타, mobile/src/lib/labels.ts)을 노출한다.
// 저장 검증은 두 화면의 합집합을 허용해 서피스 간 태그 유실을 막는다.
// (DB CHECK 제약도 동일 집합 — supabase/migrations/*_todo_note_tag_allow_mobile_tags.sql)
export const ACCEPTED_TODO_TAGS = [
  "업무",
  "미팅",
  "기록",
  "상담",
  "서류",
  "기타",
] as const;

export function isAcceptedTodoTag(value: string | null): boolean {
  return ACCEPTED_TODO_TAGS.some((tag) => tag === value);
}

/** 노트 내용 정리 — 줄바꿈은 보존하고 줄 내 공백만 정리한다. */
export function cleanTodoContent(value: string): string {
  return value
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

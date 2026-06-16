export const TODO_TAGS = ["업무", "미팅", "기록"] as const;

export type TodoTag = (typeof TODO_TAGS)[number];

export interface TodoNoteRow {
  id: string;
  noteDate: string;
  content: string;
  tag: TodoTag | null;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoBoardData {
  demo: boolean;
  today: string;
  notes: TodoNoteRow[];
}

export function isTodoTag(value: string | null): value is TodoTag {
  return TODO_TAGS.some((tag) => tag === value);
}

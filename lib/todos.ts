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

import { daysFromToday, isValidDateString, todayKstDate } from "@/lib/datetime";

// 표준 태그 어휘 (웹 보드 + 모바일 '오늘' 업무일지 공통).
// 값을 바꾸면 mobile/src/lib/labels.ts, DB CHECK 제약, 톤 CSS도 함께 맞춰야 한다.
export const TODO_TAGS = ["상담", "미팅", "서류", "기타"] as const;
export const TODO_BOARD_DAY_COUNT = 30;
// 오늘 이후로 노트를 작성할 수 있는 최대 일수(미래 일정·계획 메모용).
// 웹과 모바일의 날짜 검증 및 보드 조회에 공통으로 적용한다.
export const TODO_NOTE_FUTURE_DAYS = 365;

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

/** 오늘 포함 최근 30일 및 오늘 이후 365일까지 노트 작성·날짜 변경을 허용한다. */
export function resolveTodoNoteDate(value: string | undefined): string | null {
  if (value === undefined) return todayKstDate();
  if (!isValidDateString(value)) return null;
  const offset = daysFromToday(value);
  if (offset > TODO_NOTE_FUTURE_DAYS || offset < -(TODO_BOARD_DAY_COUNT - 1)) {
    return null;
  }
  return value;
}

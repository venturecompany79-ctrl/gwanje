import { createClient } from "@/lib/supabase/server";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
} from "@/lib/data/current-member";
import { shiftDateString, todayKstDate } from "@/lib/datetime";
import { isMemberRole } from "@/lib/permissions";
import {
  TODO_BOARD_DAY_COUNT,
  isTodoTag,
  type TodoBoardData,
  type TodoMemberOption,
  type TodoNoteRow,
  type TodoTag,
} from "@/lib/todos";

function demoNote(
  id: string,
  userId: string,
  userName: string,
  noteDate: string,
  content: string,
  tag: TodoTag | null,
  completed = false,
  sortOrder = 0,
): TodoNoteRow {
  const stamp = `${noteDate}T01:00:00.000Z`;
  return {
    id,
    userId,
    userName,
    noteDate,
    content,
    tag,
    completed,
    sortOrder,
    createdAt: stamp,
    updatedAt: stamp,
    editable: userId === "demo-user-owner",
  };
}

function DEMO_TODOS(today: string): TodoBoardData {
  const yesterday = shiftDateString(today, -1);
  const twoDaysAgo = shiftDateString(today, -2);
  return {
    demo: true,
    today,
    currentUserId: "demo-user-owner",
    selectedUserId: "me",
    selectedLabel: "내 업무일지",
    canViewTeam: true,
    canCreate: true,
    members: [
      { id: "demo-user-owner", name: "김컨설턴트" },
      { id: "demo-user-manager", name: "박매니저" },
      { id: "demo-user-member", name: "이팀원" },
    ],
    notes: [
      demoNote("demo-todo-1", "demo-user-owner", "김컨설턴트", today, "세금계산서 발행 확인", "서류", false, 0),
      demoNote("demo-todo-2", "demo-user-owner", "김컨설턴트", today, "바실로바이오 KOICA 미팅 준비", "미팅", false, 1),
      demoNote("demo-todo-3", "demo-user-manager", "박매니저", today, "고객사 요청사항 정리", "기타", true, 2),
      demoNote("demo-todo-4", "demo-user-owner", "김컨설턴트", yesterday, "정책자금 제출 서류 체크", "서류", true, 0),
      demoNote("demo-todo-5", "demo-user-member", "이팀원", yesterday, "오후 상담 내용 요약", "상담", false, 1),
      demoNote("demo-todo-6", "demo-user-owner", "김컨설턴트", twoDaysAgo, "월간 운영 미팅 메모", "미팅", true, 0),
    ],
  };
}

export async function getTodoBoardData(
  selectedJournal = "me",
): Promise<TodoBoardData> {
  const today = todayKstDate();
  const supabase = await createClient();
  if (!supabase) return DEMO_TODOS(today);

  const identity = await getCurrentIdentity(supabase);
  if (!identity) {
    throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const profile = await readCurrentMemberProfile(supabase, identity.userId);
  if (!profile) {
    throw new Error("프로필 정보를 불러오지 못했습니다.");
  }
  if (!isMemberRole(profile.role) || profile.status !== "active") {
    throw new Error("업무일지를 볼 수 없는 계정 상태입니다.");
  }

  const canViewTeam = profile.role === "owner";
  const cutoff = shiftDateString(today, -(TODO_BOARD_DAY_COUNT - 1));
  const membersRes = canViewTeam
    ? await supabase
        .from("profile")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .neq("status", "disabled")
        .order("name")
    : null;
  if (membersRes?.error) {
    throw new Error(`팀원 목록을 불러오지 못했습니다: ${membersRes.error.message}`);
  }

  const members: TodoMemberOption[] = canViewTeam
    ? (membersRes?.data ?? []).map((member) => ({
        id: member.id,
        name: member.name,
      }))
    : [{ id: identity.userId, name: profile.name }];
  const memberName = new Map(members.map((member) => [member.id, member.name]));

  const requestedUser =
    selectedJournal === "all" ? "all" : selectedJournal || "me";
  const allowedUserIds = new Set(members.map((member) => member.id));
  const effectiveSelected =
    canViewTeam && requestedUser === "all"
      ? "all"
      : canViewTeam && allowedUserIds.has(requestedUser)
        ? requestedUser
        : "me";
  const selectedUserId =
    effectiveSelected === "me" ? identity.userId : effectiveSelected;
  const selectedLabel =
    effectiveSelected === "all"
      ? "전체 팀원"
      : selectedUserId === identity.userId
        ? "내 업무일지"
        : (memberName.get(selectedUserId) ?? "팀원");

  let query = supabase
    .from("todo_note")
    .select(
      "id, user_id, note_date, content, tag, completed, sort_order, created_at, updated_at",
    )
    .gte("note_date", cutoff)
    .lte("note_date", today);

  if (effectiveSelected !== "all") {
    query = query.eq("user_id", selectedUserId);
  }

  const { data, error } = await query
    .order("note_date", { ascending: false })
    .order("user_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`To-dos를 불러오지 못했습니다: ${error.message}`);
  }

  return {
    demo: false,
    today,
    currentUserId: identity.userId,
    selectedUserId: effectiveSelected,
    selectedLabel,
    canViewTeam,
    canCreate: effectiveSelected === "me" || selectedUserId === identity.userId,
    members,
    notes: (data ?? []).map((note) => ({
      id: note.id,
      userId: note.user_id,
      userName: memberName.get(note.user_id) ?? "팀원",
      noteDate: note.note_date,
      content: note.content,
      tag: isTodoTag(note.tag) ? note.tag : null,
      completed: note.completed,
      sortOrder: note.sort_order,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      editable: note.user_id === identity.userId,
    })),
  };
}

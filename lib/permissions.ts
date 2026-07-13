export const PERMISSION_KEYS = [
  "companies.read",
  "companies.write",
  "tasks.read",
  "tasks.write",
  "campaigns.read",
  "campaigns.write",
  "notifications.read",
  "settings.categories.write",
  "settings.rules.write",
  "settings.drive.write",
  "ai.assistant.use",
  "billing.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const MEMBER_ROLES = ["owner", "manager", "member", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_STATUSES = ["invited", "active", "disabled"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "최고관리자",
  manager: "관리자",
  member: "팀원",
  viewer: "조회 전용",
};

export const STATUS_LABEL: Record<MemberStatus, string> = {
  invited: "초대됨",
  active: "활성",
  disabled: "비활성",
};

export const PERMISSION_LABEL: Record<PermissionKey, string> = {
  "companies.read": "기업 조회",
  "companies.write": "기업 등록·수정",
  "tasks.read": "Task 조회",
  "tasks.write": "Task 등록·수정",
  "campaigns.read": "일괄안내 조회",
  "campaigns.write": "일괄안내 작성·발송",
  "notifications.read": "알림 조회",
  "settings.categories.write": "분류 카테고리 관리",
  "settings.rules.write": "알림 규칙 관리",
  "settings.drive.write": "Google Drive 연결 관리",
  "ai.assistant.use": "AI 비서 사용",
  "billing.manage": "결제 관리",
};

export const PERMISSION_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  {
    title: "기업",
    keys: ["companies.read", "companies.write"],
  },
  {
    title: "Task",
    keys: ["tasks.read", "tasks.write"],
  },
  {
    title: "일괄안내",
    keys: ["campaigns.read", "campaigns.write"],
  },
  {
    title: "AI",
    keys: ["ai.assistant.use"],
  },
  {
    title: "운영",
    keys: [
      "notifications.read",
      "settings.categories.write",
      "settings.rules.write",
      "settings.drive.write",
      "billing.manage",
    ],
  },
];

export const ROLE_PRESETS: Record<MemberRole, PermissionKey[]> = {
  owner: [...PERMISSION_KEYS],
  manager: [
    "companies.read",
    "companies.write",
    "tasks.read",
    "tasks.write",
    "campaigns.read",
    "campaigns.write",
    "notifications.read",
    "settings.categories.write",
    "settings.rules.write",
    "settings.drive.write",
    "ai.assistant.use",
  ],
  member: [
    "companies.read",
    "tasks.read",
    "tasks.write",
    "notifications.read",
    "ai.assistant.use",
  ],
  viewer: [
    "companies.read",
    "tasks.read",
    "campaigns.read",
    "notifications.read",
  ],
};

export function isMemberRole(value: string): value is MemberRole {
  return MEMBER_ROLES.some((role) => role === value);
}

export function isMemberStatus(value: string): value is MemberStatus {
  return MEMBER_STATUSES.some((status) => status === value);
}

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEYS.some((permission) => permission === value);
}

export function normalizePermissions(
  role: MemberRole,
  permissions: readonly string[],
): PermissionKey[] {
  if (role === "owner") return [...PERMISSION_KEYS];
  const cleaned = permissions.filter(isPermissionKey);
  return [...new Set(cleaned)];
}

export function hasPermission(
  member:
    | { role: MemberRole; permissions: readonly string[]; status?: MemberStatus }
    | null
    | undefined,
  permission: PermissionKey,
): boolean {
  if (!member || member.status === "disabled" || member.status === "invited") {
    return false;
  }
  if (member.role === "owner") return true;
  return member.permissions.includes(permission);
}

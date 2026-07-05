"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField, MaskedInputField } from "@/components/ui/Input";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconAlert,
  IconBell,
  IconCard,
  IconCheck,
  IconEdit,
  IconLink,
  IconPalette,
  IconPlus,
  IconTag,
  IconTeam,
  IconUser,
  IconX,
} from "@/components/ui/icons";
import { formatKstDate } from "@/lib/datetime";
import {
  addCategory,
  disableTeamMember,
  inviteTeamMember,
  reactivateTeamMember,
  renameCategory,
  setCategoryColor,
  updateTeamMember,
  updateNotifyRules,
  updateProfile,
} from "@/lib/actions/settings";
import { CATEGORY_COLORS } from "@/lib/categoryColors";
import type {
  SettingsCategory,
  SettingsData,
  SettingsDrive,
  SettingsProfile,
  SettingsTeamMember,
} from "@/lib/data/settings";
import {
  MEMBER_ROLES,
  PERMISSION_GROUPS,
  PERMISSION_LABEL,
  ROLE_LABEL,
  ROLE_PRESETS,
  STATUS_LABEL,
  hasPermission,
  normalizePermissions,
  type MemberRole,
  type PermissionKey,
} from "@/lib/permissions";

type SectionKey = "profile" | "rules" | "cats" | "drive" | "team";

const SECTIONS: {
  key: SectionKey | "sub" | "team";
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
  ownerOnly?: boolean;
  permission?: PermissionKey;
}[] = [
  { key: "profile", label: "프로필", icon: <IconUser /> },
  { key: "rules", label: "알림 규칙", icon: <IconBell />, permission: "settings.rules.write" },
  { key: "cats", label: "분류 카테고리", icon: <IconTag />, permission: "settings.categories.write" },
  { key: "drive", label: "Google Drive 연결", icon: <IconLink />, permission: "settings.drive.write" },
  { key: "sub", label: "구독", icon: <IconCard />, soon: true },
  { key: "team", label: "팀·회원", icon: <IconTeam />, ownerOnly: true },
];

// 콜백 redirect의 ?drive= 상태 → 사용자 메시지
const DRIVE_STATUS_MESSAGES: Record<string, string> = {
  connected: "Google Drive가 연결되었습니다. 이후 업로드한 자료가 자동 동기화됩니다.",
  denied: "Google Drive 연결이 취소되었습니다.",
  permission_denied: "Google Drive 연결을 관리할 권한이 없습니다.",
  no_refresh_token:
    "연결에 실패했습니다. Google 계정 권한을 해제한 뒤 다시 시도해 주세요(갱신 토큰 미수신).",
  state_mismatch: "보안 검증에 실패했습니다. 다시 시도해 주세요.",
  unconfigured: "서버에 Google Drive 환경변수가 설정되지 않았습니다.",
  error: "Google Drive 연결 중 오류가 발생했습니다.",
};

/** 저장 결과 공통 처리 — 성공 시 토스트+refresh, 실패 시 에러 토스트 */
type OnSaved = (ok: boolean, error: string | null) => void;

function Switch({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? " is-on" : ""}`}
      onClick={onToggle}
    >
      <span className="knob" />
    </button>
  );
}

function ProfileSection({
  profile,
  onSaved,
}: {
  profile: SettingsProfile;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [nameError, setNameError] = useState<string | undefined>();
  const [form, setForm] = useState({
    name: profile.name,
    title: profile.title ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    senderName: profile.senderName ?? "",
    senderPhone: profile.senderPhone ?? "",
  });

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError("이름을 입력해 주세요.");
      return;
    }
    setNameError(undefined);
    startTransition(async () => {
      const result = await updateProfile({
        name: form.name,
        title: form.title || null,
        phone: form.phone || null,
        email: form.email || null,
        senderName: form.senderName || null,
        senderPhone: form.senderPhone || null,
      });
      onSaved(result.ok, result.error);
    });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="sp-head">
        <h2>프로필</h2>
        <p>본인 정보와 알림톡 발신 정보를 관리합니다.</p>
      </div>
      <div className="sp-body">
        <div className="field-grid">
          <div className="sub-h">기본 정보</div>
          <InputField
            label="이름"
            value={form.name}
            onChange={set("name")}
            error={nameError}
          />
          <InputField label="직함" value={form.title} onChange={set("title")} />
          <MaskedInputField
            mask="phone"
            label="연락처"
            value={form.phone}
            onChange={set("phone")}
            placeholder="010-0000-0000"
          />
          <InputField
            label="이메일"
            type="email"
            value={form.email}
            onChange={set("email")}
          />
          <div className="sub-h">알림톡 발신 정보</div>
          <InputField
            label="발신 프로필명"
            value={form.senderName}
            onChange={set("senderName")}
          />
          <MaskedInputField
            mask="phone"
            label="발신번호"
            value={form.senderPhone}
            onChange={set("senderPhone")}
            placeholder="1666-0000"
          />
        </div>
      </div>
      <div className="sp-foot">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

// 빠른 추가용 프리셋 — 이 외 임의 일수도 직접 추가 가능 (GWJ-017)
const LEAD_DAY_PRESETS = [30, 14, 7, 3, 1];

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

// 일일 요약 시각 선택지 — 06:00 ~ 22:00 정시
const SUMMARY_TIMES = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  const value = `${String(h).padStart(2, "0")}:00`;
  const label =
    h < 12 ? `오전 ${h}:00` : h === 12 ? `오후 12:00` : `오후 ${h - 12}:00`;
  return { value, label };
});

function RulesSection({
  profile,
  onSaved,
}: {
  profile: SettingsProfile;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [leadDays, setLeadDays] = useState<number[]>(profile.notifyLeadDays);
  const [newLead, setNewLead] = useState("");
  const [channels, setChannels] = useState<string[]>(profile.notifyChannels);

  const sortedLeadDays = [...leadDays].sort((a, b) => b - a);

  function addLeadDay(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 365) return;
    setLeadDays((l) => (l.includes(value) ? l : [...l, value]));
  }

  function addNewLead() {
    const value = Number.parseInt(newLead, 10);
    addLeadDay(value);
    setNewLead("");
  }
  const [match, setMatch] = useState(profile.notifyMatch);
  const [dailyOn, setDailyOn] = useState(profile.dailySummaryAt !== null);
  const [dailyAt, setDailyAt] = useState(profile.dailySummaryAt ?? "09:00");

  function save() {
    startTransition(async () => {
      const result = await updateNotifyRules({
        leadDays,
        channels,
        notifyMatch: match,
        dailySummaryAt: dailyOn ? dailyAt : null,
      });
      onSaved(result.ok, result.error);
    });
  }

  return (
    <div className="panel">
      <div className="sp-head">
        <h2>알림 규칙</h2>
        <p>만료·마감 사전 알림 시점과 발송 채널, 요약 알림을 설정합니다.</p>
      </div>
      <div className="sp-body">
        <div className="grp-label">만료·마감 사전 알림 시점</div>
        <p className="sr-s" style={{ marginBottom: 12 }}>
          설정한 D-day마다 사전 알림이 발송됩니다. 원하는 일수를 자유롭게
          추가·삭제할 수 있습니다.
        </p>
        <div className="lead-day-chips">
          {sortedLeadDays.length === 0 ? (
            <span className="sr-s">설정된 사전 알림이 없습니다.</span>
          ) : (
            sortedLeadDays.map((day) => (
              <span key={day} className="lead-day-chip num">
                D-{day}
                <button
                  type="button"
                  aria-label={`D-${day} 제거`}
                  onClick={() =>
                    setLeadDays((l) => l.filter((d) => d !== day))
                  }
                >
                  <IconX />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="lead-day-add">
          <div className="lead-day-presets">
            {LEAD_DAY_PRESETS.filter((d) => !leadDays.includes(d)).map((day) => (
              <button
                key={day}
                type="button"
                className="pill-tab"
                onClick={() => addLeadDay(day)}
              >
                <IconPlus /> D-{day}
              </button>
            ))}
          </div>
          <div className="lead-day-custom">
            <input
              type="number"
              min={1}
              max={365}
              inputMode="numeric"
              className="input"
              placeholder="직접 입력 (일)"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNewLead();
                }
              }}
              aria-label="사전 알림 일수 직접 입력"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addNewLead}
            >
              추가
            </Button>
          </div>
        </div>

        <div className="grp-label mt">발송 채널</div>
        <div className="setrow">
          <div className="sr-body">
            <div className="sr-t">이메일</div>
            <div className="sr-s">
              {profile.email
                ? `${profile.email} 로 발송`
                : "프로필에 이메일을 등록하면 해당 주소로 발송됩니다"}
            </div>
          </div>
          <Switch
            on={channels.includes("email")}
            label="이메일 채널"
            onToggle={() => setChannels((c) => toggleIn(c, "email"))}
          />
        </div>
        <div className="setrow">
          <div className="sr-body">
            <div className="sr-t">알림톡</div>
            <div className="sr-s">카카오 알림톡으로 발송</div>
          </div>
          <Switch
            on={channels.includes("alimtalk")}
            label="알림톡 채널"
            onToggle={() => setChannels((c) => toggleIn(c, "alimtalk"))}
          />
        </div>

        <div className="grp-label mt">기타</div>
        <div className="setrow">
          <div className="sr-body">
            <div className="sr-t">공고매칭 알림</div>
            <div className="sr-s">
              기업 프로파일에 맞는 신규 공고를 매칭해 알립니다.
            </div>
          </div>
          <Switch
            on={match}
            label="공고매칭 알림"
            onToggle={() => setMatch((m) => !m)}
          />
        </div>
        <div className="setrow">
          <div className="sr-body">
            <div className="sr-t">일일 요약 알림</div>
            <div className="sr-s">
              매일 정해진 시각에 그날의 임박 항목을 모아 발송
            </div>
          </div>
          <div className="daily-ctl">
            <select
              className="selbox num"
              value={dailyAt}
              onChange={(e) => setDailyAt(e.target.value)}
              disabled={!dailyOn}
              aria-label="일일 요약 시각"
            >
              {SUMMARY_TIMES.map((t) => (
                <option key={t.value} value={t.value}>
                  매일 {t.label}
                </option>
              ))}
            </select>
            <Switch
              on={dailyOn}
              label="일일 요약 알림"
              onToggle={() => setDailyOn((d) => !d)}
            />
          </div>
        </div>
      </div>
      <div className="sp-foot">
        <Button onClick={save} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({
  category,
  onSaved,
}: {
  category: SettingsCategory;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭·ESC로 팔레트 닫기
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(color: string | null) {
    setOpen(false);
    if (color === category.color) return;
    startTransition(async () => {
      const result = await setCategoryColor(category.id, color);
      onSaved(result.ok, result.error);
    });
  }

  return (
    <div className="cat-sw-wrap" ref={ref}>
      <button
        type="button"
        className="cat-sw"
        title="색상 지정"
        aria-label={`${category.name} 색상 지정`}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={pending}
        style={category.color ? { background: category.color } : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {category.color ? null : <IconPalette />}
      </button>
      {open ? (
        <div className="cat-palette" role="menu">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="menuitemradio"
              aria-checked={category.color === color}
              className={`cat-sw-opt${category.color === color ? " is-sel" : ""}`}
              style={{ background: color }}
              title={color}
              aria-label={color}
              onClick={() => pick(color)}
            >
              {category.color === color ? <IconCheck /> : null}
            </button>
          ))}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!category.color}
            className={`cat-sw-opt cat-sw-none${!category.color ? " is-sel" : ""}`}
            title="색상 없음"
            aria-label="색상 없음"
            onClick={() => pick(null)}
          >
            <IconX />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CatRow({
  category,
  onSaved,
}: {
  category: SettingsCategory;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  function save() {
    if (!name.trim() || name.trim() === category.name) {
      setEditing(false);
      setName(category.name);
      return;
    }
    startTransition(async () => {
      const result = await renameCategory(category.id, name);
      if (result.ok) setEditing(false);
      onSaved(result.ok, result.error);
    });
  }

  return (
    <div className="cat-row">
      <ColorPicker category={category} onSaved={onSaved} />
      {editing ? (
        <div className="cat-edit">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setName(category.name);
              }
            }}
            aria-label="카테고리 이름"
            autoFocus
          />
          <Button size="sm" onClick={save} disabled={pending}>
            <IconCheck /> {pending ? "저장 중…" : "저장"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setName(category.name);
            }}
            disabled={pending}
          >
            <IconX /> 취소
          </Button>
        </div>
      ) : (
        <>
          <div>
            <div className="cn">{category.name}</div>
            <div className="cmeta">
              {category.color
                ? `색상 ${category.color}`
                : "색상 미정 — 중립 칩으로 표시"}
            </div>
          </div>
          <div className="spacer" />
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <IconEdit /> 이름 수정
          </Button>
        </>
      )}
    </div>
  );
}

function CatsSection({
  categories,
  onSaved,
}: {
  categories: SettingsCategory[];
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function add() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await addCategory(newName);
      if (result.ok) {
        setAdding(false);
        setNewName("");
      }
      onSaved(result.ok, result.error);
    });
  }

  return (
    <div className="panel">
      <div className="sp-head">
        <h2>분류 카테고리</h2>
        <p>
          과제·자격에 사용하는 분류 카테고리입니다. 왼쪽 원형 색상 칩을 눌러
          카테고리 색을 지정할 수 있습니다.
        </p>
      </div>
      <div className="sp-body">
        {categories.length === 0 ? (
          <EmptyState
            bare
            icon={<IconTag />}
            title="카테고리가 없습니다"
            description="자격·과제 분류에 사용할 카테고리를 추가해 주세요."
          />
        ) : (
          categories.map((c) => (
            <CatRow key={c.id} category={c} onSaved={onSaved} />
          ))
        )}
        <div className="cat-add">
          {adding ? (
            <div className="cat-edit">
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
                placeholder="새 카테고리 이름"
                aria-label="새 카테고리 이름"
                autoFocus
              />
              <Button size="sm" onClick={add} disabled={pending}>
                <IconCheck /> {pending ? "추가 중…" : "추가"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
                disabled={pending}
              >
                <IconX /> 취소
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <IconPlus /> 카테고리 추가
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DriveSection({
  drive,
  showToast,
}: {
  drive: SettingsDrive;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const connection = drive.connection;

  function disconnect() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/google-drive/disconnect", {
          method: "POST",
        });
        const body = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !body.ok) {
          showToast(body.error ?? "연결 해제에 실패했습니다.");
          return;
        }
        showToast("Google Drive 연결을 해제했습니다.");
        router.refresh();
      } catch {
        showToast("연결 해제 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="panel">
      <div className="sp-head">
        <h2>Google Drive 연결</h2>
        <p>
          연결하면 이후 기업 상세 &gt; 자료에 업로드한 파일이 Supabase에 저장된 뒤
          내 Google Drive에도 자동 복제됩니다. 원본은 계속 Supabase에 보관됩니다.
        </p>
      </div>
      <div className="sp-body">
        {!drive.configured ? (
          <div className="auth-notice">
            <IconAlert /> 서버에 Google Drive 환경변수가 설정되지 않아 연결할 수
            없습니다. 관리자에게 문의해 주세요.
          </div>
        ) : connection ? (
          <>
            <div className="setrow">
              <div className="sr-body">
                <div className="sr-t">
                  연결됨
                  {connection.googleEmail ? ` · ${connection.googleEmail}` : ""}
                </div>
                <div className="sr-s">
                  {connection.rootFolderName
                    ? `“${connection.rootFolderName}” 폴더 아래 기업별 폴더로 동기화 · `
                    : ""}
                  {formatKstDate(connection.connectedAt)} 연결
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={disconnect}
                disabled={pending}
              >
                {pending ? "해제 중…" : "연결 해제"}
              </Button>
            </div>
            {drive.failedCount > 0 ? (
              <div className="auth-error" style={{ marginTop: 12 }}>
                <IconAlert /> 동기화하지 못한 파일이 {drive.failedCount}건 있습니다.
                구글 권한이 만료되었을 수 있어요.{" "}
                <a className="drive-relink" href="/api/google-drive/connect">
                  다시 연결하기
                </a>
              </div>
            ) : null}
            <p className="sr-s" style={{ marginTop: 12 }}>
              동기화는 백그라운드에서 처리되며, 일시적 실패 시 자동으로 재시도됩니다.
            </p>
          </>
        ) : (
          <div className="drive-connect-guide">
            <div className="dcg-head">
              <IconLink />
              <div>
                <div className="sr-t">아직 연결되지 않았습니다</div>
                <div className="sr-s">
                  구글 계정으로 <b>한 번만</b> 연결하면, 이후 올린 자료가 자동으로 내
                  드라이브에 저장됩니다.
                </div>
              </div>
            </div>
            <ol className="drive-steps">
              <li>
                아래 <b>[Google Drive 연결]</b> 버튼을 누릅니다.
              </li>
              <li>
                본인 <b>구글 계정</b>을 선택합니다.
              </li>
              <li>
                <b>[허용]</b>을 누르면 끝납니다.
              </li>
            </ol>
            <p className="sr-s">
              관제는 <b>이 앱에서 올린 파일만</b> 접근하며, 구글 비밀번호는 저장하지
              않습니다(최소 권한 <code>drive.file</code>).
            </p>
            <a className="btn btn--cta" href="/api/google-drive/connect">
              <IconLink /> Google Drive 연결
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function togglePermission(
  permissions: PermissionKey[],
  permission: PermissionKey,
): PermissionKey[] {
  return permissions.includes(permission)
    ? permissions.filter((item) => item !== permission)
    : [...permissions, permission];
}

function PermissionChecklist({
  role,
  permissions,
  onChange,
  disabled,
}: {
  role: MemberRole;
  permissions: PermissionKey[];
  onChange: (permissions: PermissionKey[]) => void;
  disabled?: boolean;
}) {
  const effective = normalizePermissions(role, permissions);
  const isOwner = role === "owner";

  return (
    <div className="perm-grid">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.title} className="perm-group">
          <div className="perm-group-title">{group.title}</div>
          {group.keys.map((key) => (
            <label key={key} className="perm-check">
              <input
                type="checkbox"
                checked={effective.includes(key)}
                disabled={disabled || isOwner}
                onChange={() => onChange(togglePermission(effective, key))}
              />
              <span>{PERMISSION_LABEL[key]}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="selbox"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as MemberRole)}
      aria-label="역할"
    >
      {MEMBER_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </select>
  );
}

function TeamMemberRow({
  member,
  onSaved,
}: {
  member: SettingsTeamMember;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<MemberRole>(member.role);
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    member.permissions,
  );
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const disabled = member.status === "disabled";
  const locked = member.isCurrentUser || disabled;

  function changeRole(next: MemberRole) {
    setRole(next);
    setPermissions([...ROLE_PRESETS[next]]);
  }

  function save() {
    startTransition(async () => {
      const result = await updateTeamMember({
        memberId: member.id,
        role,
        permissions: normalizePermissions(role, permissions),
      });
      onSaved(result.ok, result.error);
    });
  }

  function disable() {
    startTransition(async () => {
      const result = await disableTeamMember(member.id);
      setConfirmingDisable(false);
      onSaved(result.ok, result.error);
    });
  }

  function reactivate() {
    startTransition(async () => {
      const result = await reactivateTeamMember(member.id);
      onSaved(result.ok, result.error);
    });
  }

  return (
    <div className={`team-row${disabled ? " is-disabled" : ""}`}>
      <div className="team-row-main">
        <div className="avatar">{member.name.slice(0, 1)}</div>
        <div className="team-ident">
          <div>
            <b>{member.name}</b>
            {member.isCurrentUser ? <span className="mini-badge">본인</span> : null}
            <span className={`status-badge status-badge--${member.status}`}>
              {STATUS_LABEL[member.status]}
            </span>
          </div>
          <p>
            {member.title || "직함 미입력"}
            {member.email ? ` · ${member.email}` : ""}
          </p>
        </div>
        <div className="spacer" />
        <RoleSelect value={role} onChange={changeRole} disabled={locked} />
      </div>
      <PermissionChecklist
        role={role}
        permissions={permissions}
        onChange={setPermissions}
        disabled={locked}
      />
      <div className="team-actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={save}
          disabled={pending || locked}
        >
          {pending ? "저장 중…" : "권한 저장"}
        </Button>
        {member.isCurrentUser ? null : disabled ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={reactivate}
            disabled={pending}
          >
            {pending ? "처리 중…" : "재활성화"}
          </Button>
        ) : confirmingDisable ? (
          <span className="team-confirm">
            <span className="team-confirm-text">
              로그인·데이터 접근이 즉시 차단됩니다. 계속할까요?
            </span>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={disable}
              disabled={pending}
            >
              {pending ? "처리 중…" : "비활성화 확정"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDisable(false)}
              disabled={pending}
            >
              취소
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirmingDisable(true)}
            disabled={pending}
          >
            비활성화
          </Button>
        )}
      </div>
    </div>
  );
}

function TeamSection({
  data,
  onSaved,
}: {
  data: SettingsData;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    title: "",
    email: "",
  });
  const [role, setRole] = useState<MemberRole>("member");
  const [permissions, setPermissions] = useState<PermissionKey[]>([
    ...ROLE_PRESETS.member,
  ]);

  function set(key: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setForm((value) => ({ ...value, [key]: e.target.value }));
  }

  function changeRole(next: MemberRole) {
    setRole(next);
    setPermissions([...ROLE_PRESETS[next]]);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteTeamMember({
        name: form.name,
        title: form.title || null,
        email: form.email,
        role,
        permissions: normalizePermissions(role, permissions),
      });
      if (result.ok) {
        setForm({ name: "", title: "", email: "" });
        setRole("member");
        setPermissions([...ROLE_PRESETS.member]);
      }
      onSaved(result.ok, result.error);
    });
  }

  if (!data.currentMember.canManageTeam) {
    return (
      <div className="panel">
        <div className="sp-head">
          <h2>팀·회원</h2>
          <p>팀원 초대와 권한 관리는 최고관리자만 사용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-stack">
      <form className="panel" onSubmit={submit}>
        <div className="sp-head">
          <h2>팀원 초대</h2>
          <p>메일 초대 링크를 보내고, 역할 프리셋과 기능별 권한을 지정합니다.</p>
        </div>
        <div className="sp-body">
          <div className="field-grid">
            <InputField
              label="이름"
              value={form.name}
              onChange={set("name")}
              required
            />
            <InputField
              label="직함"
              value={form.title}
              onChange={set("title")}
              placeholder="예: 선임 컨설턴트"
            />
            <InputField
              label="이메일"
              type="email"
              value={form.email}
              onChange={set("email")}
              required
            />
            <div className="field">
              <label>역할</label>
              <RoleSelect value={role} onChange={changeRole} />
            </div>
          </div>
          <div className="grp-label mt">기능 권한</div>
          <PermissionChecklist
            role={role}
            permissions={permissions}
            onChange={setPermissions}
          />
        </div>
        <div className="sp-foot">
          <Button type="submit" disabled={pending}>
            {pending ? "초대 중…" : "초대 보내기"}
          </Button>
        </div>
      </form>

      <div className="panel">
        <div className="sp-head">
          <h2>팀원 목록</h2>
          <p>비활성화된 팀원은 로그인과 데이터 접근이 차단되며, 기존 기록은 보존됩니다.</p>
        </div>
        <div className="sp-body team-list">
          {data.teamMembers.map((member) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              onSaved={onSaved}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast } = useToast();
  const [section, setSection] = useState<SectionKey>("profile");

  // (1) OAuth 콜백 redirect(?drive=) → 메시지 + Drive 섹션, (2) 딥링크(?section=drive)
  // → 해당 섹션으로 이동(자료 탭 "연결하기" 배너에서 진입).
  useEffect(() => {
    const status = searchParams.get("drive");
    const sectionParam = searchParams.get("section");
    if (!status && !sectionParam) return;
    if (status || sectionParam === "drive") setSection("drive");
    else if (sectionParam) setSection(sectionParam as SectionKey);
    if (status) {
      showToast(
        DRIVE_STATUS_MESSAGES[status] ?? "Google Drive 상태가 갱신되었습니다.",
      );
    }
    // 쿼리 정리 — 새로고침 시 메시지/이동 반복 방지
    router.replace("/app/settings");
    // searchParams는 안정적이지 않으므로 status/section 변화에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onSaved: OnSaved = (ok, error) => {
    if (ok) {
      showToast("저장되었습니다");
      router.refresh();
    } else {
      showToast(error ?? "저장에 실패했습니다.");
    }
  };

  return (
    <>
      <div className="set-grid">
        <nav className="set-nav" aria-label="설정 섹션">
          {SECTIONS.map((s) => {
            const missingOwner = s.ownerOnly && !data.currentMember.canManageTeam;
            const missingPermission =
              s.permission &&
              !hasPermission(data.currentMember, s.permission);
            const disabled = s.soon || missingOwner || missingPermission;
            return (
              <button
                key={s.key}
                type="button"
                className={`sn${section === s.key ? " is-active" : ""}`}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) setSection(s.key as SectionKey);
                }}
              >
                {s.icon}
                <span>{s.label}</span>
                {s.soon ? <span className="cs-badge">Coming soon</span> : null}
                {missingOwner || missingPermission ? (
                  <span className="cs-badge">권한 없음</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div>
          {section === "profile" ? (
            <ProfileSection profile={data.profile} onSaved={onSaved} />
          ) : null}
          {section === "rules" ? (
            <RulesSection profile={data.profile} onSaved={onSaved} />
          ) : null}
          {section === "cats" ? (
            <CatsSection categories={data.categories} onSaved={onSaved} />
          ) : null}
          {section === "drive" ? (
            <DriveSection drive={data.drive} showToast={showToast} />
          ) : null}
          {section === "team" ? (
            <TeamSection data={data} onSaved={onSaved} />
          ) : null}
        </div>
      </div>

      <Toast message={toast} />
    </>
  );
}

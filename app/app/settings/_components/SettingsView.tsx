"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField, MaskedInputField } from "@/components/ui/Input";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconBell,
  IconCard,
  IconCheck,
  IconEdit,
  IconPalette,
  IconPlus,
  IconTag,
  IconTeam,
  IconUser,
  IconX,
} from "@/components/ui/icons";
import {
  addCategory,
  renameCategory,
  updateNotifyRules,
  updateProfile,
} from "@/lib/actions/settings";
import type {
  SettingsCategory,
  SettingsData,
  SettingsProfile,
} from "@/lib/data/settings";

type SectionKey = "profile" | "rules" | "cats";

const SECTIONS: {
  key: SectionKey | "sub" | "team";
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
}[] = [
  { key: "profile", label: "프로필", icon: <IconUser /> },
  { key: "rules", label: "알림 규칙", icon: <IconBell /> },
  { key: "cats", label: "분류 카테고리", icon: <IconTag /> },
  { key: "sub", label: "구독", icon: <IconCard />, soon: true },
  { key: "team", label: "팀·회원", icon: <IconTeam />, soon: true },
];

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

const LEAD_DAY_ROWS: { day: number; desc: string }[] = [
  { day: 7, desc: "만료·마감 7일 전 알림" },
  { day: 3, desc: "3일 전 — 긴급 단계 진입" },
  { day: 1, desc: "하루 전 최종 리마인드" },
];

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
  const [channels, setChannels] = useState<string[]>(profile.notifyChannels);
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
        {LEAD_DAY_ROWS.map(({ day, desc }) => (
          <div key={day} className="setrow">
            <span className="dn-chip num">D-{day}</span>
            <div className="sr-body">
              <div className="sr-t">D-{day} 사전 알림</div>
              <div className="sr-s">{desc}</div>
            </div>
            <Switch
              on={leadDays.includes(day)}
              label={`D-${day} 사전 알림`}
              onToggle={() => setLeadDays((l) => toggleIn(l, day))}
            />
          </div>
        ))}

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
      <span
        className="cat-sw"
        title="색상 — 카테고리 색 토큰 정식 정의 전까지 중립 표시"
        style={category.color ? { background: category.color } : undefined}
      >
        {category.color ? null : <IconPalette />}
      </span>
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
          과제·자격에 사용하는 분류 카테고리입니다. 색상은 디자인 시스템 토큰
          정식 정의 후 지정할 수 있습니다.
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

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [section, setSection] = useState<SectionKey>("profile");

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
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`sn${section === s.key ? " is-active" : ""}`}
              disabled={s.soon}
              onClick={() => {
                if (!s.soon) setSection(s.key as SectionKey);
              }}
            >
              {s.icon}
              <span>{s.label}</span>
              {s.soon ? <span className="cs-badge">Coming soon</span> : null}
            </button>
          ))}
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
        </div>
      </div>

      <Toast message={toast} />
    </>
  );
}

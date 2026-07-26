"use client";

// 설정 → 알림톡: Solapi 계정 연동 + 카카오 검수 완료 템플릿 관리.
// 발송 요금은 각 워크스페이스가 연결한 Solapi 계정에서 차감되므로
// 충전은 Solapi 콘솔에서 하고, 여기서는 잔액을 보여주기만 한다.
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField, MaskedInputField } from "@/components/ui/Input";
import { IconAlert, IconCheck, IconPlus, IconX } from "@/components/ui/icons";
import {
  disconnectAlimtalk,
  saveAlimtalkSettings,
} from "@/lib/actions/alimtalk-settings";
import {
  createAlimtalkTemplate,
  deleteAlimtalkTemplate,
  updateAlimtalkTemplate,
} from "@/lib/actions/alimtalk-templates";
import type {
  SettingsAlimtalk,
  SettingsAlimtalkTemplate,
} from "@/lib/data/settings";

type OnSaved = (ok: boolean, error: string | null) => void;

const SETUP_STEPS = [
  "카카오톡 채널을 개설하고 비즈니스 인증을 받습니다(사업자등록증 필요).",
  "Solapi에 가입해 그 채널을 연동하면 채널 ID(pfId)가 발급됩니다.",
  "발신번호를 사전 등록합니다(알림톡 실패 시 문자 대체발송에 사용).",
  "보낼 문구를 템플릿으로 등록해 카카오 검수를 받습니다(영업일 1~3일).",
  "Solapi에 잔액을 충전합니다 — 발송 요금은 이 계정에서 차감됩니다.",
];

export function AlimtalkSection({
  alimtalk,
  onSaved,
}: {
  alimtalk: SettingsAlimtalk;
  onSaved: OnSaved;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [formTemplate, setFormTemplate] = useState<
    SettingsAlimtalkTemplate | "new" | null
  >(null);

  const connection = alimtalk.connection;
  const showForm = editing || !connection;

  function submitConnection(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveAlimtalkSettings(formData);
      if (result.ok) setEditing(false);
      onSaved(result.ok, result.error);
    });
  }

  function submitDisconnect() {
    if (
      !window.confirm("알림톡 연동을 해제하면 실제 발송이 중단됩니다. 계속할까요?")
    ) {
      return;
    }
    startTransition(async () => {
      const result = await disconnectAlimtalk();
      onSaved(result.ok, result.error);
    });
  }

  function submitTemplate(
    formData: FormData,
    target: SettingsAlimtalkTemplate | "new",
  ) {
    startTransition(async () => {
      const result =
        target === "new"
          ? await createAlimtalkTemplate(formData)
          : await updateAlimtalkTemplate(target.id, formData);
      if (result.ok) setFormTemplate(null);
      onSaved(result.ok, result.error);
    });
  }

  function removeTemplate(template: SettingsAlimtalkTemplate) {
    if (!window.confirm(`"${template.name}" 템플릿을 삭제할까요?`)) return;
    startTransition(async () => {
      const result = await deleteAlimtalkTemplate(template.id);
      onSaved(result.ok, result.error);
    });
  }

  return (
    <>
      <div className="panel">
        <div className="sp-head">
          <h2>알림톡 연동</h2>
          <p>
            일괄안내를 대표님들의 카카오톡으로 실제 발송하려면 Solapi 계정을
            연결해야 합니다. 발송 요금은 연결한 계정에서 직접 차감됩니다.
          </p>
        </div>
        <div className="sp-body">
          {!alimtalk.configured ? (
            <div className="auth-notice">
              <IconAlert /> 서버에 알림톡 환경변수(ALIMTALK_ENABLED,
              ALIMTALK_CRED_KEY)가 설정되지 않아 연결할 수 없습니다. 관리자에게
              문의해 주세요.
            </div>
          ) : null}

          {connection && !editing ? (
            <>
              <div className="setrow">
                <div className="sr-body">
                  <div className="sr-t">
                    연결됨 · 잔액{" "}
                    {connection.balance !== null
                      ? `${connection.balance.toLocaleString("ko-KR")}원`
                      : "조회 실패"}
                  </div>
                  <div className="sr-s">
                    API 키 {connection.maskedApiKey} · 채널 {connection.pfId} ·
                    발신번호 {connection.senderPhone} · 문자 대체발송{" "}
                    {connection.smsFallback ? "사용" : "미사용"}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(true)}
                  disabled={pending}
                >
                  수정
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={submitDisconnect}
                  disabled={pending}
                >
                  {pending ? "해제 중…" : "연결 해제"}
                </Button>
              </div>
              {connection.balance !== null && connection.balance < 10000 ? (
                <div className="auth-error" style={{ marginTop: 12 }}>
                  <IconAlert /> 잔액이 부족하면 발송이 실패합니다.{" "}
                  <a
                    href="https://console.solapi.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Solapi 콘솔에서 충전하기
                  </a>
                </div>
              ) : null}
              <p className="sr-s" style={{ marginTop: 12 }}>
                충전과 템플릿 검수 신청은 Solapi 콘솔에서 진행합니다. API
                시크릿은 암호화해 보관하며 화면에 다시 표시되지 않습니다.
              </p>
            </>
          ) : null}

          {showForm ? (
            <form onSubmit={submitConnection}>
              {!connection ? (
                <>
                  <div className="sr-t">아직 연결되지 않았습니다</div>
                  <ol className="drive-steps">
                    {SETUP_STEPS.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </>
              ) : null}
              <div className="field-grid">
                <div className="sub-h">Solapi 인증 정보</div>
                <InputField
                  label="API 키"
                  name="api_key"
                  autoComplete="off"
                  placeholder="NCS..."
                  required
                />
                <InputField
                  label="API 시크릿"
                  name="api_secret"
                  type="password"
                  autoComplete="new-password"
                  required
                />
                <div className="sub-h">발신 정보</div>
                <InputField
                  label="카카오 채널 ID (pfId)"
                  name="pf_id"
                  autoComplete="off"
                  placeholder="KA01PF..."
                  required
                />
                <MaskedInputField
                  mask="phone"
                  label="발신번호"
                  name="sender_phone"
                  placeholder="010-0000-0000"
                  required
                />
              </div>
              <label className="perm-check" style={{ marginTop: 16 }}>
                <input type="checkbox" name="sms_fallback" defaultChecked />
                <span>
                  알림톡 실패 시 문자로 대체발송 — 수신자가 채널을 차단했거나
                  카카오톡을 쓰지 않아도 안내가 도달합니다(문자 요금 별도).
                </span>
              </label>
              <p className="sr-s" style={{ marginTop: 12 }}>
                저장할 때 Solapi에 접속해 키가 유효한지 확인합니다.
              </p>
              <div className="sp-foot" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {connection ? (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={pending}
                  >
                    취소
                  </Button>
                ) : null}
                <Button
                  variant="cta"
                  type="submit"
                  disabled={pending || !alimtalk.configured}
                >
                  {pending ? "확인 중…" : "연동 저장"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="sp-head">
          <h2>알림톡 템플릿</h2>
          <p>
            알림톡은 카카오 검수를 통과한 템플릿으로만 발송됩니다. Solapi
            콘솔에서 등록·검수한 뒤, 발급된 템플릿 ID와 승인된 본문을 그대로
            추가해 주세요.
          </p>
        </div>
        <div className="sp-body">
          {formTemplate !== null ? (
            <TemplateForm
              template={formTemplate === "new" ? null : formTemplate}
              pending={pending}
              onCancel={() => setFormTemplate(null)}
              onSubmit={(formData) => submitTemplate(formData, formTemplate)}
            />
          ) : (
            <button
              type="button"
              className="pill-btn"
              onClick={() => setFormTemplate("new")}
              disabled={pending}
            >
              <IconPlus /> 템플릿 추가
            </button>
          )}

          {alimtalk.templates.length === 0 ? (
            <p className="sr-s" style={{ marginTop: 16 }}>
              등록된 템플릿이 없습니다. 템플릿이 하나도 없으면 일괄안내를 발송할
              수 없습니다.
            </p>
          ) : (
            <div style={{ marginTop: 16 }}>
              {alimtalk.templates.map((template) => (
                <div key={template.id} className="setrow">
                  <div className="sr-body">
                    <div className="sr-t">
                      {template.name}
                      {template.isActive ? null : (
                        <span className="mini-badge" style={{ marginLeft: 8 }}>
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="sr-s num">{template.solapiTemplateId}</div>
                    <div className="sr-s" style={{ whiteSpace: "pre-wrap" }}>
                      {template.content}
                    </div>
                    {template.variables.length > 0 ? (
                      <div className="sr-s">
                        변수 {template.variables.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setFormTemplate(template)}
                    disabled={pending}
                  >
                    수정
                  </Button>
                  <button
                    type="button"
                    className="cond-x"
                    onClick={() => removeTemplate(template)}
                    disabled={pending}
                    aria-label="템플릿 삭제"
                    title="템플릿 삭제"
                  >
                    <IconX />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TemplateForm({
  template,
  pending,
  onCancel,
  onSubmit,
}: {
  template: SettingsAlimtalkTemplate | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  // 본문을 입력하는 즉시 어떤 변수가 잡히는지 보여준다 — Solapi는 승인 템플릿과
  // 변수 집합이 다르면 발송을 거절하므로 여기서 확인시키는 편이 안전하다.
  const [content, setContent] = useState(template?.content ?? "");
  const detected = Array.from(new Set(content.match(/#\{[^}]+\}/g) ?? []));

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={submit}>
      <div className="field-grid">
        <InputField
          label="템플릿 이름"
          name="name"
          defaultValue={template?.name ?? ""}
          placeholder="자격 만료 사전 안내"
          required
        />
        <InputField
          label="Solapi 템플릿 ID"
          name="solapi_template_id"
          defaultValue={template?.solapiTemplateId ?? ""}
          placeholder="KA01TP..."
          required
        />
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="tpl-content">검수 완료 본문</label>
        <textarea
          id="tpl-content"
          name="content"
          className="memo-input msg-area"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"안녕하세요 #{기업명} #{담당자명}님,\n..."}
          required
        />
      </div>
      {detected.length > 0 ? (
        <p className="sr-s">
          <IconCheck /> 감지된 변수 {detected.join(", ")} — 발송 시 기업명과
          담당자명이 자동으로 채워집니다.
        </p>
      ) : null}
      <label className="perm-check" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={template?.isActive ?? true}
        />
        <span>일괄안내에서 사용</span>
      </label>
      <div className="sp-foot" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          disabled={pending}
        >
          취소
        </Button>
        <Button variant="cta" type="submit" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

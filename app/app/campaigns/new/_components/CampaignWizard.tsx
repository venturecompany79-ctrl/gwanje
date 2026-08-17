"use client";

// 캠페인 작성 3스텝 마법사 — ①세그먼트 ②메시지 ③발송 확인 (스펙 5절 B)
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconAlert,
  IconArrow,
  IconBack,
  IconBolt,
  IconBuilding,
  IconCheck,
  IconClock,
  IconInfo,
  IconPlus,
  IconSend,
  IconX,
} from "@/components/ui/icons";
import { createCampaign } from "@/lib/actions/campaigns";
import { normalizeKoreanMobile } from "@/lib/alimtalk/phone";
import type { WizardTemplate } from "@/lib/data/campaigns";
import {
  evaluateSegment,
  SEGMENT_FIELDS,
  SEGMENT_FIELD_LABEL,
  SEGMENT_OPS,
  type SegmentCompany,
  type SegmentField,
  type SegmentJoin,
  type SegmentOp,
  type SegmentRule,
} from "@/lib/segments";

const STEP_LABELS = ["세그먼트", "메시지", "발송 확인"];

// 알림톡 템플릿 — 게이트웨이 연동 전 고정 3종
const TEMPLATES = [
  {
    id: "renewal",
    name: "[갱신 안내] 자격 만료 사전 안내",
    body: "안녕하세요 {기업명} {담당자명}님,\n보유하신 자격·인증의 유효기간 만료가 다가옵니다.\n갱신 신청 절차를 안내드리니 아래 버튼에서 확인 부탁드립니다.\n\n— 관제 by Growth Partners",
    cta: "갱신 안내 확인하기",
  },
  {
    id: "deadline",
    name: "[마감 안내] 신청 마감 리마인드",
    body: "안녕하세요 {기업명} {담당자명}님,\n신청 마감이 임박한 항목이 있어 안내드립니다.\n마감 전 제출 서류를 확인해 주세요.\n\n— 관제 by Growth Partners",
    cta: "마감 일정 확인하기",
  },
  {
    id: "notice",
    name: "[공고 안내] 신규 지원사업 안내",
    body: "안녕하세요 {기업명} {담당자명}님,\n귀사에 적합한 신규 지원사업 공고가 게시되어 안내드립니다.\n신청 요건과 일정을 확인해 보세요.\n\n— 관제 by Growth Partners",
    cta: "공고 확인하기",
  },
];

function defaultScheduledAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

/** datetime-local의 min 속성용 현재 시각(로컬) "YYYY-MM-DDTHH:mm" */
function nowLocalDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 필드 변경 시 해당 필드의 기본 연산자·값 */
function defaultRuleFor(
  field: SegmentField,
  options: Record<"credential" | "industry" | "condition", string[]>,
): SegmentRule {
  switch (field) {
    case "credential":
      return { field, op: "has", value: options.credential[0] ?? "" };
    case "industry":
      return { field, op: "eq", value: options.industry[0] ?? "" };
    case "condition":
      return { field, op: "eq", value: options.condition[0] ?? "" };
    case "revenue":
      return { field, op: "lte", value: 50 };
    case "due_soon":
      return { field, op: "lte", value: 30 };
  }
}

/**
 * 본문의 변수 자리를 첫 대상 기업 값으로 치환한 미리보기 노드.
 * 데모 템플릿은 {기업명}, 카카오 검수 템플릿은 #{기업명} 표기를 쓰므로 둘 다 받는다.
 */
function previewBody(
  body: string,
  sample: SegmentCompany | undefined,
): ReactNode {
  const company = sample?.name ?? "대상 기업";
  const manager = sample?.contactName ?? "담당자";
  return body.split(/(#?\{기업명\}|#?\{담당자명\})/g).map((part, i) => {
    if (part.endsWith("{기업명}") || part.endsWith("{담당자명}")) {
      return (
        <span key={i} className="vv">
          {part.endsWith("{기업명}") ? company : manager}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function CampaignWizard({
  companies,
  templates,
  live,
}: {
  companies: SegmentCompany[];
  /** 카카오 검수를 통과한 템플릿 — 실발송(live) 모드에서만 채워진다 */
  templates: WizardTemplate[];
  /** true면 실제 카카오톡으로 발송된다 */
  live: boolean;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [, startTransition] = useTransition();

  const valueOptions = useMemo(
    () => ({
      credential: [...new Set(companies.flatMap((co) => co.credentialTypes))].sort(
        (a, b) => a.localeCompare(b, "ko"),
      ),
      industry: [
        ...new Set(
          companies.flatMap((co) => (co.industry ? [co.industry] : [])),
        ),
      ].sort((a, b) => a.localeCompare(b, "ko")),
      condition: [...new Set(companies.flatMap((co) => co.conditionTags))].sort(
        (a, b) => a.localeCompare(b, "ko"),
      ),
    }),
    [companies],
  );

  // 실발송 모드에서는 카카오 승인 템플릿만 쓸 수 있다.
  const liveTemplates = live ? templates : [];
  const initialTemplate = liveTemplates[0] ?? null;

  const [step, setStep] = useState(1);
  const [rules, setRules] = useState<SegmentRule[]>(() => [
    defaultRuleFor("credential", valueOptions),
  ]);
  const [join, setJoin] = useState<SegmentJoin>("and");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState(
    initialTemplate ? initialTemplate.id : TEMPLATES[0].id,
  );
  const [body, setBody] = useState(
    initialTemplate ? initialTemplate.content : TEMPLATES[0].body,
  );
  const [when, setWhen] = useState<"now" | "sched">("now");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt);
  const [sending, setSending] = useState<"now" | "sched" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const targets = useMemo(
    () => evaluateSegment(companies, { rules, join }),
    [companies, rules, join],
  );

  // 연락처가 없거나 휴대폰 형식이 아니면 알림톡을 보낼 수 없다 — 미리 알려준다.
  const unreachable = useMemo(
    () =>
      live
        ? targets.filter((t) => normalizeKoreanMobile(t.contactPhone) === null)
        : [],
    [live, targets],
  );
  const unreachableIds = useMemo(
    () => new Set(unreachable.map((t) => t.id)),
    [unreachable],
  );
  const reachableCount = targets.length - unreachable.length;

  const liveTemplate = liveTemplates.find((t) => t.id === templateId) ?? initialTemplate;
  const demoTemplate = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const templateName = live
    ? (liveTemplate?.name ?? "템플릿 없음")
    : demoTemplate.name;

  const scheduledInPast =
    when === "sched" &&
    scheduledAt !== "" &&
    new Date(scheduledAt).getTime() <= Date.now();

  // 작성 중 이탈 경고 — 발송/예약 완료 후 이동에는 걸리지 않음(sending일 때 해제).
  const hasProgress = step > 1 || title.trim() !== "";
  useEffect(() => {
    if (!hasProgress || sending !== null) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasProgress, sending]);

  function patchRule(index: number, patch: Partial<SegmentRule>) {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  }

  function insertVariable(token: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? start;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function submit(mode: "now" | "sched") {
    if (mode === "sched" && new Date(scheduledAt).getTime() <= Date.now()) {
      showToast("예약 일시는 현재 이후로 설정해 주세요.");
      return;
    }
    if (live && !liveTemplate) {
      showToast("발송할 알림톡 템플릿을 선택해 주세요.");
      return;
    }
    setSending(mode);
    startTransition(async () => {
      const scheduled =
        mode === "sched" ? new Date(scheduledAt).toISOString() : null;
      const result = await createCampaign({
        title,
        body,
        channel: "alimtalk",
        segment: { rules, join },
        companyIds: targets.map((t) => t.id),
        scheduledAt: scheduled,
        templateId: live ? (liveTemplate?.id ?? null) : null,
      });
      if (!result.ok || !result.id) {
        setSending(null);
        showToast(result.error ?? "발송에 실패했습니다.");
        return;
      }
      router.push(
        mode === "sched"
          ? `/app/campaigns/${result.id}?scheduled=1`
          : `/app/campaigns/${result.id}?sent=${live ? reachableCount : targets.length}`,
      );
    });
  }

  const canNext =
    step === 1
      ? targets.length > 0
      : title.trim() !== "" &&
        body.trim() !== "" &&
        (!live || liveTemplate !== null);

  return (
    <>
      {/* 스텝 인디케이터 — 완료=체크 / 활성=cobalt */}
      <div className="panel steps">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state =
            step === n ? " is-active" : step > n ? " is-done" : "";
          return (
            <Fragment key={n}>
              {i > 0 ? (
                <div className={`step-conn${step > i ? " is-done" : ""}`} />
              ) : null}
              <button
                type="button"
                className={`step${state}`}
                onClick={n < step ? () => setStep(n) : undefined}
                aria-current={step === n ? "step" : undefined}
              >
                <span className="step-circ num">
                  {step > n ? <IconCheck /> : n}
                </span>
                <span className="step-label">{label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="wz-grid">
          <Panel>
            <PanelHead
              title="세그먼트 조건"
              count="대상 기업을 조건으로 추립니다"
            />
            <div className="panel-body">
              {rules.map((rule, i) => (
                <Fragment key={i}>
                  {i > 0 ? (
                    <div className="andor" role="group" aria-label="조건 결합">
                      {(["and", "or"] as const).map((j) => (
                        <button
                          key={j}
                          type="button"
                          className={join === j ? "is-on" : undefined}
                          onClick={() => setJoin(j)}
                        >
                          {j.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="cond-row">
                    <select
                      className="cond-input"
                      value={rule.field}
                      onChange={(e) =>
                        patchRule(
                          i,
                          defaultRuleFor(
                            e.target.value as SegmentField,
                            valueOptions,
                          ),
                        )
                      }
                      aria-label="조건 필드"
                    >
                      {SEGMENT_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {SEGMENT_FIELD_LABEL[f]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="cond-input cond-input--op"
                      value={rule.op}
                      onChange={(e) =>
                        patchRule(i, { op: e.target.value as SegmentOp })
                      }
                      aria-label="조건 연산자"
                    >
                      {SEGMENT_OPS[rule.field].map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    {rule.field === "revenue" || rule.field === "due_soon" ? (
                      <input
                        type="number"
                        className="cond-input num"
                        value={String(rule.value)}
                        min={0}
                        onChange={(e) =>
                          patchRule(i, { value: Number(e.target.value) })
                        }
                        aria-label="조건 값"
                      />
                    ) : (
                      <select
                        className="cond-input"
                        value={String(rule.value)}
                        onChange={(e) => patchRule(i, { value: e.target.value })}
                        aria-label="조건 값"
                      >
                        {valueOptions[rule.field].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="cond-x"
                      onClick={() =>
                        setRules((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label="조건 삭제"
                      title="조건 삭제"
                    >
                      <IconX />
                    </button>
                  </div>
                </Fragment>
              ))}
              <button
                type="button"
                className="pill-btn"
                style={{ marginTop: 8 }}
                onClick={() =>
                  setRules((prev) => [
                    ...prev,
                    defaultRuleFor("credential", valueOptions),
                  ])
                }
              >
                <IconPlus /> 조건 추가
              </button>
            </div>
          </Panel>

          <Panel>
            {targets.length === 0 ? (
              <>
                <div className="prev-head">
                  <span className="prev-count num">0</span>
                  <span className="prev-sub">개사 대상</span>
                </div>
                <div className="seg-zero">
                  <div className="seg-zero-ico">
                    <IconAlert />
                  </div>
                  <h3>조건에 맞는 기업이 없습니다</h3>
                  <p>
                    {rules.length === 0
                      ? "조건을 추가해 대상 기업을 추려보세요."
                      : "조건을 완화하거나 AND를 OR로 바꿔보세요."}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="prev-head">
                  <IconBuilding />
                  <span className="prev-count num">{targets.length}</span>
                  <span className="prev-sub">개사 대상 · 실시간</span>
                </div>
                {unreachable.length > 0 ? (
                  <p className="form-hint" style={{ padding: "0 20px 8px" }}>
                    <IconAlert /> {unreachable.length}개사는 담당자 연락처가 없어
                    발송에서 제외됩니다. 기업 정보에서 휴대폰 번호를 등록하면
                    함께 발송됩니다.
                  </p>
                ) : null}
                <div className="prev-list">
                  {targets.map((t) => (
                    <div key={t.id} className="prev-item">
                      <IconBuilding />
                      {t.name}
                      {unreachableIds.has(t.id) ? (
                        <span className="st-badge st-badge--draft" style={{ marginLeft: "auto" }}>
                          연락처 없음
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="wz-grid">
          <Panel>
            <PanelHead title="메시지 작성" />
            <div className="panel-body">
              <InputField
                label="일괄안내 제목 *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="2026 벤처확인 갱신 안내"
              />
              <div className="field" style={{ marginTop: 16 }}>
                <label htmlFor="campaign-template">알림톡 템플릿</label>
                <select
                  id="campaign-template"
                  className="input"
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    const next = live
                      ? liveTemplates.find((t) => t.id === e.target.value)
                      : TEMPLATES.find((t) => t.id === e.target.value);
                    if (next) {
                      setBody("content" in next ? next.content : next.body);
                    }
                  }}
                >
                  {live
                    ? liveTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    : TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                </select>
              </div>
              {live ? null : (
                <div className="vchips">
                  <span className="vlab">변수 삽입</span>
                  <button
                    type="button"
                    className="vchip"
                    onClick={() => insertVariable("{기업명}")}
                  >
                    <IconPlus /> {"{기업명}"}
                  </button>
                  <button
                    type="button"
                    className="vchip"
                    onClick={() => insertVariable("{담당자명}")}
                  >
                    <IconPlus /> {"{담당자명}"}
                  </button>
                </div>
              )}
              <div className="field">
                <label htmlFor="campaign-body">본문 *</label>
                <textarea
                  id="campaign-body"
                  ref={bodyRef}
                  className="memo-input msg-area"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="발송할 메시지를 입력해 주세요"
                  readOnly={live}
                />
                {live ? (
                  <p className="form-hint" style={{ marginTop: 8 }}>
                    <IconInfo /> 알림톡 본문은 카카오 검수를 통과한 내용 그대로
                    발송되어 수정할 수 없습니다. 문구를 바꾸려면 Solapi
                    콘솔에서 새 템플릿을 등록·검수한 뒤 설정 → 알림톡에
                    추가해 주세요.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="발송 미리보기" />
            <div className="panel-body">
              <div className="phone">
                <div className="phone-top">
                  <span className="kk">톡</span>알림톡 미리보기
                </div>
                <div className="bubble">
                  <div className="bt">{templateName}</div>
                  {previewBody(body, targets[0])}
                  {live ? null : (
                    <div className="bubble-cta">{demoTemplate.cta}</div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {step === 3 ? (
        <Panel>
          <PanelHead title="발송 확인" />
          <div className="panel-body">
            <div className="sum-grid">
              <div className="sum-card">
                <div className="sk">대상</div>
                <div className="sv num">
                  {live ? reachableCount : targets.length}개사
                </div>
              </div>
              <div className="sum-card">
                <div className="sk">채널</div>
                <div className="sv">알림톡</div>
              </div>
              <div className="sum-card">
                <div className="sk">템플릿</div>
                <div className="sv sv--sm">{templateName}</div>
              </div>
            </div>

            <div className="so-label" style={{ margin: "24px 0 10px" }}>
              발송 시점
            </div>
            <div className="radio-row" role="radiogroup" aria-label="발송 시점">
              <label className={`stage-opt${when === "now" ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="send-when"
                  value="now"
                  checked={when === "now"}
                  onChange={() => setWhen("now")}
                />
                <span className="ring" />
                <IconBolt />
                <span>
                  즉시 발송
                  <div className="ropt-sub">확인 즉시 전체 발송</div>
                </span>
              </label>
              <label className={`stage-opt${when === "sched" ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="send-when"
                  value="sched"
                  checked={when === "sched"}
                  onChange={() => setWhen("sched")}
                />
                <span className="ring" />
                <IconClock />
                <span>
                  예약 발송
                  <input
                    type="datetime-local"
                    className="dt-input num"
                    value={scheduledAt}
                    min={nowLocalDateTime()}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={when !== "sched"}
                    aria-label="예약 일시"
                  />
                </span>
              </label>
            </div>
            {scheduledInPast ? (
              <p className="form-hint form-hint--error" style={{ marginTop: 10 }}>
                <IconAlert /> 예약 일시가 현재보다 과거입니다. 미래 시각으로
                변경해 주세요.
              </p>
            ) : null}
            {live ? (
              <>
                <p className="form-hint" style={{ marginTop: 10 }}>
                  <IconInfo /> 대상 기업 담당자의 카카오톡으로 실제 발송되며,
                  발송 요금은 연결된 Solapi 계정에서 차감됩니다. 도달 여부는
                  발송 후 몇 분 내에 집계에 반영됩니다.
                </p>
                {unreachable.length > 0 ? (
                  <p className="form-hint" style={{ marginTop: 8 }}>
                    <IconAlert /> {targets.length}개사 중 {unreachable.length}
                    개사는 담당자 연락처가 없어 발송에서 제외됩니다.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="form-hint" style={{ marginTop: 10 }}>
                <IconInfo /> 알림톡 연동 전까지는 발송 기록만 저장됩니다. 설정
                → 알림톡에서 Solapi 계정을 연결하면 실제 발송이 시작됩니다.
              </p>
            )}

            <div className="so-label" style={{ margin: "24px 0 10px" }}>
              대상 기업 최종 확인 · {targets.length}개사
            </div>
            <div className="target-list">
              {targets.map((t) => (
                <div key={t.id} className="prev-item">
                  <IconBuilding />
                  {t.name}
                  {unreachableIds.has(t.id) ? (
                    <span className="st-badge st-badge--draft" style={{ marginLeft: "auto" }}>
                      연락처 없음
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="panel wz-foot">
        {step > 1 ? (
          <Button
            variant="secondary"
            onClick={() => setStep(step - 1)}
            disabled={sending !== null}
          >
            <IconBack /> 이전
          </Button>
        ) : null}
        <div className="spacer" />
        {step < 3 ? (
          <Button
            variant="cta"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
          >
            {step === 1 ? "다음: 메시지" : "다음: 발송 확인"} <IconArrow />
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={
                when !== "sched" ||
                !scheduledAt ||
                scheduledInPast ||
                sending !== null
              }
              onClick={() => submit("sched")}
            >
              {sending === "sched" ? "예약 중…" : "예약 발송"}
            </Button>
            <Button
              variant="cta"
              disabled={when !== "now" || sending !== null}
              onClick={() => submit("now")}
            >
              <IconSend /> {sending === "now" ? "발송 중…" : "발송"}
            </Button>
          </>
        )}
      </div>

      {sending !== null ? (
        <div className="toast" role="status">
          <span className="toast-spin" />
          {sending === "sched" ? "예약 저장 중…" : "발송 중…"}
        </div>
      ) : (
        <Toast message={toast} />
      )}
    </>
  );
}

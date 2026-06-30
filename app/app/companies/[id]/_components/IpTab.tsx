"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  IconAlert,
  IconDownload,
  IconFile,
  IconInfo,
  IconLayers,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from "@/components/ui/icons";
import { formatBytes } from "@/lib/format";
import {
  IP_DEADLINE_TYPE_LABEL,
  IP_RIGHT_KIND_LABEL,
  IP_RIGHT_STATUS_LABEL,
} from "@/lib/labels";
import type {
  IpDeadlineRow,
  IpRightAttachment,
  IpRightRow,
} from "@/lib/data/company-detail";
import type {
  IpDeadlineType,
  IpRightKind,
  IpRightStatus,
} from "@/lib/database.types";
import {
  addIpRight,
  createDocumentDownloadUrl,
  createIpTask,
  deleteDocument,
  deleteIpRight,
  updateIpRight,
} from "../actions";
import { uploadDocumentVersion } from "./document-upload";

const IP_DOC_CATEGORY = "지식재산권";
const IP_DOC_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.tif,.tiff,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.hwp,.hwpx";

const IP_RIGHT_KIND_OPTIONS: IpRightKind[] = ["patent", "trademark"];
const IP_RIGHT_STATUS_OPTIONS: IpRightStatus[] = [
  "preparing",
  "filed",
  "examining",
  "office_action",
  "registered",
  "rejected",
  "abandoned",
  "expired",
];
const IP_DEADLINE_TYPE_OPTIONS: IpDeadlineType[] = [
  "office_action",
  "registration_fee",
  "renewal",
  "annuity",
  "etc",
];

const STATUS_TONE = {
  preparing: "neutral",
  filed: "attention",
  examining: "neutral",
  office_action: "soft-soon",
  registered: "soft-valid",
  rejected: "soft-expired",
  abandoned: "neutral",
  expired: "soft-expired",
} as const;

function IpSummary({ rights }: { rights: IpRightRow[] }) {
  const filed = rights.filter((r) =>
    ["filed", "examining", "office_action"].includes(r.status),
  ).length;
  const registered = rights.filter((r) => r.status === "registered").length;
  const responseSoon = rights.filter((r) =>
    r.deadlines.some(
      (d) => !d.isDone && d.type === "office_action" && d.daysLeft <= 14,
    ),
  ).length;
  const renewalSoon = rights.filter((r) =>
    r.deadlines.some(
      (d) =>
        !d.isDone &&
        d.type !== "office_action" &&
        d.daysLeft <= 30,
    ),
  ).length;
  const items = [
    ["출원중", filed],
    ["등록완료", registered],
    ["대응 임박", responseSoon],
    ["갱신/납부 임박", renewalSoon],
  ] as const;

  return (
    <div className="ip-summary-grid" aria-label="특허·상표 요약">
      {items.map(([label, value]) => (
        <div key={label} className="ip-summary-card">
          <span>{label}</span>
          <b className="num">{value}</b>
        </div>
      ))}
    </div>
  );
}

function IpAttachmentRow({
  companyId,
  attachment,
  showToast,
  onDeleted,
}: {
  companyId: string;
  attachment: IpRightAttachment;
  showToast: (message: string) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function handleDownload() {
    const result = await createDocumentDownloadUrl(attachment.id);
    if (!result.ok || !result.url) {
      showToast(result.error ?? "다운로드에 실패했습니다.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDocument(companyId, attachment.id);
      if (!result.ok) {
        showToast(result.error ?? "삭제에 실패했습니다.");
        setConfirming(false);
        return;
      }
      onDeleted();
      showToast("첨부를 삭제했습니다");
      router.refresh();
    });
  }

  return (
    <li>
      <IconFile />
      <span className="cred-attach-name">{attachment.name}</span>
      <span className="cred-attach-size">{formatBytes(attachment.sizeBytes)}</span>
      <span className="cred-attach-actions">
        <button
          type="button"
          className="link-btn"
          onClick={handleDownload}
          aria-label={`${attachment.name} 열기`}
        >
          <IconDownload /> 열기
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="link-btn link-btn--danger"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "삭제 중…" : "삭제 확인"}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              취소
            </button>
          </>
        ) : (
          <button
            type="button"
            className="link-btn link-btn--danger"
            onClick={() => setConfirming(true)}
            aria-label={`${attachment.name} 삭제`}
          >
            <IconTrash /> 삭제
          </button>
        )}
      </span>
    </li>
  );
}

function IpAttachments({
  companyId,
  ipRightId,
  docName,
  initialAttachments,
  demo,
  showToast,
}: {
  companyId: string;
  ipRightId: string | null;
  docName: string;
  initialAttachments: IpRightAttachment[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] =
    useState<IpRightAttachment[]>(initialAttachments);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ipRightId) return;

    setPending(true);
    setError(null);
    const displayName = docName.trim() || file.name;
    const result = await uploadDocumentVersion(companyId, file, displayName, {
      docCategory: IP_DOC_CATEGORY,
      ipRightId,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAttachments((prev) => [
      {
        id: result.documentId ?? `tmp-${prev.length}`,
        name: displayName,
        fileType: file.name.split(".").pop()?.toLowerCase() ?? null,
        sizeBytes: file.size,
      },
      ...prev,
    ]);
    showToast("자료에 등록했습니다");
    router.refresh();
  }

  if (!ipRightId) {
    return (
      <div className="field">
        <label>첨부 자료</label>
        <p className="form-hint">
          <IconInfo /> 특허·상표를 먼저 저장하면 출원서·등록증·통지서 파일을
          첨부할 수 있습니다. 첨부한 파일은 기업의 &lsquo;자료&rsquo; 탭에도
          연동됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="field">
      <label>첨부 자료</label>
      {attachments.length > 0 ? (
        <ul className="cred-attach-list">
          {attachments.map((a) => (
            <IpAttachmentRow
              key={a.id}
              companyId={companyId}
              attachment={a}
              showToast={showToast}
              onDeleted={() =>
                setAttachments((prev) => prev.filter((x) => x.id !== a.id))
              }
            />
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={IP_DOC_ACCEPT}
        onChange={handleChange}
        aria-label="특허·상표 첨부 파일 선택"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={pending || demo}
      >
        <IconFile /> {pending ? "업로드 중…" : "파일 업로드"}
      </Button>
      <p className="form-hint">
        <IconInfo /> 업로드한 파일은 이 권리에 연결되고, 기업의
        &lsquo;자료&rsquo; 탭(분류: 지식재산권)에도 자동으로 연동됩니다.
      </p>
      {error ? (
        <div className="inline-error">
          <IconAlert /> {error}
        </div>
      ) : null}
    </div>
  );
}

function CreateIpTaskButton({
  companyId,
  ipRight,
  demo,
  showToast,
}: {
  companyId: string;
  ipRight: IpRightRow;
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createIpTask(companyId, ipRight.id);
      if (!result.ok) {
        showToast(result.error ?? "과제 생성에 실패했습니다.");
        return;
      }
      showToast("관련 Task를 생성했습니다");
      router.refresh();
    });
  }

  return (
    <Button
      variant="secondary"
      type="button"
      size="sm"
      onClick={handleClick}
      disabled={pending || demo}
    >
      <IconRefresh /> {pending ? "생성 중…" : "관련 Task 생성"}
    </Button>
  );
}

function DeadlineCell({ deadline }: { deadline: IpDeadlineRow | null }) {
  if (!deadline) return <span className="cell-muted">—</span>;
  return (
    <span className="ip-deadline-cell">
      <DdayBadge daysLeft={deadline.daysLeft} />
      <span>{deadline.title}</span>
    </span>
  );
}

function IpSlideOver({
  companyId,
  ipRight,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  ipRight: IpRightRow | null;
  demo: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(ipRight?.title ?? "");
  const isEdit = ipRight !== null;
  const primaryDeadline = ipRight?.nextDeadline ?? null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateIpRight(companyId, ipRight.id, formData)
        : await addIpRight(companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      showToast("저장되었습니다");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!ipRight) return;
    startTransition(async () => {
      const result = await deleteIpRight(companyId, ipRight.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      onClose();
      showToast("삭제되었습니다");
      router.refresh();
    });
  }

  return (
    <div className="slideover-root">
      <div className="slideover-backdrop" onClick={onClose} />
      <aside
        className="slideover"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "특허·상표 수정" : "특허·상표 추가"}
      >
        <div className="slideover-head">
          <h2>{isEdit ? "특허·상표 수정" : "특허·상표 추가"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconX />
          </button>
        </div>
        <form className="slideover-form" onSubmit={handleSubmit}>
          <div className="slideover-body">
            {demo ? (
              <div className="auth-notice">
                <b>데모 모드</b> — 입력 내용은 저장되지 않습니다. Supabase
                연결(.env.local) 후 실제 등록이 가능합니다.
              </div>
            ) : null}
            {error ? (
              <div className="auth-error">
                <IconAlert /> {error}
              </div>
            ) : null}
            <div className="form-grid2">
              <div className="field">
                <label htmlFor="ip-kind">구분 *</label>
                <select
                  id="ip-kind"
                  name="kind"
                  className="input"
                  defaultValue={ipRight?.kind ?? "patent"}
                >
                  {IP_RIGHT_KIND_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {IP_RIGHT_KIND_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ip-status">진행상태</label>
                <select
                  id="ip-status"
                  name="status"
                  className="input"
                  defaultValue={ipRight?.status ?? "preparing"}
                >
                  {IP_RIGHT_STATUS_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {IP_RIGHT_STATUS_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <InputField
              label="명칭 *"
              name="title"
              required
              placeholder="예: 브랜드명 상표"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <div className="form-grid2">
              <InputField
                label="출원번호"
                name="application_no"
                placeholder="10-2026-0000000"
                defaultValue={ipRight?.applicationNo ?? ""}
              />
              <InputField
                label="등록번호"
                name="registration_no"
                placeholder="10-0000000"
                defaultValue={ipRight?.registrationNo ?? ""}
              />
            </div>
            <InputField
              label="담당자/대리인"
              name="agent_name"
              placeholder="예: 김변리사"
              defaultValue={ipRight?.agentName ?? ""}
            />
            <div className="form-grid2">
              <InputField
                label="출원일"
                name="applied_date"
                type="date"
                defaultValue={ipRight?.appliedDate ?? ""}
              />
              <InputField
                label="등록일"
                name="registered_date"
                type="date"
                defaultValue={ipRight?.registeredDate ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="ip-memo">메모</label>
              <textarea
                id="ip-memo"
                name="memo"
                className="memo-input"
                placeholder="권리 범위, 담당 변리사 메모 등"
                defaultValue={ipRight?.memo ?? ""}
              />
            </div>

            <div className="ip-form-section">
              <div>
                <h3>주요기한</h3>
                <p>다음 대응·납부·갱신 기한은 대시보드와 알림센터에 함께 표시됩니다.</p>
              </div>
              <input type="hidden" name="deadline_id" value={primaryDeadline?.id ?? ""} />
              <div className="form-grid2">
                <div className="field">
                  <label htmlFor="ip-deadline-type">유형</label>
                  <select
                    id="ip-deadline-type"
                    name="deadline_type"
                    className="input"
                    defaultValue={primaryDeadline?.type ?? "office_action"}
                  >
                    {IP_DEADLINE_TYPE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {IP_DEADLINE_TYPE_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="기한일"
                  name="deadline_due_date"
                  type="date"
                  defaultValue={primaryDeadline?.dueDate ?? ""}
                />
              </div>
              <InputField
                label="기한명"
                name="deadline_title"
                placeholder="예: 의견제출통지 대응"
                defaultValue={primaryDeadline?.title ?? ""}
              />
              <div className="field">
                <label htmlFor="ip-deadline-memo">기한 메모</label>
                <textarea
                  id="ip-deadline-memo"
                  name="deadline_memo"
                  className="memo-input"
                  placeholder="제출 서류, 납부 금액, 준비사항 등"
                  defaultValue={primaryDeadline?.memo ?? ""}
                />
              </div>
              {primaryDeadline ? (
                <label className="check-line">
                  <input
                    type="checkbox"
                    name="deadline_is_done"
                    defaultChecked={primaryDeadline.isDone}
                  />
                  기한 완료 처리
                </label>
              ) : null}
            </div>

            <IpAttachments
              companyId={companyId}
              ipRightId={ipRight?.id ?? null}
              docName={title}
              initialAttachments={ipRight?.attachments ?? []}
              demo={demo}
              showToast={showToast}
            />
          </div>
          <div className="slideover-foot">
            <Button variant="cta" type="submit" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              닫기
            </Button>
            {isEdit ? (
              <>
                <CreateIpTaskButton
                  companyId={companyId}
                  ipRight={ipRight}
                  demo={demo}
                  showToast={showToast}
                />
                <div className="slideover-foot-end">
                  {confirmingDelete ? (
                    <>
                      <span className="form-hint">삭제할까요?</span>
                      <Button
                        variant="danger"
                        type="button"
                        onClick={handleDelete}
                        disabled={pending}
                      >
                        {pending ? "삭제 중…" : "삭제 확인"}
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={pending}
                      >
                        취소
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost-danger"
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={pending}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </form>
      </aside>
    </div>
  );
}

export function IpTab({
  companyId,
  ipRights,
  demo,
  showToast,
}: {
  companyId: string;
  ipRights: IpRightRow[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<IpRightRow | null>(null);

  return (
    <>
      <Panel>
        <PanelHead
          title="특허·상표"
          count={ipRights.length > 0 ? `${ipRights.length}건` : undefined}
        >
          <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
            <IconPlus /> 특허·상표 추가
          </Button>
        </PanelHead>

        {ipRights.length === 0 ? (
          <EmptyState
            bare
            icon={<IconLayers />}
            title="등록된 특허·상표가 없습니다"
            description="기업의 특허·상표 출원, 등록, 대응·납부·갱신 기한을 이곳에서 관리할 수 있습니다."
            action={
              <Button variant="cta" onClick={() => setAdding(true)}>
                <IconPlus /> 특허·상표 추가
              </Button>
            }
          />
        ) : (
          <>
            <IpSummary rights={ipRights} />
            <table className="dlist dlist--cards">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>명칭</th>
                  <th>출원번호</th>
                  <th>등록번호</th>
                  <th>상태</th>
                  <th>출원일</th>
                  <th>등록일</th>
                  <th>다음 기한</th>
                  <th className="r">첨부</th>
                </tr>
              </thead>
              <tbody>
                {ipRights.map((r) => (
                  <tr
                    key={r.id}
                    className={`row-link${
                      r.nextDeadline && r.nextDeadline.daysLeft <= 14
                        ? " row-soon"
                        : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${r.title} 수정`}
                    onClick={() => setEditing(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditing(r);
                      }
                    }}
                  >
                    <td data-label="구분">
                      <Badge tone="neutral">{IP_RIGHT_KIND_LABEL[r.kind]}</Badge>
                    </td>
                    <td className="name" data-label="명칭">
                      {r.title}
                    </td>
                    <td className="num" data-label="출원번호">
                      {r.applicationNo ?? <span className="cell-muted">—</span>}
                    </td>
                    <td className="num" data-label="등록번호">
                      {r.registrationNo ?? <span className="cell-muted">—</span>}
                    </td>
                    <td data-label="상태">
                      <Badge tone={STATUS_TONE[r.status]}>
                        {IP_RIGHT_STATUS_LABEL[r.status]}
                      </Badge>
                    </td>
                    <td className="date num" data-label="출원일">
                      {r.appliedDate ?? "—"}
                    </td>
                    <td className="date num" data-label="등록일">
                      {r.registeredDate ?? "—"}
                    </td>
                    <td data-label="다음 기한">
                      <DeadlineCell deadline={r.nextDeadline} />
                    </td>
                    <td className="r" data-label="첨부">
                      {r.attachments.length > 0 ? (
                        <span className="cred-attach-count" title={`첨부 ${r.attachments.length}건`}>
                          <IconFile /> {r.attachments.length}
                        </span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>

      {adding ? (
        <IpSlideOver
          companyId={companyId}
          ipRight={null}
          demo={demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editing ? (
        <IpSlideOver
          companyId={companyId}
          ipRight={editing}
          demo={demo}
          showToast={showToast}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

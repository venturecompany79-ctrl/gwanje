"use client";

import Link from "next/link";
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
import { CategoryChip } from "@/components/ui/CategoryChip";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  IconAlert,
  IconAward,
  IconDownload,
  IconFile,
  IconInfo,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from "@/components/ui/icons";
import { CREDENTIAL_STATUS_LABEL } from "@/lib/labels";
import { formatBytes } from "@/lib/format";
import type {
  CategoryOption,
  CredentialAttachment,
  CredentialRow,
} from "@/lib/data/company-detail";
import {
  addCredential,
  createDocumentDownloadUrl,
  createRenewalTask,
  deleteCredential,
  deleteDocument,
  updateCredential,
} from "../actions";
import { uploadDocumentVersion } from "./document-upload";

const STATUS_TONE = {
  valid: "soft-valid",
  expiring: "soft-soon",
  expired: "soft-expired",
} as const;

/** 자격·인증에서 올린 첨부는 기업 '자료' 탭에 이 분류로 연동된다. */
const CREDENTIAL_DOC_CATEGORY = "인증";

const CREDENTIAL_DOC_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.tif,.tiff,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.hwp,.hwpx";

/**
 * 자격 슬라이드오버 안의 첨부 자료 — 자격에 1:N으로 명시 연결(document.credential_id).
 * 선택 즉시 Storage 업로드 + document 등록(분류 "인증" + credential_id)하여 기업 '자료' 탭과 연동한다.
 * 자료명은 자격종류를 따르므로, 같은 자격에 같은 이름으로 다시 올리면 자료가 새 버전으로 갱신된다.
 * 자격이 저장되기 전(추가 모드)에는 연결 대상이 없어 안내만 노출한다.
 */
function CredentialAttachments({
  companyId,
  credentialId,
  docName,
  initialAttachments,
  demo,
  showToast,
}: {
  companyId: string;
  /** 저장된 자격 id — null이면 아직 추가 모드라 첨부 불가 */
  credentialId: string | null;
  /** 현재 입력된 자격종류 — 자료명으로 사용(없으면 파일명) */
  docName: string;
  initialAttachments: CredentialAttachment[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] =
    useState<CredentialAttachment[]>(initialAttachments);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !credentialId) return;

    setPending(true);
    setError(null);
    const displayName = docName.trim() || file.name;
    const result = await uploadDocumentVersion(companyId, file, displayName, {
      docCategory: CREDENTIAL_DOC_CATEGORY,
      credentialId,
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
    // 자료 탭으로 전환 시 최신 목록이 보이도록 캐시 갱신
    router.refresh();
  }

  if (!credentialId) {
    return (
      <div className="field">
        <label>첨부 자료</label>
        <p className="form-hint">
          <IconInfo /> 자격을 먼저 저장하면 인증서·서류 파일을 첨부할 수
          있습니다. 첨부한 파일은 기업의 &lsquo;자료&rsquo; 탭에도 연동됩니다.
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
            <CredentialAttachmentRow
              key={a.id}
              companyId={companyId}
              attachment={a}
              showToast={showToast}
              onDeleted={() =>
                setAttachments((prev) =>
                  prev.filter((x) => x.id !== a.id),
                )
              }
            />
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={CREDENTIAL_DOC_ACCEPT}
        onChange={handleChange}
        aria-label="자격 첨부 파일 선택"
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
        <IconInfo /> 업로드한 파일은 이 자격에 연결되고, 기업의
        &lsquo;자료&rsquo; 탭(분류: 인증)에도 자동으로 연동됩니다.
      </p>
      {error ? (
        <div className="inline-error">
          <IconAlert /> {error}
        </div>
      ) : null}
    </div>
  );
}

/** 첨부 1건 — 열기(다운로드)·삭제 */
function CredentialAttachmentRow({
  companyId,
  attachment,
  showToast,
  onDeleted,
}: {
  companyId: string;
  attachment: CredentialAttachment;
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

function RenewalTaskButton({
  companyId,
  credential,
  showToast,
}: {
  companyId: string;
  credential: CredentialRow;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (credential.hasRenewalTask) {
    return (
      <Link
        href={`/app/companies/${companyId}?tab=tasks`}
        className="pill-btn"
      >
        <IconRefresh /> 과제 보기
      </Link>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const result = await createRenewalTask(companyId, credential.id);
      if (!result.ok) {
        showToast(result.error ?? "생성에 실패했습니다.");
        return;
      }
      showToast("갱신 과제를 생성했습니다");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="pill-btn"
      onClick={handleClick}
      disabled={pending}
    >
      <IconRefresh /> {pending ? "생성 중…" : "갱신 과제 생성"}
    </button>
  );
}

function CredentialSlideOver({
  companyId,
  credential,
  categories,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  /** 주어지면 수정 모드, 없으면 추가 모드 */
  credential: CredentialRow | null;
  categories: CategoryOption[];
  demo: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [type, setType] = useState(credential?.type ?? "");
  const isEdit = credential !== null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateCredential(companyId, credential.id, formData)
        : await addCredential(companyId, formData);
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
    if (!credential) return;
    startTransition(async () => {
      const result = await deleteCredential(companyId, credential.id);
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
        aria-label={isEdit ? "자격 수정" : "자격 추가"}
      >
        <div className="slideover-head">
          <h2>{isEdit ? "자격 수정" : "자격 추가"}</h2>
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
            <InputField
              label="자격종류 *"
              name="type"
              required
              placeholder="벤처기업확인"
              value={type}
              onChange={(e) => setType(e.target.value)}
              autoFocus
            />
            <CategorySelect
              name="category_id"
              categories={categories}
              defaultValue={credential?.categoryId ?? ""}
              demo={demo}
            />
            <div className="form-grid2">
              <InputField
                label="발급일"
                name="issued_date"
                type="date"
                defaultValue={credential?.issuedDate ?? ""}
              />
              <InputField
                label="만료일"
                name="expires_date"
                type="date"
                defaultValue={credential?.expiresDate ?? ""}
              />
            </div>
            <InputField
              label="갱신 준비 기간 (일)"
              name="renew_lead_days"
              type="number"
              min={0}
              defaultValue={credential?.renewLeadDays ?? 60}
            />
            <p className="form-hint">
              <IconInfo /> 만료일까지 남은 일수가 이 기간 이내면
              &lsquo;임박&rsquo;으로 표시됩니다.
            </p>
            <div className="field">
              <label htmlFor="cred-memo">메모</label>
              <textarea
                id="cred-memo"
                name="memo"
                className="memo-input"
                placeholder="갱신 조건, 담당 기관 등"
                defaultValue={credential?.memo ?? ""}
              />
            </div>
            <CredentialAttachments
              companyId={companyId}
              credentialId={credential?.id ?? null}
              docName={type}
              initialAttachments={credential?.attachments ?? []}
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
            ) : null}
          </div>
        </form>
      </aside>
    </div>
  );
}

export function CertsTab({
  companyId,
  credentials,
  categories,
  demo,
  showToast,
}: {
  companyId: string;
  credentials: CredentialRow[];
  categories: CategoryOption[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CredentialRow | null>(null);

  return (
    <>
      <Panel>
        <PanelHead
          title="자격·인증"
          count={credentials.length > 0 ? `${credentials.length}건` : undefined}
        >
          <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
            <IconPlus /> 자격 추가
          </Button>
        </PanelHead>

        {credentials.length === 0 ? (
          <EmptyState
            bare
            icon={<IconAward />}
            title="등록된 자격이 없습니다"
            description="이 기업의 인증·정부지원·세액공제 자격을 등록하면 만료일과 D-day가 자동으로 추적됩니다."
            action={
              <Button variant="cta" onClick={() => setAdding(true)}>
                <IconPlus /> 자격 추가
              </Button>
            }
          />
        ) : (
          <table className="dlist">
            <thead>
              <tr>
                <th>자격종류</th>
                <th>분류</th>
                <th>발급일</th>
                <th>만료일</th>
                <th>상태</th>
                <th>D-day</th>
                <th className="r">액션</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr
                  key={c.id}
                  className={`row-link${
                    c.status === "expiring"
                      ? " row-soon"
                      : c.status === "expired"
                        ? " row-expired"
                        : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.type} 수정`}
                  onClick={() => setEditing(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditing(c);
                    }
                  }}
                >
                  <td className="name">
                    {c.type}
                    {c.attachments.length > 0 ? (
                      <span
                        className="cred-attach-count"
                        title={`첨부 ${c.attachments.length}건`}
                      >
                        <IconFile /> {c.attachments.length}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {c.categoryName ? (
                      <CategoryChip name={c.categoryName} />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td className="date num">{c.issuedDate ?? "—"}</td>
                  <td className="date num">{c.expiresDate ?? "—"}</td>
                  <td>
                    {c.status ? (
                      <Badge tone={STATUS_TONE[c.status]}>
                        {CREDENTIAL_STATUS_LABEL[c.status]}
                      </Badge>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    {c.daysLeft !== null ? (
                      <DdayBadge daysLeft={c.daysLeft} />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td
                    className="r"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {c.status === "expiring" ? (
                      <RenewalTaskButton
                        companyId={companyId}
                        credential={c}
                        showToast={showToast}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {adding || editing ? (
        <CredentialSlideOver
          key={editing?.id ?? "new"}
          companyId={companyId}
          credential={editing}
          categories={categories}
          demo={demo}
          showToast={showToast}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

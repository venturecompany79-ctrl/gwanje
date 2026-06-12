"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  IconAlert,
  IconAward,
  IconInfo,
  IconPlus,
  IconRefresh,
  IconX,
} from "@/components/ui/icons";
import { CREDENTIAL_STATUS_LABEL } from "@/lib/labels";
import type { CategoryOption, CredentialRow } from "@/lib/data/company-detail";
import { addCredential, createRenewalTask } from "../actions";

const STATUS_TONE = {
  valid: "soft-valid",
  expiring: "soft-soon",
  expired: "soft-expired",
} as const;

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
    return <span className="cell-muted">갱신 과제 있음</span>;
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

function AddCredentialSlideOver({
  companyId,
  categories,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  categories: CategoryOption[];
  demo: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addCredential(companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      showToast("저장되었습니다");
      router.refresh();
    });
  }

  return (
    <div className="slideover-root">
      <div className="slideover-backdrop" onClick={onClose} />
      <aside className="slideover" role="dialog" aria-modal="true" aria-label="자격 추가">
        <div className="slideover-head">
          <h2>자격 추가</h2>
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
              autoFocus
            />
            <div className="field">
              <label htmlFor="cred-category">분류</label>
              <select id="cred-category" name="category_id" className="input" defaultValue="">
                <option value="">선택 안 함</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid2">
              <InputField label="발급일" name="issued_date" type="date" />
              <InputField label="만료일" name="expires_date" type="date" />
            </div>
            <InputField
              label="갱신 준비 기간 (일)"
              name="renew_lead_days"
              type="number"
              min={0}
              defaultValue={60}
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
              />
            </div>
          </div>
          <div className="slideover-foot">
            <Button variant="cta" type="submit" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              닫기
            </Button>
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
                  className={
                    c.status === "expiring"
                      ? "row-soon"
                      : c.status === "expired"
                        ? "row-expired"
                        : ""
                  }
                >
                  <td className="name">{c.type}</td>
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
                  <td className="r">
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

      {adding ? (
        <AddCredentialSlideOver
          companyId={companyId}
          categories={categories}
          demo={demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

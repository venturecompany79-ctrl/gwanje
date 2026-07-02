"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { SlideOver } from "@/components/ui/SlideOver";
import { IconAlert, IconX } from "@/components/ui/icons";
import { formatDotDateString, todayKstDate } from "@/lib/datetime";
import type { CompanyProfile } from "@/lib/data/company-detail";
import { deleteCompany, endCompany, reactivateCompany } from "../actions";

/** 활성 기업 헤더의 "관리 종료" 액션 — 슬라이드오버로 종료일·사유를 받는다. */
export function EndCompanyButton({
  company,
  demo,
  showToast,
}: {
  company: CompanyProfile;
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await endCompany(company.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      showToast("관리 종료로 전환되었습니다");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost-danger" size="sm" onClick={() => setOpen(true)}>
        관리 종료
      </Button>

      {open ? (
        <SlideOver ariaLabel="기업 관리 종료" onClose={close}>
            <div className="slideover-head">
              <h2>기업 관리 종료</h2>
              <button type="button" className="icon-btn" onClick={close} aria-label="닫기">
                <IconX />
              </button>
            </div>
            <form className="slideover-form" onSubmit={handleSubmit}>
              <div className="slideover-body">
                {demo ? (
                  <div className="auth-notice">
                    <b>데모 모드</b> — 변경 내용은 저장되지 않습니다.
                  </div>
                ) : null}
                {error ? (
                  <div className="auth-error">
                    <IconAlert /> {error}
                  </div>
                ) : null}
                <p className="muted">
                  <b>{company.name}</b> 을(를) 관리 종료 처리합니다. 자격·과제·일정
                  등 데이터는 보존되며, 대시보드·D-day 관제에서 제외됩니다. 언제든
                  다시 관리 재개할 수 있습니다.
                </p>
                <InputField
                  label="종료일"
                  name="ended_date"
                  type="date"
                  className="input--date"
                  fieldClassName="field--date"
                  defaultValue={company.contractEndDate ?? todayKstDate()}
                />
                <div className="field">
                  <label htmlFor="ended-reason">종료 사유 (선택)</label>
                  <textarea
                    id="ended-reason"
                    name="ended_reason"
                    className="memo-input"
                    placeholder="예: 계약 만료, 고객사 요청 등"
                  />
                </div>
              </div>
              <div className="slideover-foot">
                <Button variant="danger" type="submit" disabled={pending}>
                  {pending ? "처리 중…" : "관리 종료"}
                </Button>
                <Button variant="ghost" type="button" onClick={close}>
                  취소
                </Button>
              </div>
            </form>
        </SlideOver>
      ) : null}
    </>
  );
}

/** 종료 기업 상세 상단 배너 — 종료 정보 + 관리 재개 / 완전 삭제 */
export function EndedCompanyBanner({
  company,
  demo,
  showToast,
}: {
  company: CompanyProfile;
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, startTransition] = useTransition();

  function reactivate() {
    startTransition(async () => {
      const result = await reactivateCompany(company.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("관리 재개되었습니다");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteCompany(company.id, confirmName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("완전 삭제되었습니다");
      router.push("/app/companies");
    });
  }

  const endedLabel = company.endedAt
    ? formatDotDateString(company.endedAt.slice(0, 10))
    : null;

  return (
    <div className="ended-banner">
      <div className="ended-banner-main">
        <div>
          <b>관리 종료된 기업입니다</b>
          <span className="muted">
            {endedLabel ? ` · ${endedLabel} 종료` : ""}
            {company.endedReason ? ` · ${company.endedReason}` : ""}
          </span>
        </div>
        <div className="ended-banner-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={reactivate}
            disabled={pending}
          >
            관리 재개
          </Button>
          {confirmDelete ? null : (
            <Button
              variant="ghost-danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              완전 삭제
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="auth-error">
          <IconAlert /> {error}
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="ended-delete-confirm">
          <p className="muted">
            <b>되돌릴 수 없습니다.</b> 이 기업의 자격·과제·일정·자료·지식재산권이
            모두 영구 삭제됩니다. 확인을 위해 기업명{" "}
            <b>{company.name}</b> 을(를) 입력하세요.
          </p>
          {demo ? (
            <div className="auth-notice">
              <b>데모 모드</b> — 실제로 삭제되지 않습니다.
            </div>
          ) : null}
          <InputField
            label="기업명 확인"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={company.name}
          />
          <div className="ended-banner-actions">
            <Button
              variant="danger"
              size="sm"
              onClick={remove}
              disabled={pending || confirmName.trim() !== company.name.trim()}
            >
              {pending ? "삭제 중…" : "영구 삭제"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
                setConfirmName("");
                setError(null);
              }}
              disabled={pending}
            >
              취소
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

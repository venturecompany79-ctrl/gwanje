"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconAlert, IconEdit, IconX } from "@/components/ui/icons";
import type { CompanyProfile } from "@/lib/data/company-detail";
import { updateCompany } from "../actions";

export function EditCompanyButton({
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
      const result = await updateCompany(company.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      showToast("저장되었습니다");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconEdit /> 편집
      </Button>

      {open ? (
        <div className="slideover-root">
          <div className="slideover-backdrop" onClick={close} />
          <aside
            className="slideover"
            role="dialog"
            aria-modal="true"
            aria-label="기업 정보 편집"
          >
            <div className="slideover-head">
              <h2>기업 정보 편집</h2>
              <button type="button" className="icon-btn" onClick={close} aria-label="닫기">
                <IconX />
              </button>
            </div>
            <form className="slideover-form" onSubmit={handleSubmit}>
              <div className="slideover-body">
                {demo ? (
                  <div className="auth-notice">
                    <b>데모 모드</b> — 변경 내용은 저장되지 않습니다. Supabase
                    연결(.env.local) 후 실제 수정이 가능합니다.
                  </div>
                ) : null}
                {error ? (
                  <div className="auth-error">
                    <IconAlert /> {error}
                  </div>
                ) : null}
                <InputField
                  label="기업명 *"
                  name="name"
                  required
                  defaultValue={company.name}
                  autoFocus
                />
                <div className="form-grid2">
                  <InputField
                    label="사업자등록번호"
                    name="biz_no"
                    defaultValue={company.bizNo ?? ""}
                    placeholder="123-45-67890"
                  />
                  <InputField
                    label="업종"
                    name="industry"
                    defaultValue={company.industry ?? ""}
                  />
                </div>
                <InputField
                  label="설립일"
                  name="founded_date"
                  type="date"
                  className="input--date"
                  fieldClassName="field--date"
                  defaultValue={company.foundedDate ?? ""}
                />
                <div className="form-grid2">
                  <InputField
                    label="연 매출 (억 원)"
                    name="revenue"
                    type="number"
                    min={0}
                    step={0.1}
                    defaultValue={
                      company.revenue !== null
                        ? company.revenue / 100_000_000
                        : ""
                    }
                  />
                  <InputField
                    label="인원 (명)"
                    name="headcount"
                    type="number"
                    min={0}
                    defaultValue={company.headcount ?? ""}
                  />
                </div>
                <InputField
                  label="대표자"
                  name="ceo_name"
                  defaultValue={company.ceoName ?? ""}
                />
                <div className="form-grid2">
                  <InputField
                    label="담당자"
                    name="contact_name"
                    defaultValue={company.contactName ?? ""}
                  />
                  <InputField
                    label="담당자 연락처"
                    name="contact_phone"
                    defaultValue={company.contactPhone ?? ""}
                  />
                </div>
                <InputField
                  label="담당자 이메일"
                  name="contact_email"
                  type="email"
                  defaultValue={company.contactEmail ?? ""}
                />
                <InputField
                  label="컨디션 태그"
                  name="condition_tags"
                  defaultValue={company.conditionTags.join(", ")}
                  placeholder="성장기, 수출기업 — 쉼표로 구분"
                />
                <div className="field">
                  <label htmlFor="company-memo">메모</label>
                  <textarea
                    id="company-memo"
                    name="memo"
                    className="memo-input"
                    defaultValue={company.memo ?? ""}
                  />
                </div>
              </div>
              <div className="slideover-foot">
                <Button variant="cta" type="submit" disabled={pending}>
                  {pending ? "저장 중…" : "저장"}
                </Button>
                <Button variant="ghost" type="button" onClick={close}>
                  닫기
                </Button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

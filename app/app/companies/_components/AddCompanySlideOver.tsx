"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconAlert, IconInfo, IconPlus, IconX } from "@/components/ui/icons";
import { addCompany } from "../actions";

export function AddCompanyButton({
  demo,
  size = "sm",
}: {
  demo: boolean;
  size?: "md" | "sm";
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
      const result = await addCompany(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="cta" size={size} onClick={() => setOpen(true)}>
        <IconPlus /> 기업 추가
      </Button>

      {open ? (
        <div className="slideover-root">
          <div className="slideover-backdrop" onClick={close} />
          <aside className="slideover" role="dialog" aria-modal="true" aria-label="기업 추가">
            <div className="slideover-head">
              <h2>기업 추가</h2>
              <button type="button" className="icon-btn" onClick={close} aria-label="닫기">
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
                  label="기업명 *"
                  name="name"
                  required
                  placeholder="(주)테크노바"
                  autoFocus
                />
                <InputField label="업종" name="industry" placeholder="IT·소프트웨어" />
                <InputField label="설립일" name="founded_date" type="date" />
                <div className="form-grid2">
                  <InputField
                    label="연 매출 (억 원)"
                    name="revenue"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="42"
                  />
                  <InputField
                    label="인원 (명)"
                    name="headcount"
                    type="number"
                    min={0}
                    placeholder="28"
                  />
                </div>
                <InputField label="대표자" name="ceo_name" placeholder="박지훈" />
                <InputField
                  label="컨디션 태그"
                  name="condition_tags"
                  placeholder="성장기, 수출기업 — 쉼표로 구분"
                />
                <p className="form-hint">
                  <IconInfo /> 자격·인증과 관리포인트는 등록 후 기업 상세에서
                  추가합니다.
                </p>
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

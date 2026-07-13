"use client";

import { useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { validateDraftRows } from "@/lib/import/validate";
import type {
  DraftCompanyRow,
  ImportCategoryOption,
  ImportExistingCompany,
  ImportRowResult,
} from "@/lib/import/types";
import { bulkImportCompanies } from "../actions";
import { ImportUploadStep } from "./ImportUploadStep";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { ImportResultStep } from "./ImportResultStep";

type Step = "upload" | "preview" | "result";

export function ImportWizard({
  demo,
  aiEnabled,
  categories,
  existing,
}: {
  demo: boolean;
  aiEnabled: boolean;
  categories: ImportCategoryOption[];
  existing: ImportExistingCompany[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<DraftCompanyRow[]>([]);
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateCtx = useMemo(() => ({ existing, categories }), [existing, categories]);

  function handleParsed(parsed: DraftCompanyRow[]) {
    setRows(validateDraftRows(parsed, validateCtx));
    setStep("preview");
  }

  function handleRowsChange(next: DraftCompanyRow[]) {
    setRows(validateDraftRows(next, validateCtx));
  }

  const registrable = rows.filter(
    (r) =>
      r.include &&
      r.errors.length === 0 &&
      (!r.duplicateName || r.confirmDuplicate),
  );
  const blockedDuplicates = rows.filter(
    (r) => r.include && r.errors.length === 0 && r.duplicateName && !r.confirmDuplicate,
  );

  async function handleRegister() {
    if (registrable.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await bulkImportCompanies({ rows: registrable });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setResults(result.results);
      setStep("result");
    } catch {
      setSubmitError("등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  /** 결과 화면에서 실패 행만 다시 미리보기로 — 성공 행은 제거해 중복 등록을 막는다 */
  function handleRetryFailed() {
    const failedIds = new Set(results.filter((r) => !r.ok).map((r) => r.rowId));
    setRows((prev) => validateDraftRows(prev.filter((r) => failedIds.has(r.rowId)), validateCtx));
    setResults([]);
    setStep("preview");
  }

  if (step === "upload") {
    return (
      <ImportUploadStep
        demo={demo}
        aiEnabled={aiEnabled}
        categoryNames={categories.map((c) => c.name)}
        onParsed={handleParsed}
      />
    );
  }

  if (step === "result") {
    return <ImportResultStep results={results} onRetryFailed={handleRetryFailed} />;
  }

  return (
    <>
      <ImportPreviewTable
        rows={rows}
        categories={categories}
        onChange={handleRowsChange}
      />

      {submitError ? (
        <p className="field-error" role="alert" style={{ marginTop: 12 }}>
          {submitError}
        </p>
      ) : null}
      {blockedDuplicates.length > 0 ? (
        <p className="field-error" role="status" style={{ marginTop: 12 }}>
          중복 의심 {blockedDuplicates.length}건은 &quot;중복 아님&quot;을 체크해야 등록됩니다.
        </p>
      ) : null}

      <div
        style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}
      >
        <Button variant="ghost" onClick={() => setStep("upload")} disabled={submitting}>
          다른 파일 선택
        </Button>
        <LinkButton variant="ghost" href="/app/companies">
          취소
        </LinkButton>
        <div className="spacer" style={{ flex: 1 }} />
        <Button
          variant="cta"
          onClick={handleRegister}
          disabled={demo || registrable.length === 0 || submitting}
        >
          {submitting ? "등록 중…" : `${registrable.length}개 기업 등록`}
        </Button>
      </div>
    </>
  );
}

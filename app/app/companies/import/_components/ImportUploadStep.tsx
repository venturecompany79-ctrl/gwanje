"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconAlert, IconDownload, IconFile } from "@/components/ui/icons";
import type { DraftCompanyRow } from "@/lib/import/types";
import { parseImportSheetsWithAI } from "../actions";

type Mode = "template" | "ai";

const ACCEPT = ".xlsx,.xls,.csv";

export function ImportUploadStep({
  demo,
  aiEnabled,
  categoryNames,
  onParsed,
}: {
  demo: boolean;
  aiEnabled: boolean;
  categoryNames: string[];
  onParsed: (rows: DraftCompanyRow[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("template");
  const [busy, setBusy] = useState<string | null>(null); // 진행 메시지
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function downloadTemplate(format: "xlsx" | "csv") {
    const template = await import("@/lib/import/template");
    if (format === "xlsx") template.downloadTemplateXlsx(categoryNames);
    else template.downloadTemplateCsv(categoryNames);
  }

  async function handleFile(file: File) {
    if (demo || busy) return;
    setError(null);

    const parseModule = await import("@/lib/import/parse-template");
    let data: ArrayBuffer;
    try {
      data = await file.arrayBuffer();
    } catch {
      setError("파일을 읽지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    if (mode === "template") {
      setBusy("파일을 읽는 중…");
      try {
        const rows = parseModule.parseTemplateWorkbook(data);
        if (rows.length === 0) {
          setError("파일에 기업 데이터가 없습니다. 템플릿의 예시 행 아래에 기업을 입력해 주세요.");
          return;
        }
        onParsed(rows);
      } catch (e) {
        if (e instanceof parseModule.TemplateFormatError) {
          setError(e.message);
        } else {
          console.error("[ImportUploadStep:template]", e);
          setError("파일을 해석하지 못했습니다. 엑셀(.xlsx) 또는 CSV 파일인지 확인해 주세요.");
        }
      } finally {
        setBusy(null);
      }
      return;
    }

    // AI 경로 — 시트 텍스트만 서버로 전송
    setBusy("파일을 읽는 중…");
    let sheets: { name: string; csv: string }[];
    try {
      sheets = parseModule.extractSheetsAsCsv(data);
    } catch (e) {
      console.error("[ImportUploadStep:extract]", e);
      setError("파일을 해석하지 못했습니다. 엑셀(.xlsx) 또는 CSV 파일인지 확인해 주세요.");
      setBusy(null);
      return;
    }
    if (sheets.length === 0) {
      setError("파일에 읽을 수 있는 데이터가 없습니다.");
      setBusy(null);
      return;
    }
    const encoder = new TextEncoder();
    const totalBytes = sheets.reduce(
      (sum, s) => sum + encoder.encode(s.csv).byteLength,
      0,
    );
    if (totalBytes > parseModule.AI_SHEET_TEXT_LIMIT) {
      setError("파일이 너무 큽니다(약 200KB 초과). 나눠서 업로드해 주세요.");
      setBusy(null);
      return;
    }

    setBusy("AI가 기업 정보를 추출하는 중… (최대 1분 정도 걸릴 수 있습니다)");
    try {
      const result = await parseImportSheetsWithAI({ sheets });
      if (!result.ok || !result.rows) {
        setError(result.error ?? "AI 분석에 실패했습니다.");
        return;
      }
      onParsed(result.rows);
    } catch {
      setError("AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const aiTabDisabled = !aiEnabled;

  return (
    <section className="panel" style={{ padding: 24 }}>
      <div className="tag-tabs" role="group" aria-label="가져오기 방식" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`pill-tab${mode === "template" ? " is-active" : ""}`}
          onClick={() => {
            setMode("template");
            setError(null);
          }}
        >
          템플릿으로 가져오기
        </button>
        <button
          type="button"
          className={`pill-tab${mode === "ai" ? " is-active" : ""}`}
          onClick={() => {
            if (aiTabDisabled) return;
            setMode("ai");
            setError(null);
          }}
          disabled={aiTabDisabled}
          title={aiTabDisabled ? "관리자 설정(GEMINI_API_KEY)이 필요합니다" : undefined}
          style={aiTabDisabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        >
          AI로 가져오기
        </button>
      </div>

      {mode === "template" ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", color: "var(--steel, #5d6c7b)", fontSize: 14 }}>
            ① 템플릿을 내려받아 기업과 자격·인증을 채우고 ② 파일을 올리면 한 번에 등록됩니다.
            예시 행(예시)한빛테크)은 지우지 않아도 자동으로 제외됩니다.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => void downloadTemplate("xlsx")}>
              <IconDownload /> 엑셀 템플릿 내려받기
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void downloadTemplate("csv")}>
              CSV 템플릿
            </Button>
          </div>
        </div>
      ) : (
        <p style={{ margin: "0 0 16px", color: "var(--steel, #5d6c7b)", fontSize: 14 }}>
          지금 쓰고 계신 엑셀·CSV 파일을 형식 그대로 올리면 AI가 기업과 자격·인증(만료일 포함)을
          추출합니다. 등록 전에 미리보기에서 직접 확인하고 수정할 수 있습니다.
        </p>
      )}

      <label
        className="license-drop"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          opacity: demo || busy ? 0.6 : 1,
          cursor: demo || busy ? "not-allowed" : "pointer",
          outline: dragOver ? "2px solid var(--primary, #0064e0)" : undefined,
        }}
      >
        <IconFile />
        <b>{busy ?? "파일을 끌어다 놓거나 클릭해 선택"}</b>
        <span>
          {mode === "template" ? "작성한 템플릿 파일 (.xlsx / .csv)" : "기존 관리 파일 (.xlsx / .xls / .csv)"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          disabled={demo || busy !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>

      {error ? (
        <p className="field-error" role="alert" style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <IconAlert /> {error}
        </p>
      ) : null}
    </section>
  );
}

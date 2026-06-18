"use client";

// 대시보드 D-day 목록 CSV 내보내기 버튼 (F17)
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, useToast } from "@/components/ui/Toast";
import { IconDownload } from "@/components/ui/icons";
import { getDeadlinesCsv } from "@/lib/actions/export";

export function ExportButton() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const { toast, showToast } = useToast();

  function handleClick() {
    setBusy(true);
    startTransition(async () => {
      try {
        const csv = await getDeadlinesCsv();
        // Excel 한글 인식을 위해 UTF-8 BOM 추가
        const blob = new Blob(["﻿" + csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `관제_마감목록_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        showToast("내보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={pending || busy}
        title="다가오는·지난 마감/만료 전체 목록을 CSV 파일로 저장합니다"
      >
        <IconDownload /> {busy ? "내보내는 중…" : "마감목록 CSV 내보내기"}
      </Button>
      <Toast message={toast} />
    </>
  );
}

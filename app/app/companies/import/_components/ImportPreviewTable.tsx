"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHead } from "@/components/ui/Panel";
import type {
  DraftCompanyRow,
  DraftCredential,
  ImportCategoryOption,
} from "@/lib/import/types";

function StatusBadges({ row }: { row: DraftCompanyRow }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {row.errors.length > 0 ? <Badge tone="critical">오류 {row.errors.length}</Badge> : null}
      {row.warnings.length > 0 ? <Badge tone="warning">확인 {row.warnings.length}</Badge> : null}
      {row.duplicateName ? (
        <Badge tone="attention">{row.confirmDuplicate ? "중복 아님 확인" : "중복 의심"}</Badge>
      ) : null}
      {row.errors.length === 0 && row.warnings.length === 0 && !row.duplicateName ? (
        <Badge tone="success">정상</Badge>
      ) : null}
    </span>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const textOrNull = (v: string): string | null => (v.trim() === "" ? null : v);

function CredentialEditor({
  cred,
  categories,
  onChange,
  onRemove,
}: {
  cred: DraftCredential;
  categories: ImportCategoryOption[];
  onChange: (next: DraftCredential) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto",
        gap: 8,
        alignItems: "end",
      }}
    >
      <div className="field">
        <label>자격 종류</label>
        <input
          className="input"
          value={cred.type}
          onChange={(e) => onChange({ ...cred, type: e.target.value })}
        />
      </div>
      <div className="field">
        <label>분류</label>
        <select
          className="input"
          value={cred.categoryName ?? ""}
          onChange={(e) =>
            onChange({ ...cred, categoryName: e.target.value || null, categoryId: null })
          }
        >
          <option value="">분류 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>발급일</label>
        <input
          className="input"
          placeholder="YYYY-MM-DD"
          value={cred.issuedDate ?? ""}
          onChange={(e) => onChange({ ...cred, issuedDate: textOrNull(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>만료일</label>
        <input
          className="input"
          placeholder="YYYY-MM-DD"
          value={cred.expiresDate ?? ""}
          onChange={(e) => onChange({ ...cred, expiresDate: textOrNull(e.target.value) })}
        />
      </div>
      <Button variant="ghost-danger" size="sm" onClick={onRemove}>
        삭제
      </Button>
    </div>
  );
}

function RowEditor({
  row,
  categories,
  onChange,
}: {
  row: DraftCompanyRow;
  categories: ImportCategoryOption[];
  onChange: (next: DraftCompanyRow) => void;
}) {
  const set = (patch: Partial<DraftCompanyRow>) => onChange({ ...row, ...patch });

  return (
    <div style={{ display: "grid", gap: 12, padding: "12px 4px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <EditField label="기업명 *" value={row.name} onChange={(v) => set({ name: v })} />
        <EditField
          label="사업자번호"
          value={row.bizNo ?? ""}
          placeholder="000-00-00000"
          onChange={(v) => set({ bizNo: textOrNull(v) })}
        />
        <EditField label="업종" value={row.industry ?? ""} onChange={(v) => set({ industry: textOrNull(v) })} />
        <EditField
          label="업태"
          value={row.businessCondition ?? ""}
          onChange={(v) => set({ businessCondition: textOrNull(v) })}
        />
        <EditField label="지역" value={row.region ?? ""} onChange={(v) => set({ region: textOrNull(v) })} />
        <EditField
          label="설립일"
          value={row.foundedDate ?? ""}
          placeholder="YYYY-MM-DD"
          onChange={(v) => set({ foundedDate: textOrNull(v) })}
        />
        <EditField
          label="연매출(억원)"
          type="number"
          value={row.revenueEok === null || Number.isNaN(row.revenueEok) ? "" : String(row.revenueEok)}
          onChange={(v) => set({ revenueEok: numOrNull(v) })}
        />
        <EditField
          label="인원수"
          type="number"
          value={row.headcount === null || Number.isNaN(row.headcount) ? "" : String(row.headcount)}
          onChange={(v) => set({ headcount: numOrNull(v) })}
        />
        <EditField label="대표자명" value={row.ceoName ?? ""} onChange={(v) => set({ ceoName: textOrNull(v) })} />
        <EditField
          label="담당자명"
          value={row.contactName ?? ""}
          onChange={(v) => set({ contactName: textOrNull(v) })}
        />
        <EditField
          label="담당자연락처"
          value={row.contactPhone ?? ""}
          onChange={(v) => set({ contactPhone: textOrNull(v) })}
        />
        <EditField
          label="담당자이메일"
          value={row.contactEmail ?? ""}
          onChange={(v) => set({ contactEmail: textOrNull(v) })}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <EditField
          label="태그(쉼표 구분)"
          value={row.conditionTags.join(", ")}
          onChange={(v) =>
            set({ conditionTags: v.split(",").map((t) => t.trim()).filter(Boolean) })
          }
        />
        <EditField label="메모" value={row.memo ?? ""} onChange={(v) => set({ memo: textOrNull(v) })} />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>자격·인증 {row.credentials.length}개</strong>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              set({
                credentials: [
                  ...row.credentials,
                  {
                    type: "",
                    categoryName: null,
                    categoryId: null,
                    issuedDate: null,
                    expiresDate: null,
                    memo: null,
                  },
                ],
              })
            }
          >
            + 자격 추가
          </Button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {row.credentials.map((cred, i) => (
            <CredentialEditor
              key={i}
              cred={cred}
              categories={categories}
              onChange={(next) =>
                set({ credentials: row.credentials.map((c, j) => (j === i ? next : c)) })
              }
              onRemove={() => set({ credentials: row.credentials.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ImportPreviewTable({
  rows,
  categories,
  onChange,
}: {
  rows: DraftCompanyRow[];
  categories: ImportCategoryOption[];
  onChange: (rows: DraftCompanyRow[]) => void;
}) {
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  function updateRow(next: DraftCompanyRow) {
    onChange(rows.map((r) => (r.rowId === next.rowId ? next : r)));
  }

  const includedCount = rows.filter((r) => r.include).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return (
    <Panel>
      <PanelHead
        title="가져올 기업 미리보기"
        count={`${rows.length}개 중 ${includedCount}개 선택${errorCount > 0 ? ` · 오류 ${errorCount}건` : ""}`}
      />
      <div style={{ overflowX: "auto" }}>
        <table className="dlist">
          <thead>
            <tr>
              <th style={{ width: 36 }} aria-label="등록 여부" />
              <th>기업명</th>
              <th>사업자번호</th>
              <th>업종</th>
              <th className="r">자격</th>
              <th>상태</th>
              <th style={{ width: 72 }} aria-label="수정" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = openRowId === row.rowId;
              return (
                <RowGroup key={row.rowId}>
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.include}
                        disabled={row.errors.length > 0}
                        aria-label={`${row.name || row.sourceRef} 등록`}
                        onChange={(e) => updateRow({ ...row, include: e.target.checked })}
                      />
                    </td>
                    <td className="co">
                      {row.name || <span style={{ color: "var(--critical, #e41e3f)" }}>기업명 없음</span>}
                      <div style={{ fontSize: 12, color: "var(--stone, #8595a4)" }}>{row.sourceRef}</div>
                    </td>
                    <td className="item">{row.bizNo ?? "—"}</td>
                    <td className="item">{row.industry ?? "—"}</td>
                    <td className="r">{row.credentials.length > 0 ? `${row.credentials.length}개` : "—"}</td>
                    <td>
                      <StatusBadges row={row} />
                    </td>
                    <td className="r">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpenRowId(isOpen ? null : row.rowId)}
                      >
                        {isOpen ? "닫기" : "수정"}
                      </Button>
                    </td>
                  </tr>
                  {row.errors.length > 0 || row.warnings.length > 0 || row.duplicateName ? (
                    <tr>
                      <td />
                      <td colSpan={6} style={{ paddingTop: 0 }}>
                        {row.errors.map((msg) => (
                          <div key={msg} className="field-error">
                            {msg}
                          </div>
                        ))}
                        {row.warnings.map((msg) => (
                          <div key={msg} style={{ fontSize: 12, color: "var(--attention, #f2a918)" }}>
                            {msg}
                          </div>
                        ))}
                        {row.duplicateName ? (
                          <label
                            style={{
                              display: "inline-flex",
                              gap: 6,
                              alignItems: "center",
                              fontSize: 12,
                              color: "var(--charcoal, #444950)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.confirmDuplicate}
                              onChange={(e) =>
                                updateRow({ ...row, confirmDuplicate: e.target.checked })
                              }
                            />
                            기존 기업 &quot;{row.duplicateName}&quot;과(와) 다른 기업입니다 (중복 아님)
                          </label>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                  {isOpen ? (
                    <tr>
                      <td />
                      <td colSpan={6}>
                        <RowEditor row={row} categories={categories} onChange={updateRow} />
                      </td>
                    </tr>
                  ) : null}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** tbody 안에서 행 묶음을 key 하나로 다루기 위한 fragment 헬퍼 */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

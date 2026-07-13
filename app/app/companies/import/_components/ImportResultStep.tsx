"use client";

import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Panel, PanelHead } from "@/components/ui/Panel";
import type { ImportRowResult } from "@/lib/import/types";

export function ImportResultStep({
  results,
  onRetryFailed,
}: {
  results: ImportRowResult[];
  onRetryFailed: () => void;
}) {
  const created = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const warned = created.filter((r) => r.warning);

  return (
    <>
      <Panel>
        <div style={{ padding: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
            {failed.length === 0
              ? `${created.length}개 기업을 모두 등록했습니다 🎉`
              : `${created.length}개 등록 완료 · ${failed.length}개 실패`}
          </h2>
          <p style={{ margin: 0, color: "var(--steel, #5d6c7b)", fontSize: 14 }}>
            등록된 기업의 자격 만료·마감은 대시보드 D-day에 자동으로 반영됩니다.
            {warned.length > 0
              ? ` 일부 기업(${warned.length}개)은 자격 생성에 문제가 있어 확인이 필요합니다.`
              : ""}
          </p>
        </div>
      </Panel>

      {failed.length > 0 || warned.length > 0 ? (
        <div style={{ marginTop: 16 }}>
        <Panel>
          <PanelHead title="확인이 필요한 항목" count={`${failed.length + warned.length}건`} />
          <table className="dlist">
            <thead>
              <tr>
                <th>기업명</th>
                <th>결과</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((r) => (
                <tr key={r.rowId}>
                  <td className="co">{r.name}</td>
                  <td>
                    <Badge tone="critical">실패</Badge>
                  </td>
                  <td className="item">{r.error}</td>
                </tr>
              ))}
              {warned.map((r) => (
                <tr key={r.rowId}>
                  <td className="co">{r.name}</td>
                  <td>
                    <Badge tone="warning">일부 실패</Badge>
                  </td>
                  <td className="item">{r.warning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {failed.length > 0 ? (
          <Button variant="secondary" onClick={onRetryFailed}>
            실패한 {failed.length}개 행 수정하기
          </Button>
        ) : null}
        <LinkButton variant="cta" href="/app/companies">
          기업 목록으로
        </LinkButton>
      </div>
    </>
  );
}

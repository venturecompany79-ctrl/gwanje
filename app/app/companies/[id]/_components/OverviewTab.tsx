"use client";

import { Panel, PanelHead } from "@/components/ui/Panel";
import { formatRevenue } from "@/lib/format";
import type { CompanyProfile } from "@/lib/data/company-detail";

function Item({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  return (
    <div className={`pf-item${full ? " pf-item--full" : ""}`}>
      <div className="k">{label}</div>
      <div className={`v${value === null ? " muted" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

export function OverviewTab({ company }: { company: CompanyProfile }) {
  return (
    <Panel>
      <PanelHead title="기업 프로파일" />
      <div className="profile-grid">
        <Item label="사업자등록번호" value={company.bizNo} />
        <Item label="업종" value={company.industry} />
        <Item label="설립일" value={company.foundedDate} />
        <Item
          label="연 매출"
          value={company.revenue !== null ? formatRevenue(company.revenue) : null}
        />
        <Item
          label="인원"
          value={company.headcount !== null ? `${company.headcount}명` : null}
        />
        <Item label="대표자" value={company.ceoName} />
        <Item label="담당자" value={company.contactName} />
        <Item label="담당자 연락처" value={company.contactPhone} />
        <Item label="담당자 이메일" value={company.contactEmail} full />
        <div className="pf-item pf-item--full">
          <div className="k">컨디션 태그</div>
          {company.conditionTags.length === 0 ? (
            <div className="v muted">—</div>
          ) : (
            <div className="chip-row" style={{ marginTop: 2 }}>
              {company.conditionTags.map((tag) => (
                <span key={tag} className="cat-chip">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <Item label="메모" value={company.memo} full />
      </div>
    </Panel>
  );
}

"use client";

import { Panel, PanelHead } from "@/components/ui/Panel";
import { formatRevenue } from "@/lib/format";
import type {
  CompanyProfile,
  DocumentRow,
  MeetingReportRow,
} from "@/lib/data/company-detail";
import { MeetingReportsPanel } from "./ReportsTab";

/** 설립일 → "2020-03-01 (7년차)" (설립 연도를 1년차로 계산) */
function foundedDateValue(foundedDate: string | null): string | null {
  if (!foundedDate) return null;
  const founded = new Date(foundedDate);
  if (Number.isNaN(founded.getTime())) return foundedDate;
  const years = new Date().getFullYear() - founded.getFullYear() + 1;
  return years >= 1 ? `${foundedDate} (${years}년차)` : foundedDate;
}

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

export function OverviewTab({
  company,
  documents,
  reports,
  driveConnected,
  driveConfigured,
  showToast,
}: {
  company: CompanyProfile;
  documents: DocumentRow[];
  reports: MeetingReportRow[];
  driveConnected: boolean;
  driveConfigured: boolean;
  showToast: (message: string) => void;
}) {
  return (
    <>
      <Panel>
        <PanelHead title="기업 프로파일" />
        <div className="profile-grid">
          <Item label="사업자등록번호" value={company.bizNo} />
          <Item label="대표 업종" value={company.industry} />
          <Item label="업태" value={company.businessCondition} />
          <Item label="설립일" value={foundedDateValue(company.foundedDate)} />
          <Item label="지역명" value={company.region} />
          <Item
            label="계약기간"
            value={
              company.contractStartDate || company.contractEndDate
                ? `${company.contractStartDate ?? "—"} ~ ${company.contractEndDate ?? "—"}`
                : null
            }
            full
          />
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
      <MeetingReportsPanel
        companyId={company.id}
        companyName={company.name}
        documents={documents}
        reports={reports}
        driveConnected={driveConnected}
        driveConfigured={driveConfigured}
        showToast={showToast}
      />
    </>
  );
}

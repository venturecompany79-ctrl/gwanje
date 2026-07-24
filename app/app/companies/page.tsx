import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert, IconBuilding, IconDownload } from "@/components/ui/icons";
import {
  COMPANY_LIST_LIMIT,
  getCompaniesData,
} from "@/lib/data/companies";
import { AddCompanyButton } from "./_components/AddCompanySlideOver";
import { CompaniesTable } from "./_components/CompaniesTable";

export const metadata: Metadata = { title: "기업" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    sort?: string;
    scope?: string;
    view?: string;
    consultant?: string;
    work?: string;
  }>;
}) {
  const [{ q, tag, sort, scope, view, consultant, work }, data] =
    await Promise.all([
    searchParams,
    getCompaniesData(),
    ]);
  const count = data.companies.length;

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <div className="page-head">
        <div>
          <h1>기업</h1>
          <div className="sub">
            {count === 0
              ? "관리할 기업을 등록해 시작하세요"
              : data.hasMore
                ? `${count}개사 이상 관리 중`
                : `총 ${count}개사 관리 중`}
          </div>
        </div>
        <div className="spacer" />
        <div className="head-actions">
          <LinkButton variant="secondary" size="sm" href="/app/companies/import">
            <IconDownload /> 가져오기
          </LinkButton>
          <AddCompanyButton demo={data.demo} />
        </div>
      </div>

      {data.hasMore ? (
        <div className="demo-banner">
          <IconAlert />
          기업이 {COMPANY_LIST_LIMIT}개를 초과해 이름순 최대 {COMPANY_LIST_LIMIT}
          개사까지만 표시됩니다. 검색과 필터도 현재 표시된 기업에 적용됩니다.
        </div>
      ) : null}

      {count === 0 ? (
        <EmptyState
          icon={<IconBuilding />}
          title="첫 기업을 등록하세요"
          description="기업을 추가하면 보유 자격·과제의 만료와 마감이 자동으로 추적되고, 이 목록에서 한눈에 관제할 수 있습니다."
          action={
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <AddCompanyButton demo={data.demo} size="md" />
              <LinkButton variant="secondary" href="/app/companies/import">
                엑셀로 한 번에 가져오기
              </LinkButton>
            </div>
          }
        />
      ) : (
        <CompaniesTable
          data={data}
          initialQuery={q ?? ""}
          initialTag={tag ?? null}
          initialSort={sort ?? null}
          initialScope={scope ?? null}
          initialView={view ?? null}
          initialConsultant={consultant ?? null}
          initialWorkStatus={work ?? null}
        />
      )}
    </>
  );
}

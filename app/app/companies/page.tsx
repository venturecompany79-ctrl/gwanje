import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert, IconBuilding } from "@/components/ui/icons";
import { getCompaniesData } from "@/lib/data/companies";
import { AddCompanyButton } from "./_components/AddCompanySlideOver";
import { CompaniesTable } from "./_components/CompaniesTable";

export const metadata: Metadata = { title: "기업" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, data] = await Promise.all([searchParams, getCompaniesData()]);
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
              : `총 ${count}개사 관리 중`}
          </div>
        </div>
        <div className="spacer" />
        <div className="head-actions">
          <AddCompanyButton demo={data.demo} />
        </div>
      </div>

      {count === 0 ? (
        <EmptyState
          icon={<IconBuilding />}
          title="첫 기업을 등록하세요"
          description="기업을 추가하면 보유 자격·관리포인트의 만료와 마감이 자동으로 추적되고, 이 목록에서 한눈에 관제할 수 있습니다."
          action={<AddCompanyButton demo={data.demo} size="md" />}
        />
      ) : (
        <CompaniesTable companies={data.companies} initialQuery={q ?? ""} />
      )}
    </>
  );
}

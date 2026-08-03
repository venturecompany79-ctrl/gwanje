import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlert, IconBack } from "@/components/ui/icons";
import { DEMO_COMPANIES } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { GovProgramsWorkspace } from "./_components/GovProgramsWorkspace";

export const metadata: Metadata = { title: "맞춤 정부지원사업" };
export const dynamic = "force-dynamic";

export interface GovProgramPageSearchParams {
  q?: string;
  field?: string;
  region?: string;
  due?: string;
  fit?: string;
  eligibility?: string;
  status?: string;
  sort?: string;
  page?: string;
  program?: string;
}

export default async function CompanyGovProgramsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<GovProgramPageSearchParams>;
}) {
  const [{ id }, initialFilters] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  let demo = false;
  let companies: Array<{ id: string; name: string; status: string }> = [];
  if (!supabase) {
    const data = DEMO_COMPANIES();
    demo = true;
    companies = data.companies.map((company) => ({
      id: company.id,
      name: company.name,
      status: company.status,
    }));
  } else {
    const result = await supabase
      .from("company")
      .select("id, name, status")
      .order("status")
      .order("name")
      .limit(500);
    if (result.error) {
      throw new Error(`기업 목록을 불러오지 못했습니다: ${result.error.message}`);
    }
    companies = result.data ?? [];
  }

  const current = companies.find((company) => company.id === id);
  if (!current) notFound();

  return (
    <>
      {demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — 매칭 프로필은 예시이며 관심·제외·Task 상태는 저장되지 않습니다.
        </div>
      ) : null}

      <nav className="crumb" aria-label="브레드크럼">
        <Link href="/app/companies">
          <IconBack /> 기업 목록
        </Link>
        <span className="sep">/</span>
        <Link href={`/app/companies/${id}`}>{current.name}</Link>
        <span className="sep">/</span>
        <span className="cur">맞춤 정부지원사업</span>
      </nav>

      <GovProgramsWorkspace
        companyId={id}
        companies={companies}
        initialFilters={initialFilters}
      />
    </>
  );
}

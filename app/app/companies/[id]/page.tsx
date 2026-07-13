import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlert, IconBack } from "@/components/ui/icons";
import { getCompanyDetail } from "@/lib/data/company-detail";
import { getCompanyShareSettings } from "@/lib/data/company-share";
import { isCompanyShareConfigured } from "@/lib/share/config";
import { createClient } from "@/lib/supabase/server";
import { CompanyDetailView } from "./_components/CompanyDetailView";

export const metadata: Metadata = { title: "기업 상세" };
export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  // 정부지원사업 탭은 풀 전체(최대 1,000건)를 다루므로 RSC payload에 싣지 않고
  // RecommendTab이 클라이언트에서 직접 조회한다.
  const [data, share] = await Promise.all([
    getCompanyDetail(id),
    supabase ? getCompanyShareSettings(supabase, id) : Promise.resolve(null),
  ]);
  if (!data) notFound();

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <nav className="crumb" aria-label="브레드크럼">
        <Link href="/app/companies">
          <IconBack /> 기업 목록
        </Link>
        <span className="sep">/</span>
        <span className="cur">{data.company.name}</span>
      </nav>

      <CompanyDetailView
        data={data}
        initialTab={tab ?? "overview"}
        share={share}
        shareConfigured={isCompanyShareConfigured()}
      />
    </>
  );
}

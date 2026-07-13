import type { Metadata } from "next";
import Link from "next/link";
import { IconAlert, IconBack } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { aiImportEnabled } from "@/lib/import/ai-parse";
import type {
  ImportCategoryOption,
  ImportExistingCompany,
} from "@/lib/import/types";
import { ImportWizard } from "./_components/ImportWizard";

export const metadata: Metadata = { title: "기업 가져오기" };
export const dynamic = "force-dynamic";
// AI 파싱 서버 액션이 이 세그먼트에서 실행됨 — Gemini 호출이 수십 초 걸릴 수 있다
export const maxDuration = 60;

export default async function ImportCompaniesPage() {
  const supabase = await createClient();
  const demo = !supabase;

  let categories: ImportCategoryOption[] = [];
  let existing: ImportExistingCompany[] = [];
  if (supabase) {
    const [categoryRes, companyRes] = await Promise.all([
      supabase.from("category").select("id, name").order("sort_order"),
      supabase.from("company").select("name, biz_no"),
    ]);
    categories = categoryRes.data ?? [];
    existing = (companyRes.data ?? []).map((c) => ({
      name: c.name,
      bizNo: c.biz_no,
    }));
  }

  return (
    <>
      {demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 - Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <div className="crumb">
        <Link href="/app/companies">
          <IconBack /> 기업
        </Link>
        <span className="sep">/</span>
        <span className="cur">가져오기</span>
      </div>

      <div className="page-head">
        <div>
          <h1>기업 가져오기</h1>
          <div className="sub">
            엑셀·CSV 파일로 기존 관리 기업을 한 번에 등록합니다
          </div>
        </div>
      </div>

      <ImportWizard
        demo={demo}
        aiEnabled={aiImportEnabled()}
        categories={categories}
        existing={existing}
      />
    </>
  );
}

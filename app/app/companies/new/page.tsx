import type { Metadata } from "next";
import Link from "next/link";
import { IconAlert, IconBack, IconCheck, IconInfo } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { CompanyIntakeForm } from "./_components/CompanyIntakeForm";

export const metadata: Metadata = { title: "기업 정보입력" };
export const dynamic = "force-dynamic";

const requiredItems = [
  "사업자등록증 업로드와 사업자등록번호",
  "기업명, 대표 업종, 업종 경로",
  "설립일, 매출, 인원, 대표자",
  "담당자 연락처와 이메일",
  "전략품목 및 보유 기술",
  "기업인증정보",
  "관심사업분야",
];

const implementationPlan = [
  "1차 저장: 사업자등록증 자동 입력값과 기본 프로파일을 company 테이블에 저장",
  "2차 확장: 업종, 기술, 인증, 관심분야를 별도 테이블로 분리해 추천 엔진 입력값으로 사용",
  "3차 확장: 공공데이터 조회와 추천 엔진 입력값을 고도화",
];

export default async function NewCompanyPage() {
  const supabase = await createClient();
  const demo = !supabase;

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
        <span className="cur">기업추가</span>
        <span className="sep">/</span>
        <span className="cur">정보입력</span>
      </div>

      <div className="page-head">
        <div>
          <h1>기업 정보입력</h1>
          <div className="sub">
            사업자등록증부터 지원사업 매칭 정보까지 한 번에 등록합니다
          </div>
        </div>
      </div>

      <div className="intake-layout">
        <div className="intake-main">
          <CompanyIntakeForm demo={demo} />
        </div>

        <aside className="intake-side" aria-label="기업 신청 정보 수집 계획">
          <section className="intake-plan">
            <div className="intake-plan-head">
              <IconInfo />
              <div>
                <h2>스크린샷 기반 항목 정리</h2>
                <p>wellobiz 신청 흐름에서 확인한 기업정보 입력 항목입니다.</p>
              </div>
            </div>
            <ul className="intake-plan-list">
              {requiredItems.map((item) => (
                <li key={item}>
                  <IconCheck />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="intake-plan">
            <div className="intake-plan-head">
              <IconInfo />
              <div>
                <h2>구현 계획</h2>
                <p>빠른 창전환을 우선해 별도 라우트와 가벼운 폼으로 시작합니다.</p>
              </div>
            </div>
            <ol className="intake-steps">
              {implementationPlan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

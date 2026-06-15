"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import {
  IconAlert,
  IconAward,
  IconBuilding,
  IconCheck,
  IconFile,
  IconInfo,
  IconTag,
  IconTarget,
} from "@/components/ui/icons";
import { addCompany } from "../../actions";

const technologyOptions = [
  "AI(인공지능)",
  "5G/이동통신",
  "디지털방송",
  "위성/전파",
  "클라우드",
  "핀테크/마이데이터",
  "스마트팜/제조/공정",
  "ICT융합",
];

const certificationOptions = [
  "벤처기업",
  "ISO인증",
  "기업부설연구소",
  "메인비즈",
  "이노비즈",
  "여성기업",
  "사회적기업",
  "장애인기업",
  "연구개발전담부서",
  "창업기업",
];

const interestOptions = [
  "우수기업(업체) 인증",
  "법무/세금/보험지원",
  "고용/근로자지원",
  "바우처지원",
  "ESG",
  "투자",
  "마케팅/광고/홍보",
  "융자/대출",
  "물류/수출",
  "해외진출/현지화",
  "조달",
  "R&D/엔지니어링",
  "시제품 제작/규제샌드박스",
  "디자인 개발",
  "네트워킹",
  "시설입주/지사설립 및 이전",
];

function ChoiceGroup({
  name,
  options,
  compact = false,
}: {
  name: string;
  options: string[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "intake-choices intake-choices--compact" : "intake-choices"}>
      {options.map((option) => (
        <label key={option} className="intake-choice">
          <input type="checkbox" name={name} value={option} />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

export function CompanyIntakeForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? "");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addCompany(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.companyId ? `/app/companies/${result.companyId}` : "/app/companies");
      router.refresh();
    });
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit}>
      {demo ? (
        <div className="auth-notice">
          <b>데모 모드</b> - 입력 내용은 저장되지 않습니다. Supabase 연결(.env.local)
          후 실제 등록이 가능합니다.
        </div>
      ) : null}
      {error ? (
        <div className="auth-error">
          <IconAlert /> {error}
        </div>
      ) : null}

      <section className="intake-section" aria-labelledby="license-section">
        <div className="intake-section-head">
          <span className="intake-section-icon">
            <IconFile />
          </span>
          <div>
            <h2 id="license-section">사업자 확인</h2>
            <p>스크린샷의 첫 단계처럼 사업자등록증에서 기본 식별값을 먼저 확보합니다.</p>
          </div>
        </div>
        <div className="license-drop">
          <IconFile />
          <div>
            <b>{fileName || "사업자등록증 파일 선택"}</b>
            <span>PDF, JPG, PNG, TIFF 형식. 파일 저장 자동화는 스토리지 연동 후 붙입니다.</span>
          </div>
          <input
            type="file"
            name="business_license"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
            onChange={handleFileChange}
            aria-label="사업자등록증 파일"
          />
        </div>
        <input
          type="hidden"
          name="business_license_status"
          value={fileName ? `${fileName} 선택됨, 파일 저장 연동 예정` : ""}
        />
        <div className="form-grid2">
          <InputField
            label="사업자등록번호"
            name="biz_no"
            placeholder="123-45-67890"
          />
          <InputField label="기업명 *" name="name" required placeholder="(주)테크노바" />
        </div>
      </section>

      <section className="intake-section" aria-labelledby="basic-section">
        <div className="intake-section-head">
          <span className="intake-section-icon">
            <IconBuilding />
          </span>
          <div>
            <h2 id="basic-section">기본 기업정보</h2>
            <p>기업 상세 프로파일과 지원사업 필터링의 기준값으로 사용합니다.</p>
          </div>
        </div>
        <div className="form-grid2">
          <InputField label="대표 업종" name="industry" placeholder="IT/소프트웨어" />
          <InputField label="설립일" name="founded_date" type="date" />
        </div>
        <InputField
          label="업종 경로"
          name="industry_path"
          placeholder="도매 및 소매업 > 생활용품 도매업 > 남녀용 겉옷 및 셔츠 도매업"
        />
        <div className="form-grid2">
          <InputField
            label="연 매출 (억 원)"
            name="revenue"
            type="number"
            min={0}
            step={0.1}
            placeholder="42"
          />
          <InputField
            label="인원 (명)"
            name="headcount"
            type="number"
            min={0}
            placeholder="28"
          />
        </div>
        <div className="form-grid2">
          <InputField label="대표자" name="ceo_name" placeholder="박지훈" />
          <InputField label="담당자" name="contact_name" placeholder="김민서" />
        </div>
        <div className="form-grid2">
          <InputField
            label="담당자 연락처"
            name="contact_phone"
            placeholder="010-0000-0000"
          />
          <InputField
            label="담당자 이메일"
            name="contact_email"
            type="email"
            placeholder="manager@company.com"
          />
        </div>
      </section>

      <section className="intake-section" aria-labelledby="matching-section">
        <div className="intake-section-head">
          <span className="intake-section-icon">
            <IconTarget />
          </span>
          <div>
            <h2 id="matching-section">지원사업 매칭 정보</h2>
            <p>스크린샷의 Step01-04 항목을 우리 시스템의 추천 입력값으로 정리했습니다.</p>
          </div>
        </div>

        <div className="intake-subsection">
          <div className="intake-subtitle">
            <IconTag />
            <span>Step02. 전략품목 및 기술</span>
          </div>
          <ChoiceGroup name="technologies" options={technologyOptions} compact />
          <InputField
            label="추가 기술 키워드"
            name="technology_keywords"
            placeholder="예: 딥러닝 비전검사, SaaS, 스마트팩토리"
          />
        </div>

        <div className="intake-subsection">
          <div className="intake-subtitle">
            <IconAward />
            <span>Step03. 기업인증정보</span>
          </div>
          <ChoiceGroup name="certifications" options={certificationOptions} compact />
        </div>

        <div className="intake-subsection">
          <div className="intake-subtitle">
            <IconCheck />
            <span>Step04. 관심사업분야</span>
          </div>
          <ChoiceGroup name="interest_areas" options={interestOptions} />
          <InputField
            label="추가 관심분야"
            name="interest_keywords"
            placeholder="예: 정책자금, 수출바우처, 연구장비 활용"
          />
        </div>
      </section>

      <section className="intake-section" aria-labelledby="note-section">
        <div className="intake-section-head">
          <span className="intake-section-icon">
            <IconInfo />
          </span>
          <div>
            <h2 id="note-section">운영 메모</h2>
            <p>컨설턴트가 기업 컨디션과 상담 맥락을 빠르게 남기는 영역입니다.</p>
          </div>
        </div>
        <InputField
          label="컨디션 태그"
          name="condition_tags"
          placeholder="성장기, 수출기업, 연구개발형 - 쉼표로 구분"
        />
        <div className="field">
          <label htmlFor="company-intake-memo">메모</label>
          <textarea
            id="company-intake-memo"
            name="memo"
            className="memo-input"
            placeholder="신청 목적, 필요한 인증, 고객 요청사항을 남겨두세요."
          />
        </div>
      </section>

      <div className="intake-actions">
        <Button variant="cta" type="submit" disabled={pending}>
          {pending ? "저장 중..." : "기업 정보 저장"}
        </Button>
        <LinkButton variant="ghost" href="/app/companies">
          취소
        </LinkButton>
      </div>
    </form>
  );
}

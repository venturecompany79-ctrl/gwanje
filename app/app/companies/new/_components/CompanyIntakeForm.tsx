"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InputField, MaskedInputField } from "@/components/ui/Input";
import { isValidBizNo } from "@/lib/format";
import {
  businessLicenseFieldsSummary,
  parseBusinessLicenseText,
  type BusinessLicenseFields,
} from "@/lib/business-license";
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

type LicenseParseTone = "idle" | "loading" | "success" | "warning" | "error";

interface CompanyAutofillFields {
  biz_no: string;
  name: string;
  industry: string;
  business_condition: string;
  founded_date: string;
  region: string;
  ceo_name: string;
}

interface ExtractedLicenseText {
  text: string;
  method: string;
}

const EMPTY_AUTOFILL_FIELDS: CompanyAutofillFields = {
  biz_no: "",
  name: "",
  industry: "",
  business_condition: "",
  founded_date: "",
  region: "",
  ceo_name: "",
};

/** 설립일 → "N년차" (설립 연도를 1년차로 계산). 유효한 날짜가 아니면 빈 문자열. */
function yearsInBusinessLabel(foundedDate: string): string {
  if (!foundedDate) return "";
  const founded = new Date(foundedDate);
  if (Number.isNaN(founded.getTime())) return "";
  const years = new Date().getFullYear() - founded.getFullYear() + 1;
  if (years < 1) return "";
  return ` (${years}년차)`;
}

function countParsedFields(fields: BusinessLicenseFields): number {
  return [
    fields.bizNo,
    fields.name,
    fields.ceoName,
    fields.foundedDate,
    fields.industry,
  ].filter(Boolean).length;
}

function parsedFieldPatch(
  fields: BusinessLicenseFields,
): Partial<CompanyAutofillFields> {
  return {
    ...(fields.bizNo ? { biz_no: fields.bizNo } : {}),
    ...(fields.name ? { name: fields.name } : {}),
    ...(fields.industry ? { industry: fields.industry } : {}),
    ...(fields.businessCondition
      ? { business_condition: fields.businessCondition }
      : {}),
    ...(fields.foundedDate ? { founded_date: fields.foundedDate } : {}),
    ...(fields.region ? { region: fields.region } : {}),
    ...(fields.ceoName ? { ceo_name: fields.ceoName } : {}),
  };
}

function rawPdfTextFallback(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const latin1 = new TextDecoder("latin1", { fatal: false }).decode(bytes);
  return `${utf8}\n${latin1}`
    .replace(/\\([0-9]{3})/g, (_, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    )
    .replace(/[^\S\n]+/g, " ");
}

async function runImageOcr(
  image: File | Blob | string,
  onStatus: (message: string) => void,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(["kor", "eng"], 1, {
    logger: (message) => {
      if (!message.status) return;
      if (message.progress > 0 && message.progress < 1) {
        onStatus(`이미지 OCR 중입니다 (${Math.round(message.progress * 100)}%)`);
        return;
      }
      onStatus(`이미지 OCR 준비 중입니다`);
    },
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    const {
      data: { text },
    } = await worker.recognize(image);
    return text;
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(
  file: File,
  onStatus: (message: string) => void,
): Promise<ExtractedLicenseText> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  try {
    const textPages: string[] = [];
    const pageCount = Math.min(pdf.numPages, 3);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onStatus(`PDF 텍스트를 읽는 중입니다 (${pageNumber}/${pageCount})`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      textPages.push(
        content.items
          .map((item) => ("str" in item ? String(item.str) : ""))
          .join(" "),
      );
    }

    const text = textPages.join("\n").trim();
    if (text.length >= 20) {
      return { text, method: "PDF 텍스트" };
    }

    onStatus("스캔 PDF로 보여 첫 페이지 OCR을 시도합니다");
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return { text: rawPdfTextFallback(buffer), method: "PDF 원문" };
    }
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await firstPage.render({ canvas, viewport }).promise;
    return {
      text: await runImageOcr(canvas.toDataURL("image/png"), onStatus),
      method: "PDF 이미지 OCR",
    };
  } finally {
    await loadingTask.destroy();
  }
}

async function extractImageText(
  file: File,
  onStatus: (message: string) => void,
): Promise<ExtractedLicenseText> {
  const url = URL.createObjectURL(file);
  try {
    return {
      text: await runImageOcr(url, onStatus),
      method: "이미지 OCR",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractBusinessLicenseText(
  file: File,
  onStatus: (message: string) => void,
): Promise<ExtractedLicenseText> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(file, onStatus);
  }
  if (type.startsWith("image/") || /\.(jpe?g|png|tiff?|webp)$/.test(name)) {
    return extractImageText(file, onStatus);
  }
  if (type.startsWith("text/") || /\.(txt|csv)$/.test(name)) {
    return { text: await file.text(), method: "텍스트 파일" };
  }

  return { text: await file.text(), method: "파일 텍스트" };
}

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
  const [bizNoError, setBizNoError] = useState<string | undefined>();
  const [fileName, setFileName] = useState("");
  const [licenseTone, setLicenseTone] = useState<LicenseParseTone>("idle");
  const [licenseStatus, setLicenseStatus] = useState("");
  const [licenseSummary, setLicenseSummary] = useState("");
  const [autofillFields, setAutofillFields] =
    useState<CompanyAutofillFields>(EMPTY_AUTOFILL_FIELDS);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const parseRunRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  function updateAutofillField(
    key: keyof CompanyAutofillFields,
    value: string,
  ) {
    setAutofillFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    const runId = parseRunRef.current + 1;
    parseRunRef.current = runId;
    setFileName(file?.name ?? "");
    setLicenseSummary("");
    setError(null);

    if (!file) {
      setLicenseTone("idle");
      setLicenseStatus("");
      return;
    }

    setLicenseTone("loading");
    setLicenseStatus("사업자등록증 정보를 읽는 중입니다");

    try {
      const extracted = await extractBusinessLicenseText(file, (message) => {
        if (parseRunRef.current !== runId) return;
        setLicenseStatus(message);
      });
      if (parseRunRef.current !== runId) return;

      const parsed = parseBusinessLicenseText(extracted.text);
      const filledCount = countParsedFields(parsed);
      const summary = businessLicenseFieldsSummary(parsed);
      setAutofillFields((prev) => ({ ...prev, ...parsedFieldPatch(parsed) }));
      setLicenseSummary(`${extracted.method} · ${summary}`);
      setLicenseTone(filledCount > 0 ? "success" : "warning");
      setLicenseStatus(
        filledCount > 0
          ? `${filledCount}개 항목을 자동 입력했습니다`
          : "텍스트는 읽었지만 자동 입력할 항목을 찾지 못했습니다",
      );
    } catch (err) {
      console.error("[businessLicenseParse]", err);
      if (parseRunRef.current !== runId) return;
      setLicenseTone("error");
      setLicenseStatus(
        "자동 읽기에 실패했습니다. 아래 항목을 직접 입력하거나 파일 상태를 확인해 주세요.",
      );
      setLicenseSummary("자동 읽기 실패");
    }
  }

  function submitCompany(force: boolean) {
    const form = formRef.current;
    if (!form) return;
    if (!isValidBizNo(autofillFields.biz_no)) {
      setBizNoError("사업자등록번호는 숫자 10자리여야 합니다.");
      return;
    }
    setBizNoError(undefined);
    setError(null);
    const formData = new FormData(form);
    if (force) formData.set("confirm_duplicate", "1");
    startTransition(async () => {
      const result = await addCompany(formData);
      if (result.duplicate) {
        setDupWarning(result.error);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.companyId ? `/app/companies/${result.companyId}` : "/app/companies");
      router.refresh();
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDupWarning(null);
    submitCompany(false);
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit} ref={formRef}>
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
      {dupWarning ? (
        <div className="auth-notice" role="alert">
          <IconAlert /> {dupWarning}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => submitCompany(true)}
              disabled={pending}
            >
              그래도 등록
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDupWarning(null)}
            >
              취소
            </Button>
          </div>
        </div>
      ) : null}

      <section className="intake-section" aria-labelledby="license-section">
        <div className="intake-section-head">
          <span className="intake-section-icon">
            <IconFile />
          </span>
          <div>
            <h2 id="license-section">사업자 확인</h2>
            <p>사업자등록증을 올리면 기본 식별 정보를 자동으로 채워 드립니다.</p>
          </div>
        </div>
        <div className="license-drop">
          <IconFile />
          <div>
            <b>{fileName || "사업자등록증 파일 선택"}</b>
            <span>PDF, JPG, PNG, TIFF 형식. 업로드하면 사업자등록증 정보로 아래 항목을 자동 입력합니다.</span>
          </div>
          <input
            type="file"
            name="business_license"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
            onChange={handleFileChange}
            aria-label="사업자등록증 파일"
          />
        </div>
        {licenseStatus ? (
          <p className={`license-status license-status--${licenseTone}`}>
            {licenseStatus}
          </p>
        ) : null}
        <input
          type="hidden"
          name="business_license_status"
          value={
            fileName
              ? `${fileName} 업로드됨${licenseSummary ? ` · ${licenseSummary}` : ""}`
              : ""
          }
        />
        <div className="form-grid2">
          <MaskedInputField
            mask="bizNo"
            label="사업자등록번호"
            name="biz_no"
            placeholder="123-45-67890"
            error={bizNoError}
            value={autofillFields.biz_no}
            onChange={(e) => updateAutofillField("biz_no", e.target.value)}
          />
          <InputField
            label="기업명 *"
            name="name"
            required
            placeholder="예: (주)테크노바"
            value={autofillFields.name}
            onChange={(e) => updateAutofillField("name", e.target.value)}
          />
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
          <InputField
            label="대표 업종"
            name="industry"
            placeholder="예: 응용 소프트웨어 개발 (종목)"
            value={autofillFields.industry}
            onChange={(e) => updateAutofillField("industry", e.target.value)}
          />
          <InputField
            label="업태"
            name="business_condition"
            placeholder="예: 정보통신업"
            value={autofillFields.business_condition}
            onChange={(e) =>
              updateAutofillField("business_condition", e.target.value)
            }
          />
        </div>
        <div className="form-grid2">
          <InputField
            label={`설립일${yearsInBusinessLabel(autofillFields.founded_date)}`}
            name="founded_date"
            type="date"
            className="input--date"
            fieldClassName="field--date"
            value={autofillFields.founded_date}
            onChange={(e) =>
              updateAutofillField("founded_date", e.target.value)
            }
          />
          <InputField
            label="지역명"
            name="region"
            placeholder="예: 서울특별시 강남구"
            value={autofillFields.region}
            onChange={(e) => updateAutofillField("region", e.target.value)}
          />
        </div>
        <div className="form-grid2">
          <InputField
            label="연 매출 (억 원)"
            name="revenue"
            type="number"
            min={0}
            step={0.1}
            placeholder="예: 42"
          />
          <InputField
            label="인원 (명)"
            name="headcount"
            type="number"
            min={0}
            placeholder="예: 28"
          />
        </div>
        <div className="form-grid2">
          <InputField
            label="대표자"
            name="ceo_name"
            placeholder="예: 홍길동"
            value={autofillFields.ceo_name}
            onChange={(e) => updateAutofillField("ceo_name", e.target.value)}
          />
          <InputField label="담당자" name="contact_name" placeholder="예: 김담당" />
        </div>
        <div className="form-grid2">
          <MaskedInputField
            mask="phone"
            label="담당자 연락처"
            name="contact_phone"
            placeholder="010-0000-0000"
          />
          <InputField
            label="담당자 이메일"
            name="contact_email"
            type="email"
            placeholder="예: manager@company.com"
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
            <p>전략품목·인증·관심분야를 입력하면 맞춤 지원사업 추천에 활용됩니다.</p>
          </div>
        </div>

        <div className="intake-subsection">
          <div className="intake-subtitle">
            <IconTag />
            <span>전략품목 및 기술</span>
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
            <span>기업인증정보</span>
          </div>
          <ChoiceGroup name="certifications" options={certificationOptions} compact />
        </div>

        <div className="intake-subsection">
          <div className="intake-subtitle">
            <IconCheck />
            <span>관심사업분야</span>
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
        <div className="field">
          <label htmlFor="company-growth-stage">성장 단계</label>
          <select
            id="company-growth-stage"
            name="growth_stage"
            className="input"
            defaultValue=""
          >
            <option value="">선택 안 함</option>
            <option value="초기">초기</option>
            <option value="성장기">성장기</option>
            <option value="성숙기">성숙기</option>
          </select>
        </div>
        <InputField
          label="추가 컨디션 태그"
          name="condition_tags"
          placeholder="수출기업, 연구개발형 - 쉼표로 구분 (성장 단계 외 태그)"
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
        <Button
          variant="cta"
          type="submit"
          disabled={pending || licenseTone === "loading"}
        >
          {pending
            ? "저장 중..."
            : licenseTone === "loading"
              ? "사업자등록증 읽는 중..."
              : "기업 정보 저장"}
        </Button>
        <LinkButton variant="ghost" href="/app/companies">
          취소
        </LinkButton>
      </div>
    </form>
  );
}

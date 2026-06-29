export interface BusinessLicenseFields {
  bizNo: string | null;
  name: string | null;
  ceoName: string | null;
  foundedDate: string | null;
  /** 종목(대표 업종) */
  industry: string | null;
  /** 업태 */
  businessCondition: string | null;
  /** 지역명 — 사업장 소재지(시/도 + 시/군/구) */
  region: string | null;
}

const STOP_LABELS = [
  "사업자등록번호",
  "등록번호",
  "상호",
  "상 호",
  "법인명",
  "단체명",
  "성명",
  "성 명",
  "대표자",
  "주민등록번호",
  "생년월일",
  "사업장",
  "소재지",
  "본점",
  "개업연월일",
  "개업일",
  "설립일",
  "업태",
  "업 태",
  "종목",
  "종 목",
  "발급사유",
  "발급일자",
  "세무서장",
];

function compactLabel(label: string): string {
  return label.replace(/\s+/g, "");
}

function labelPattern(label: string): string {
  return compactLabel(label)
    .split("")
    .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function linesFromText(text: string): string[] {
  return normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanValue(value: string): string | null {
  const cleaned = value
    .replace(/^[\s:：|/·ㆍ,-]+/, "")
    .replace(/\([^)]{0,16}\)/g, " ")
    .replace(/\[[^\]]{0,16}\]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return null;
  if (/^(해당없음|없음|없슴|none|null)$/i.test(cleaned)) return null;
  return cleaned;
}

function stripAfterStopLabel(value: string, labels: string[]): string {
  let end = value.length;
  for (const label of labels) {
    const match = new RegExp(`\\s${labelPattern(label)}(?:\\s|[:：])`).exec(
      ` ${value}`,
    );
    if (match && match.index > 0) {
      end = Math.min(end, match.index - 1);
    }
  }
  return value.slice(0, end);
}

function findValueAfterLabel(
  text: string,
  labels: string[],
  stopLabels: string[] = STOP_LABELS,
): string | null {
  const lines = linesFromText(text);

  for (const [index, line] of lines.entries()) {
    for (const label of labels) {
      const pattern = new RegExp(
        `(?:^|\\s|[|])${labelPattern(label)}(?:\\([^)]*\\))?\\s*[:：]?\\s*(.*)$`,
      );
      const match = pattern.exec(line);
      if (!match) continue;

      const sameLine = cleanValue(stripAfterStopLabel(match[1] ?? "", stopLabels));
      if (sameLine) return sameLine;

      const nextLine = lines[index + 1];
      if (!nextLine) continue;
      const nextValue = cleanValue(stripAfterStopLabel(nextLine, stopLabels));
      if (nextValue && !stopLabels.some((stop) => new RegExp(`^${labelPattern(stop)}`).test(nextValue))) {
        return nextValue;
      }
    }
  }

  return null;
}

function parseBizNo(text: string): string | null {
  const normalized = normalizeText(text);
  const labeled =
    /(?:사업자\s*등록\s*번호|등록\s*번호)[^\d]{0,20}(\d{3})\D{0,3}(\d{2})\D{0,3}(\d{5})/.exec(
      normalized,
    );
  const loose = /(\d{3})\D{0,3}(\d{2})\D{0,3}(\d{5})/.exec(normalized);
  const match = labeled ?? loose;
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseDate(value: string | null): string | null {
  if (!value) return null;

  const normalized = value.replace(/\s+/g, " ").trim();
  const korean = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/.exec(
    normalized,
  );
  const delimited = /(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/.exec(
    normalized,
  );
  const compact = /(^|[^\d])(\d{4})(\d{2})(\d{2})([^\d]|$)/.exec(normalized);
  const match = korean ?? delimited;

  const year = match?.[1] ?? compact?.[2];
  const month = match?.[2] ?? compact?.[3];
  const day = match?.[3] ?? compact?.[4];
  if (!year || !month || !day) return null;

  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return null;
  }

  return `${year}-${monthNumber.toString().padStart(2, "0")}-${dayNumber
    .toString()
    .padStart(2, "0")}`;
}

function parseFoundedDate(text: string): string | null {
  const labeled = findValueAfterLabel(text, ["개업연월일", "개업일", "설립일"]);
  return parseDate(labeled) ?? parseDate(text);
}

function parseName(text: string): string | null {
  return findValueAfterLabel(text, [
    "법인명",
    "법인명(단체명)",
    "단체명",
    "상호",
    "상 호",
  ]);
}

function parseCeoName(text: string): string | null {
  return findValueAfterLabel(text, ["대표자", "대표자 성명", "성명", "성 명"]);
}

function parseIndustry(text: string): {
  industry: string | null;
  businessCondition: string | null;
} {
  // 업태(사업 형태)와 종목(취급 품목)을 분리해 반환한다.
  // 대표 업종(industry)은 종목을 우선 사용하고, 종목이 없으면 업태로 대체한다.
  const businessCondition = findValueAfterLabel(text, ["업태", "업 태"]);
  const item = findValueAfterLabel(text, ["종목", "종 목"]);
  return {
    industry: item ?? businessCondition,
    businessCondition,
  };
}

// "서울특별시 강남구 ..." → "서울특별시 강남구" 처럼 시/도 + 시/군/구만 추출
function parseRegion(text: string): string | null {
  const address = findValueAfterLabel(text, [
    "사업장 소재지",
    "사업장소재지",
    "소재지",
    "사업장",
  ]);
  if (!address) return null;

  const tokens = address.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const sido = tokens[0];
  const sigungu = tokens[1];
  if (sigungu && /(시|군|구)$/.test(sigungu)) {
    return `${sido} ${sigungu}`;
  }
  return sido;
}

export function parseBusinessLicenseText(text: string): BusinessLicenseFields {
  const normalized = normalizeText(text);
  const industry = parseIndustry(normalized);

  return {
    bizNo: parseBizNo(normalized),
    name: parseName(normalized),
    ceoName: parseCeoName(normalized),
    foundedDate: parseFoundedDate(normalized),
    industry: industry.industry,
    businessCondition: industry.businessCondition,
    region: parseRegion(normalized),
  };
}

export function businessLicenseFieldsSummary(
  fields: BusinessLicenseFields,
): string {
  const summary = [
    fields.bizNo ? `사업자등록번호 ${fields.bizNo}` : null,
    fields.name ? `기업명 ${fields.name}` : null,
    fields.ceoName ? `대표자 ${fields.ceoName}` : null,
    fields.foundedDate ? `설립일 ${fields.foundedDate}` : null,
    fields.businessCondition ? `업태 ${fields.businessCondition}` : null,
    fields.industry ? `업종 ${fields.industry}` : null,
    fields.region ? `지역 ${fields.region}` : null,
  ].filter(Boolean);

  return summary.length > 0 ? summary.join(", ") : "자동 입력 항목 없음";
}

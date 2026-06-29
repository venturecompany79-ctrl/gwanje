import { getDataGoKrApiKey } from "@/lib/gov-programs/config";
import {
  buildUrl,
  combineText,
  fetchItems,
  firstString,
  inferSupportField,
  parseDateRange,
  splitTags,
  type JsonRecord,
} from "@/lib/gov-programs/http";
import {
  makeContentKey,
  type NormalizedProgram,
  type SourceAdapter,
} from "@/lib/gov-programs/types";

function normalize(row: JsonRecord, index: number): NormalizedProgram | null {
  // TODO: verify field names after data.go.kr 15125364 utilization approval.
  const title = firstString(row, [
    "bizPbancNm",
    "pbancNm",
    "intgPbancNm",
    "사업명",
    "title",
  ]);
  if (!title) return null;

  const externalId =
    firstString(row, ["bizPbancSn", "pbancSn", "id", "공고번호"]) ??
    `kstartup-${index}`;
  const period = firstString(row, [
    "pbancRcptBgngEndDt",
    "receptPeriod",
    "모집기간",
    "reqstBeginEndDe",
  ]);
  const { start, end } = parseDateRange(period);
  const targetText = combineText(
    firstString(row, ["aplyTrgt", "bizTrgt", "지원대상"]),
    firstString(row, ["bizCn", "bizSmryCn", "사업개요"]),
    firstString(row, ["aplyMthd", "신청방법"]),
    firstString(row, ["sprtCn", "지원내용"]),
  );
  const businessType = firstString(row, ["bizType", "sprtBizType", "사업유형"]);
  const program: NormalizedProgram = {
    source: "kstartup",
    externalId,
    contentKey: "",
    title,
    supportField: inferSupportField(businessType, title, targetText),
    orgName: firstString(row, ["pbancNtrpNm", "sprvInst", "문의처", "orgName"]),
    targetText,
    hashtags: splitTags(combineText(businessType, firstString(row, ["hashtags", "kwrd"]))),
    region: firstString(row, ["areaNm", "지역"]),
    applyStart: start,
    applyEnd: end,
    detailUrl: firstString(row, ["dtlUrl", "url", "공고상세URL"]),
    raw: row,
  };
  return { ...program, contentKey: makeContentKey(program) };
}

export const kstartupAdapter: SourceAdapter = {
  code: "kstartup",
  async fetch() {
    const key = getDataGoKrApiKey();
    if (!key) return [];

    const url = buildUrl(
      "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01",
      {
        pageNo: 1,
        numOfRows: 100,
        type: "json",
      },
      { serviceKey: key },
    );
    return (await fetchItems(url))
      .map((row, index) => normalize(row, index))
      .filter((program): program is NormalizedProgram => program !== null);
  },
};

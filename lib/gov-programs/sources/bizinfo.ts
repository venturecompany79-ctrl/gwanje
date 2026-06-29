import { getBizinfoApiKey } from "@/lib/gov-programs/config";
import {
  buildUrl,
  combineText,
  extractItems,
  fetchJson,
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
  // TODO: verify field names with issued BIZINFO_API_KEY response before production rollout.
  const item = row;
  const externalId =
    firstString(item, ["pblancId", "pblanc_id", "id", "seq", "PBLANC_ID"]) ??
    `bizinfo-${index}`;
  const title = firstString(item, ["pblancNm", "pblanc_nm", "title", "PBLANC_NM"]);
  if (!title) return null;

  const orgName = firstString(item, [
    "jrsdInsttNm",
    "jrsd_instt_nm",
    "orgName",
    "author",
    "ORG_NM",
  ]);
  const supportFieldText = firstString(item, [
    "pldirSportRealmLclasCodeNm",
    "supportField",
    "lcategory",
    "지원분야",
  ]);
  const targetText = combineText(
    firstString(item, ["trgetNm", "target", "지원대상"]),
    firstString(item, ["bsnsSumryCn", "summary", "description", "사업개요"]),
    firstString(item, ["reqstMthPapersCn", "신청방법"]),
  );
  const period = firstString(item, [
    "reqstBeginEndDe",
    "reqst_begin_end_de",
    "reqstDt",
    "period",
    "신청기간",
  ]);
  const { start, end } = parseDateRange(period);
  const hashtags = splitTags(
    firstString(item, ["hashtags", "hashTags", "hashtagsNm", "kwrdArray"]),
  );
  const program: NormalizedProgram = {
    source: "bizinfo",
    externalId,
    contentKey: "",
    title,
    supportField: inferSupportField(supportFieldText, title, targetText),
    orgName,
    targetText,
    hashtags,
    region: firstString(item, ["areaNm", "region", "지역"]),
    applyStart: start,
    applyEnd: end,
    detailUrl: firstString(item, ["pblancUrl", "url", "link", "detailUrl"]),
    raw: row,
  };
  return { ...program, contentKey: makeContentKey(program) };
}

export const bizinfoAdapter: SourceAdapter = {
  code: "bizinfo",
  async fetch() {
    const key = getBizinfoApiKey();
    if (!key) return [];

    const url = buildUrl("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do", {
      crtfcKey: key,
      dataType: "json",
      pageUnit: 100,
      pageIndex: 1,
    });
    const payload = await fetchJson(url);
    return extractItems(payload)
      .map((row, index) => normalize(row, index))
      .filter((program): program is NormalizedProgram => program !== null);
  },
};

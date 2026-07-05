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

const PAGE_UNIT = 100;
const MAX_PAGES = 5;

function normalize(row: JsonRecord): NormalizedProgram | null {
  // TODO: verify field names with issued BIZINFO_API_KEY response before production rollout.
  const item = row;
  const rawId = firstString(item, [
    "pblancId",
    "pblanc_id",
    "id",
    "seq",
    "PBLANC_ID",
  ]);
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
  // ID 필드가 없으면 내용 해시 기반 키를 external_id로 사용한다.
  // (위치 인덱스 기반 키는 목록 순서가 바뀌면 다른 공고 행을 덮어써 데이터를 오염시킴)
  const contentKey = makeContentKey({ title, orgName, applyEnd: end });
  const program: NormalizedProgram = {
    source: "bizinfo",
    externalId: rawId ?? `bizinfo:${contentKey}`,
    contentKey,
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
  return program;
}

export const bizinfoAdapter: SourceAdapter = {
  code: "bizinfo",
  async fetch() {
    const key = getBizinfoApiKey();
    if (!key) return [];

    const programs: NormalizedProgram[] = [];
    for (let pageIndex = 1; pageIndex <= MAX_PAGES; pageIndex += 1) {
      const url = buildUrl("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do", {
        crtfcKey: key,
        dataType: "json",
        pageUnit: PAGE_UNIT,
        pageIndex,
      });
      const payload = await fetchJson(url);
      const rows = extractItems(payload);
      programs.push(
        ...rows
          .map((row) => normalize(row))
          .filter((program): program is NormalizedProgram => program !== null),
      );
      if (rows.length < PAGE_UNIT) break;
    }
    return programs;
  },
};

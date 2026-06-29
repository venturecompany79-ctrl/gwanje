import { getDataGoKrApiKey } from "@/lib/gov-programs/config";
import {
  buildUrl,
  combineText,
  fetchItems,
  firstString,
  inferSupportField,
  parseDate,
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
  // TODO: verify field names after data.go.kr 15113297 utilization approval.
  const title = firstString(row, [
    "pblancNm",
    "ancmNm",
    "title",
    "nttSj",
    "사업명",
    "제목",
  ]);
  if (!title) return null;

  const externalId =
    firstString(row, ["pblancId", "ancmId", "nttId", "id", "공고번호"]) ??
    `smes-${index}`;
  const period = firstString(row, ["reqstBeginEndDe", "aplyPd", "신청기간"]);
  const range = parseDateRange(period);
  const targetText = combineText(
    firstString(row, ["trgetNm", "지원대상"]),
    firstString(row, ["bsnsSumryCn", "summary", "사업개요"]),
    firstString(row, ["cn", "content", "내용"]),
  );
  const supportFieldText = firstString(row, ["pldirSportRealmLclasCodeNm", "지원분야", "bizType"]);
  const postedDate = parseDate(firstString(row, ["creatPnttm", "regDt", "등록일"]));
  const program: NormalizedProgram = {
    source: "smes",
    externalId,
    contentKey: "",
    title,
    supportField: inferSupportField(supportFieldText, title, targetText),
    orgName: firstString(row, ["jrsdInsttNm", "organNm", "작성자", "orgName"]),
    targetText,
    hashtags: splitTags(combineText(supportFieldText, firstString(row, ["hashtags", "kwrd"]))),
    region: firstString(row, ["areaNm", "지역"]),
    applyStart: range.start ?? postedDate,
    applyEnd: range.end,
    detailUrl: firstString(row, ["pblancUrl", "dtlUrl", "fileUrl", "url"]),
    raw: row,
  };
  return { ...program, contentKey: makeContentKey(program) };
}

export const smesAdapter: SourceAdapter = {
  code: "smes",
  async fetch() {
    const key = getDataGoKrApiKey();
    if (!key) return [];

    const url = buildUrl(
      "https://apis.data.go.kr/1421000/mssBizService_v2/getMSSBizList_V2",
      {
        pageNo: 1,
        numOfRows: 100,
      },
      { serviceKey: key },
    );
    return (await fetchItems(url))
      .map((row, index) => normalize(row, index))
      .filter((program): program is NormalizedProgram => program !== null);
  },
};

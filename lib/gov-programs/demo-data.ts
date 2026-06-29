import type { GovProgramRow } from "@/lib/gov-programs/types";

function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function program(
  n: number,
  source: GovProgramRow["source"],
  title: string,
  supportField: string,
  orgName: string,
  targetText: string,
  hashtags: string[],
  daysLeft: number,
): GovProgramRow {
  return {
    id: `00000000-0000-0000-0000-00000000a0${String(n).padStart(2, "0")}`,
    source,
    external_id: `demo-${source}-${n}`,
    content_key: `demo-${source}-${n}`,
    title,
    support_field: supportField,
    org_name: orgName,
    target_text: targetText,
    hashtags,
    region: "전국",
    apply_start: dateAfter(-14),
    apply_end: dateAfter(daysLeft),
    detail_url: "https://www.bizinfo.go.kr/",
    raw: null,
    synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    search_vector: null,
  };
}

export function demoGovPrograms(): GovProgramRow[] {
  return [
    program(
      1,
      "bizinfo",
      "스마트공장 제조혁신 R&D 지원사업",
      "기술",
      "중소벤처기업부",
      "제조업 중소기업의 스마트공장 구축, 연구개발, 디지털 전환을 지원합니다.",
      ["제조업", "R&D", "스마트공장"],
      9,
    ),
    program(
      2,
      "kstartup",
      "초기창업 패키지 사업화 자금",
      "창업",
      "창업진흥원",
      "창업 3년 이내 초기기업의 사업화 자금과 멘토링을 지원합니다.",
      ["창업", "초기기업", "사업화"],
      21,
    ),
    program(
      3,
      "smes",
      "중소기업 정책자금 융자계획",
      "금융",
      "중소벤처기업진흥공단",
      "제조업 및 성장기 중소기업 대상 운전자금, 시설자금 융자를 지원합니다.",
      ["정책자금", "제조업", "성장기"],
      36,
    ),
    program(
      4,
      "msit",
      "ICT R&D 혁신 바우처 지원",
      "기술",
      "과학기술정보통신부",
      "AI, ICT, 연구개발 수요가 있는 중소기업을 대상으로 기술개발 바우처를 지원합니다.",
      ["ICT", "R&D", "AI"],
      5,
    ),
    program(
      5,
      "bizinfo",
      "수출바우처 참여기업 모집",
      "수출",
      "대한무역투자진흥공사",
      "해외 판로 개척과 글로벌 마케팅을 준비하는 중소기업 지원사업입니다.",
      ["수출", "마케팅", "판로"],
      48,
    ),
  ];
}

import type { BriefingView } from "./types";

export const BRIEFING_PREVIEW: BriefingView = {
  briefing: {
    id: "preview",
    result: {
      summary: "마감이 가까운 과제를 먼저 확인하고, 제출 자료와 다음 미팅을 준비하세요. Hermes를 연결하면 실제 업무를 바탕으로 오늘의 우선순위와 계획을 정리해 드립니다.",
      priorities: [
        { sourceId: "preview:strategy", reason: "마감이 이틀 남은 업무부터 확인합니다.", nextAction: "진행 상태를 확인하고 남은 작업을 정리하세요." },
        { sourceId: "preview:documents", reason: "제출 전 검토가 필요한 업무입니다.", nextAction: "필요 서류와 제출 준비 상태를 확인하세요." },
        { sourceId: "preview:meeting", reason: "이번 주 미팅을 미리 준비합니다.", nextAction: "논의할 안건과 확인할 질문을 정리하세요." },
      ],
      plan: ["마감이 가까운 과제의 진행 상태 확인", "제출 자료 준비 및 검토", "고객사 미팅 안건 정리"],
      changes: ["연동 후 이전 점검 대비 완료·추가·기한 변경 내역이 표시됩니다."],
      sources: [
        { id: "preview:strategy", title: "SNS 콘텐츠 자동화 전략 수립", daysLeft: 2 },
        { id: "preview:documents", title: "정책자금 제출 자료 준비", daysLeft: 3 },
        { id: "preview:meeting", title: "고객사 미팅 준비", daysLeft: 5 },
      ].map((source) => ({ ...source, companyId: null, companyName: "예시 기업", href: "", dueDate: null, completed: false, responsibility: "direct" as const, memo: "", version: "preview" })),
      dataAsOf: "",
      generatedAt: "",
    },
  },
  checkedAt: null,
  nextAt: null,
  job: null,
  stale: false,
};

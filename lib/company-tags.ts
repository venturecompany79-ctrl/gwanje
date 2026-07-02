const GROWTH_STAGE_CANON: Record<string, string> = {
  얼라스테이징: "초기",
  창업기: "초기",
  초창기: "초기",
  초기단계: "초기",
  성장단계: "성장기",
  성숙단계: "성숙기",
  성숙: "성숙기",
};

export function normalizeGrowthStageTag(tag: string): string {
  return GROWTH_STAGE_CANON[tag] ?? tag;
}

export function normalizeConditionTags(tagsText: string | null): string[] {
  return [
    ...new Set(
      (tagsText ?? "")
        .split(",")
        .map((tag) => normalizeGrowthStageTag(tag.trim()))
        .filter(Boolean),
    ),
  ];
}

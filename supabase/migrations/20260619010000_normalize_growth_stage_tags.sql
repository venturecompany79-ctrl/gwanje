-- =============================================================
-- GWJ-010: 성장 단계 condition_tags 표기 통일 (1회 데이터 정규화)
-- 운영 데이터에 '얼라스테이징'(오타)·'창업기' 등 변형 라벨이 섞여 '초기'와 중복됐다.
-- 변형 라벨을 표준값(초기/성장기/성숙기)으로 매핑하고 중복을 제거한다.
-- 앱 신규 입력은 성장 단계 select + normalizeGrowthStageTag로 이미 표준화됨.
-- 멱등: 표준값은 매핑 대상이 아니므로 재실행해도 변화 없음.
-- =============================================================

update company c
set condition_tags = sub.tags
from (
  select
    id,
    array_agg(distinct
      case t
        when '얼라스테이징' then '초기'
        when '창업기'       then '초기'
        when '초창기'       then '초기'
        when '초기단계'     then '초기'
        when '성장단계'     then '성장기'
        when '성숙단계'     then '성숙기'
        when '성숙'         then '성숙기'
        else t
      end
    ) as tags
  from company, unnest(condition_tags) as t
  group by id
) as sub
where c.id = sub.id
  and c.condition_tags && array[
    '얼라스테이징','창업기','초창기','초기단계','성장단계','성숙단계','성숙'
  ];

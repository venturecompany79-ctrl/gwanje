-- 기업 기본정보 보강: 지역명(소재지 기반) + 업태(사업자등록증)
-- industry(대표 업종/종목)와 별도 컬럼으로 분리해 지원사업 지역 필터·업태 분류에 활용한다.
alter table company
  add column if not exists region text,
  add column if not exists business_condition text;

comment on column company.region is '지역명 — 사업장 소재지(시/도 + 시/군/구) 기반';
comment on column company.business_condition is '업태 — 사업자등록증 업태 항목 (industry는 종목/대표 업종)';

-- =============================================================
-- 「관제」 데모 시드 데이터
-- 사전 조건: schema.sql 적용 + Supabase Auth에 사용자 1명 생성(본인 계정)
-- 동작: 첫 번째 auth 사용자를 컨설턴트로 하여 워크스페이스/데모 데이터 생성
-- =============================================================

do $$
declare
  v_user_id   uuid;
  v_tenant_id uuid;
  v_cat_gov   uuid; v_cat_vc uuid; v_cat_lab uuid; v_cat_tax uuid; v_cat_fund uuid;
  v_co1 uuid; v_co2 uuid; v_co3 uuid; v_co4 uuid; v_co5 uuid; v_co6 uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'auth.users에 사용자가 없습니다. Supabase Auth에서 계정을 먼저 만들어 주세요.';
  end if;

  insert into tenant (name) values ('Growth Partners') returning id into v_tenant_id;

  insert into profile (id, tenant_id, name, title, email, sender_name)
  values (v_user_id, v_tenant_id, '김컨설턴트', '경영컨설턴트',
          (select email from auth.users where id = v_user_id), '관제 컨설팅')
  on conflict (id) do update set tenant_id = excluded.tenant_id;

  -- 분류 5종
  insert into category (tenant_id, name, sort_order) values
    (v_tenant_id, '정부지원사업', 1) returning id into v_cat_gov;
  insert into category (tenant_id, name, sort_order) values
    (v_tenant_id, '벤처기업확인', 2) returning id into v_cat_vc;
  insert into category (tenant_id, name, sort_order) values
    (v_tenant_id, '기업부설연구소', 3) returning id into v_cat_lab;
  insert into category (tenant_id, name, sort_order) values
    (v_tenant_id, '세액공제', 4) returning id into v_cat_tax;
  insert into category (tenant_id, name, sort_order) values
    (v_tenant_id, '정책자금', 5) returning id into v_cat_fund;

  -- 고객사
  insert into company (tenant_id, name, industry, founded_date, revenue, headcount, ceo_name, condition_tags) values
    (v_tenant_id, '(주)테크노바',     'IT·소프트웨어', '2019-03-12',  4200000000, 28, '박지훈', '{성장기}') returning id into v_co1;
  insert into company (tenant_id, name, industry, founded_date, revenue, headcount, ceo_name, condition_tags) values
    (v_tenant_id, '한빛정밀',         '정밀기계 제조', '2012-07-01', 18500000000, 64, '이정민', '{성숙기}') returning id into v_co2;
  insert into company (tenant_id, name, industry, founded_date, revenue, headcount, ceo_name, condition_tags) values
    (v_tenant_id, '그린에너지솔루션', '신재생에너지',  '2017-11-20',  7800000000, 35, '최수연', '{성장기}') returning id into v_co3;
  insert into company (tenant_id, name, industry, founded_date, revenue, headcount, ceo_name, condition_tags) values
    (v_tenant_id, '메디케어랩',       '바이오·헬스케어','2020-05-08',  2100000000, 17, '정우성', '{초기}') returning id into v_co4;
  insert into company (tenant_id, name, industry, founded_date, revenue, headcount, ceo_name, condition_tags) values
    (v_tenant_id, '스마트팩토리(주)', '스마트제조',    '2015-01-15', 12300000000, 52, '김도현', '{성숙기}') returning id into v_co5;
  insert into company (tenant_id, name, industry, founded_date, revenue, headcount, ceo_name, condition_tags) values
    (v_tenant_id, '블루오션테크',     '해양플랜트',    '2018-09-03',  5600000000, 31, '한지원', '{성장기}') returning id into v_co6;

  -- 자격·인증 (만료일 = 오늘 기준 상대값)
  insert into credential (tenant_id, company_id, type, category_id, issued_date, expires_date, renew_lead_days) values
    (v_tenant_id, v_co1, '벤처기업확인',   v_cat_vc,  current_date - interval '3 years',  current_date + 2,   30),
    (v_tenant_id, v_co3, '기업부설연구소', v_cat_lab, current_date - interval '2 years',  current_date + 7,   60),
    (v_tenant_id, v_co5, '이노비즈 인증',  v_cat_gov, current_date - interval '30 months', current_date + 14,  60),
    (v_tenant_id, v_co2, 'ISO 9001',       v_cat_gov, current_date - interval '1 year',   current_date + 240, 60),
    (v_tenant_id, v_co4, '벤처기업확인',   v_cat_vc,  current_date - interval '40 months', current_date - 12,  30);

  -- 관리포인트(과제)
  insert into task (tenant_id, company_id, title, category_id, stage, due_date, assignee_id) values
    (v_tenant_id, v_co2, 'R&D 세액공제 신청',      v_cat_tax,  'application', current_date + 5,  v_user_id),
    (v_tenant_id, v_co4, '정책자금 상환 일정 관리', v_cat_fund, 'application', current_date + 9,  v_user_id),
    (v_tenant_id, v_co5, '이노비즈 인증 갱신',      v_cat_gov,  'diagnosis',   current_date + 14, v_user_id),
    (v_tenant_id, v_co6, '디딤돌 과제 중간보고',    v_cat_gov,  'diagnosis',   current_date + 21, v_user_id),
    (v_tenant_id, v_co3, '기업부설연구소 갱신',     v_cat_lab,  'proposal',    current_date + 7,  v_user_id),
    (v_tenant_id, v_co1, '벤처기업확인 갱신',       v_cat_vc,   'result',      current_date + 2,  v_user_id);

  -- 일정
  insert into schedule (tenant_id, company_id, title, date, type) values
    (v_tenant_id, v_co1, '테크노바 벤처확인 만료',  current_date + 2,  'expiry'),
    (v_tenant_id, v_co2, '세액공제 신청 마감',      current_date + 5,  'deadline'),
    (v_tenant_id, v_co3, '그린에너지 미팅',         current_date + 4,  'meeting');

  -- 자료
  insert into document (tenant_id, company_id, name, doc_category, uploaded_by, file_type, size_bytes) values
    (v_tenant_id, v_co4, '사업자등록증.pdf',     '기본서류', 'client', 'pdf',  182000),
    (v_tenant_id, v_co5, '재무제표_2025.xlsx',   '재무',     'client', 'xlsx', 96000);

  -- 알림
  insert into notification (tenant_id, type, title, body, company_id, ref_table, is_urgent, is_read) values
    (v_tenant_id, 'expiry',        '테크노바 벤처확인 D-2',        '만료 임박 · 갱신 과제 생성 필요', v_co1, 'credential', true,  false),
    (v_tenant_id, 'deadline',      '한빛정밀 자료 미제출',         '세액공제 증빙 서류 요청 중',      v_co2, 'task',       false, false),
    (v_tenant_id, 'expiry',        '그린에너지솔루션 갱신 D-7',    '기업부설연구소 갱신 마감 주의',   v_co3, 'credential', false, false),
    (v_tenant_id, 'program_match', '스마트공장 고도화 공고 매칭',  '스마트팩토리(주) 조건 부합',      v_co5, 'rule',       false, true);
end $$;

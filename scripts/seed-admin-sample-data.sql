-- =============================================================
-- 베타 계정 admin@gwanje.com 샘플 데이터 시드
-- 다수의 고객사가 "랜덤하게" 다양한 정보로 보이도록 채운다.
--   - 고객사 15곳: 업종·지역·업태·매출·인원·설립일·성장단계·연락처 모두 다양
--   - 자격/인증, 관리포인트(과제), 일정, 자료, 알림은 회사들에 무작위로 분산
--   - 만료/마감일은 current_date 기준 상대값 → 대시보드 D-day가 항상 자연스러움
--
-- 실행: Supabase 대시보드(gwanje) → SQL Editor 에 붙여넣고 Run.
--   (앱 service_role 키가 .env.local에 없고 CLI DB 비번도 옛 프로젝트라 코드/CLI로는 못 넣음 → SQL Editor가 정석)
-- 단일 트랜잭션 — 실패 시 전체 rollback.
-- 멱등 가드: 이미 고객사가 10곳 이상이면 중복 방지를 위해 중단.
--   다시 깨끗이 시드하려면 먼저 scripts/beta-reset.sql 실행 후 이 스크립트 실행.
-- =============================================================

begin;

do $seed$
declare
  v_email     text := 'admin@gwanje.com';
  v_user_id   uuid;
  v_tenant_id uuid;
  v_cat_gov uuid; v_cat_vc uuid; v_cat_lab uuid; v_cat_tax uuid; v_cat_fund uuid;
  v_companies int;
begin
  -- 0) 대상 유저/테넌트 확인
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception '계정 % 없음 — 대시보드 Authentication 에서 먼저 생성하세요.', v_email;
  end if;

  select tenant_id into v_tenant_id from profile where id = v_user_id;
  if v_tenant_id is null then
    raise exception '프로필/워크스페이스 없음 — 먼저 프로비저닝(profile+tenant)이 필요합니다 (user=%).', v_user_id;
  end if;

  -- 1) 멱등 가드
  select count(*) into v_companies from company where tenant_id = v_tenant_id;
  if v_companies >= 10 then
    raise exception '이미 고객사 %곳 존재 — 중복 시드 방지를 위해 중단. 초기화하려면 beta-reset.sql 먼저 실행.', v_companies;
  end if;

  raise notice '샘플 시드 시작 — user=% tenant=% (기존 고객사 %곳)', v_user_id, v_tenant_id, v_companies;

  -- 2) 분류 5종 (이름 기준 멱등 — 이미 있으면 재사용)
  insert into category (tenant_id, name, sort_order)
  select v_tenant_id, x.name, x.ord
  from (values ('정부지원사업',1),('벤처기업확인',2),('기업부설연구소',3),('세액공제',4),('정책자금',5)) as x(name, ord)
  where not exists (select 1 from category c where c.tenant_id = v_tenant_id and c.name = x.name);

  select id into v_cat_gov  from category where tenant_id = v_tenant_id and name = '정부지원사업';
  select id into v_cat_vc   from category where tenant_id = v_tenant_id and name = '벤처기업확인';
  select id into v_cat_lab  from category where tenant_id = v_tenant_id and name = '기업부설연구소';
  select id into v_cat_tax  from category where tenant_id = v_tenant_id and name = '세액공제';
  select id into v_cat_fund from category where tenant_id = v_tenant_id and name = '정책자금';

  -- 3) 고객사 15곳 — 다양한 업종/지역/업태/규모/성장단계/연락처
  insert into company
    (tenant_id, name, biz_no, industry, business_condition, region,
     founded_date, revenue, headcount, ceo_name, contact_name, contact_phone, contact_email,
     condition_tags, memo)
  values
    (v_tenant_id, '(주)테크노바',       '128-81-45213', 'IT·소프트웨어',   '정보통신업',          '서울특별시 강남구',
       '2019-03-12',  4200000000, 28, '박지훈', '김서연', '010-2841-5530', 'contact@technova.co.kr', '{성장기}',        'SaaS 솔루션 개발. R&D 세액공제 관심.'),
    (v_tenant_id, '한빛정밀(주)',       '214-87-11902', '정밀기계 제조',   '제조업',              '경기도 안산시 단원구',
       '2012-07-01', 18500000000, 64, '이정민', '오현우', '031-495-2210', 'admin@hanbit-pre.com',   '{성숙기}',        '자동차 부품 정밀가공. 이노비즈 보유.'),
    (v_tenant_id, '그린에너지솔루션',   '371-86-00457', '신재생에너지',    '전기·가스업',         '전라남도 나주시',
       '2017-11-20',  7800000000, 35, '최수연', '배진호', '061-330-7788', 'biz@greenenergy.kr',     '{성장기}',        '태양광 EPC. 정책자금 융자 진행 중.'),
    (v_tenant_id, '메디케어랩',         '110-81-93312', '바이오·헬스케어', '전문과학기술서비스업','대전광역시 유성구',
       '2020-05-08',  2100000000, 17, '정우성', '신아름', '042-862-1190', 'info@medicarelab.io',    '{초기}',          '진단키트 R&D. 기업부설연구소 설립 검토.'),
    (v_tenant_id, '스마트팩토리(주)',   '506-81-77240', '스마트제조',      '제조업',              '경상북도 구미시',
       '2015-01-15', 12300000000, 52, '김도현', '문태경', '054-712-3340', 'sales@smartfactory.com', '{성숙기}',        '스마트공장 고도화 사업 매칭 대상.'),
    (v_tenant_id, '블루오션테크',       '617-86-30021', '해양플랜트',      '제조업',              '부산광역시 강서구',
       '2018-09-03',  5600000000, 31, '한지원', '윤성민', '051-973-4420', 'contact@blueocean.co.kr','{성장기}',        '조선 기자재. 수출바우처 관심.'),
    (v_tenant_id, '나래에이아이(주)',   '220-88-51174', '인공지능',        '정보통신업',          '서울특별시 마포구',
       '2021-02-18',   980000000, 12, '서지안', '권나리', '010-7720-3318', 'hello@narae-ai.com',     '{초기}',          'AI 모델 스타트업. 벤처기업확인 신규 준비.'),
    (v_tenant_id, '대성식품(주)',       '135-81-26609', '식품 제조',       '제조업',              '충청남도 천안시 서북구',
       '2008-06-25', 24700000000, 88, '임경복', '조미경', '041-558-9010', 'mgmt@daesungfood.kr',    '{성숙기}',        'HACCP 인증 식품. 가족기업 승계 컨설팅.'),
    (v_tenant_id, '코어로보틱스',       '463-87-00813', '로봇·자동화',     '제조업',              '인천광역시 연수구',
       '2016-10-30',  9100000000, 41, '백승호', '하예린', '032-720-5567', 'biz@corerobotics.io',    '{성장기}',        '협동로봇 모듈. 메인비즈 보유.'),
    (v_tenant_id, '한울바이오팜',       '312-81-64428', '제약·바이오',     '제조업',              '강원특별자치도 춘천시',
       '2014-04-09', 15600000000, 57, '노유진', '강민재', '033-264-1180', 'contact@hanulbio.com',   '{성숙기}',        '천연물 신약. 연구소 인력 세액공제.'),
    (v_tenant_id, '플라이트랩스(주)',   '744-88-19035', '드론·항공',       '전문과학기술서비스업','대구광역시 동구',
       '2019-08-14',  3300000000, 23, '문하늘', '엄지호', '053-981-6640', 'fly@flightlabs.kr',      '{성장기}',        '산업용 드론. 정부 실증사업 참여.'),
    (v_tenant_id, '온누리커머스',       '129-86-72510', '이커머스·유통',   '도매및소매업',        '서울특별시 송파구',
       '2017-03-27',  6700000000, 26, '구본창', '남보라', '010-3360-7741', 'help@onnuri.shop',       '{성장기}',        '온라인 셀러 플랫폼. 정책자금 운전자금 관심.'),
    (v_tenant_id, '세진건설(주)',       '208-81-40337', '건설·엔지니어링', '건설업',              '경기도 화성시',
       '2006-12-11', 31200000000,112, '황대근', '천유미', '031-227-8890', 'office@sejin-con.co.kr', '{성숙기}',        '토목/플랜트 시공. 신용보증 갱신 예정.'),
    (v_tenant_id, '루미넥스(주)',       '880-87-22146', '디스플레이 소재', '제조업',              '충청북도 청주시 흥덕구',
       '2013-09-22', 20400000000, 73, '편성주', '도경수', '043-261-3370', 'sales@luminex.co.kr',    '{성숙기}',        '광학필름 소재. 소부장 으뜸기업 추진.'),
    (v_tenant_id, '데이터브릿지',       '551-88-03967', '데이터·플랫폼',   '정보통신업',          '광주광역시 광산구',
       '2022-01-05',   540000000,  9, '진소율', '명재현', '062-940-2280', 'team@databridge.kr',     '{초기}',          '데이터 라벨링 플랫폼. 청년창업 지원 대상.');

  -- 4) 자격·인증 — 회사들의 80% 정도에 무작위로 1건씩 (만료일 다양: 만료/임박/유효 혼재)
  insert into credential
    (tenant_id, company_id, type, category_id, issued_date, expires_date, renew_lead_days)
  select
    v_tenant_id,
    c.id,
    t.type,
    case t.type
      when '벤처기업확인'   then v_cat_vc
      when '기업부설연구소' then v_cat_lab
      when '연구개발전담부서' then v_cat_lab
      when 'R&D 세액공제'   then v_cat_tax
      else v_cat_gov
    end,
    current_date - ((360 + floor(random() * 900))::int || ' days')::interval,
    current_date + (array[-25, -8, 3, 9, 16, 35, 90, 180, 320, 540])[1 + floor(random() * 10)::int],
    (array[30, 60, 90])[1 + floor(random() * 3)::int]
  from company c
  cross join lateral (
    select (array['벤처기업확인','이노비즈 인증','메인비즈','기업부설연구소','연구개발전담부서','ISO 9001','ISO 14001','R&D 세액공제'])[1 + floor(random() * 8)::int] as type
  ) t
  where c.tenant_id = v_tenant_id
    and random() < 0.8;

  -- 일부 회사엔 두 번째 자격 추가 (다양성)
  insert into credential
    (tenant_id, company_id, type, category_id, issued_date, expires_date, renew_lead_days)
  select
    v_tenant_id, c.id, t.type, v_cat_gov,
    current_date - ((300 + floor(random() * 700))::int || ' days')::interval,
    current_date + (array[-12, 5, 21, 60, 150, 400])[1 + floor(random() * 6)::int],
    60
  from company c
  cross join lateral (
    select (array['이노비즈 인증','메인비즈','ISO 9001','직무발명보상 우수기업'])[1 + floor(random() * 4)::int] as type
  ) t
  where c.tenant_id = v_tenant_id
    and random() < 0.35;

  -- 5) 관리포인트(과제) — 회사들에 무작위로 분산, 단계/마감일 다양
  insert into task
    (tenant_id, company_id, title, category_id, stage, due_date, assignee_id)
  select
    v_tenant_id,
    c.id,
    t.title,
    (array[v_cat_gov, v_cat_vc, v_cat_lab, v_cat_tax, v_cat_fund])[1 + floor(random() * 5)::int],
    (array['diagnosis','proposal','application','result'])[1 + floor(random() * 4)::int]::task_stage,
    current_date + (array[3, 6, 10, 14, 21, 30, 45])[1 + floor(random() * 7)::int],
    v_user_id
  from company c
  cross join lateral (
    select (array[
      'R&D 세액공제 신청','정책자금 상환 일정 관리','이노비즈 인증 갱신',
      '기업부설연구소 갱신','벤처기업확인 갱신','수출바우처 신청',
      '스마트공장 지원사업 신청','중간보고서 제출','자금조달 컨설팅'
    ])[1 + floor(random() * 9)::int] as title
  ) t
  where c.tenant_id = v_tenant_id
    and random() < 0.7;

  -- 6) 일정 — 만료/마감/미팅 몇 건
  insert into schedule (tenant_id, company_id, title, date, type)
  select
    v_tenant_id, c.id,
    c.name || ' ' || s.label,
    current_date + (array[1, 2, 4, 7, 11, 18, 26])[1 + floor(random() * 7)::int],
    s.type
  from company c
  cross join lateral (
    select * from (values
      ('자격 만료 점검','expiry'::schedule_type),
      ('지원사업 마감','deadline'::schedule_type),
      ('정기 미팅','meeting'::schedule_type),
      ('갱신 서류 준비','renewal'::schedule_type)
    ) as v(label, type)
    order by random() limit 1
  ) s
  where c.tenant_id = v_tenant_id
    and random() < 0.4;

  -- 7) 자료 — 몇몇 회사 기본 서류
  insert into document (tenant_id, company_id, name, doc_category, uploaded_by, file_type, size_bytes)
  select
    v_tenant_id, c.id, d.name, d.cat, 'client'::document_uploader, d.ftype,
    (80000 + floor(random() * 400000))::bigint
  from company c
  cross join lateral (
    select * from (values
      ('사업자등록증.pdf','기본서류','pdf'),
      ('재무제표_2025.xlsx','재무','xlsx'),
      ('4대보험 가입자명부.pdf','인사','pdf'),
      ('정관.pdf','법인','pdf')
    ) as v(name, cat, ftype)
    order by random() limit 1
  ) d
  where c.tenant_id = v_tenant_id
    and random() < 0.5;

  -- 8) 알림 — 만료 임박/마감/공고매칭 몇 건 (미읽음 위주)
  insert into notification (tenant_id, type, title, body, company_id, ref_table, is_urgent, is_read)
  select
    v_tenant_id,
    n.type,
    c.name || ' ' || n.title,
    n.body,
    c.id,
    n.ref_table,
    n.is_urgent,
    (random() < 0.25)
  from company c
  cross join lateral (
    select * from (values
      ('expiry'::notification_type,   '자격 만료 임박', '갱신 과제 생성이 필요합니다.', 'credential', true),
      ('deadline'::notification_type, '지원사업 마감 임박', '신청 서류를 준비하세요.', 'task', false),
      ('program_match'::notification_type, '신규 공고 매칭', '조건에 부합하는 공고가 있습니다.', 'gov_program', false)
    ) as v(type, title, body, ref_table, is_urgent)
    order by random() limit 1
  ) n
  where c.tenant_id = v_tenant_id
    and random() < 0.5;

  raise notice '샘플 시드 완료 — tenant=% / 고객사 15곳 + 자격·과제·일정·자료·알림 분산 생성', v_tenant_id;
end
$seed$;

-- 사후 요약 (트랜잭션 내 — 커밋 전 확인용)
select
  (select count(*) from company      where tenant_id = (select tenant_id from profile p join auth.users u on u.id = p.id where lower(u.email)='admin@gwanje.com')) as companies,
  (select count(*) from credential   where tenant_id = (select tenant_id from profile p join auth.users u on u.id = p.id where lower(u.email)='admin@gwanje.com')) as credentials,
  (select count(*) from task         where tenant_id = (select tenant_id from profile p join auth.users u on u.id = p.id where lower(u.email)='admin@gwanje.com')) as tasks,
  (select count(*) from schedule     where tenant_id = (select tenant_id from profile p join auth.users u on u.id = p.id where lower(u.email)='admin@gwanje.com')) as schedules,
  (select count(*) from notification where tenant_id = (select tenant_id from profile p join auth.users u on u.id = p.id where lower(u.email)='admin@gwanje.com')) as notifications;

commit;

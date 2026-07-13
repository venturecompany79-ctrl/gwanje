// 임포트 검증 로직 스모크 테스트 — lib/import/validate.ts를 tsc로 일회 컴파일해 실행
// 사용: npm run smoke:import
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// 프로젝트 내부에 임시 컴파일 — xlsx 등 node_modules 의존성이 상향 탐색으로 resolve 되도록
const outDir = mkdtempSync(path.join(process.cwd(), ".import-smoke-"));
try {
  execSync(
    `npx tsc lib/import/validate.ts lib/import/parse-template.ts --rootDir . --outDir "${outDir}" ` +
      "--module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck",
    { stdio: "inherit" },
  );

  const require = createRequire(import.meta.url);
  const {
    normalizeCompanyName,
    formatBizNo,
    validateDraftRows,
  } = require(path.join(outDir, "lib/import/validate.js"));

  const baseRow = (overrides = {}) => ({
    rowId: Math.random().toString(36).slice(2),
    sourceRef: "테스트",
    include: true,
    name: "한빛테크",
    bizNo: null,
    industry: null,
    businessCondition: null,
    foundedDate: null,
    region: null,
    revenueEok: null,
    headcount: null,
    ceoName: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    conditionTags: [],
    memo: null,
    credentials: [],
    errors: [],
    warnings: [],
    duplicateName: null,
    confirmDuplicate: false,
    ...overrides,
  });

  const ctx = {
    existing: [{ name: "기존 기업", bizNo: "111-11-11111" }],
    categories: [{ id: "cat-1", name: "인증" }],
  };

  // 1. 이름 정규화 / 사업자번호 표기
  assert.equal(normalizeCompanyName("(주) 한빛 테크"), "(주)한빛테크");
  assert.equal(formatBizNo("1234567890"), "123-45-67890");
  assert.equal(formatBizNo("12-34"), "12-34"); // 10자리 아니면 원문 유지

  // 2. 기업명 없음 → error + include 강제 해제
  let [row] = validateDraftRows([baseRow({ name: "  " })], ctx);
  assert.equal(row.errors.length > 0, true, "빈 기업명은 error");
  assert.equal(row.include, false);

  // 3. 날짜 형식 오류 → error
  [row] = validateDraftRows([baseRow({ foundedDate: "2024-13-99" })], ctx);
  assert.equal(row.errors.some((m) => m.includes("설립일")), true);

  // 4. 자격 만료일 < 발급일 → error, 분류 매칭 → categoryId
  [row] = validateDraftRows(
    [
      baseRow({
        credentials: [
          {
            type: "ISO 9001",
            categoryName: "인증",
            categoryId: null,
            issuedDate: "2025-01-01",
            expiresDate: "2024-01-01",
            memo: null,
          },
        ],
      }),
    ],
    ctx,
  );
  assert.equal(row.errors.some((m) => m.includes("만료일")), true);
  assert.equal(row.credentials[0].categoryId, "cat-1", "분류명 매칭");

  // 5. 빈 type 자격 드롭 + warning
  [row] = validateDraftRows(
    [
      baseRow({
        credentials: [
          { type: " ", categoryName: null, categoryId: null, issuedDate: null, expiresDate: null, memo: null },
        ],
      }),
    ],
    ctx,
  );
  assert.equal(row.credentials.length, 0);
  assert.equal(row.warnings.length > 0, true);

  // 6. 기존 DB 중복 (상호 정규화 일치)
  [row] = validateDraftRows([baseRow({ name: "기존기업" })], ctx);
  assert.equal(row.duplicateName, "기존 기업");

  // 7. 사업자번호 일치 중복 + 10자리 아님 warning
  [row] = validateDraftRows([baseRow({ name: "다른이름", bizNo: "1111111111" })], ctx);
  assert.equal(row.duplicateName, "기존 기업", "사업자번호 일치 중복");
  [row] = validateDraftRows([baseRow({ bizNo: "123" })], ctx);
  assert.equal(row.warnings.some((m) => m.includes("사업자번호")), true);

  // 8. 파일 내 중복 → 뒤 행 error
  const rows = validateDraftRows(
    [baseRow({ name: "중복상사" }), baseRow({ name: "중복 상사" })],
    ctx,
  );
  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[1].errors.some((m) => m.includes("파일 내")), true);

  // 9. 매출/인원 음수 → error
  [row] = validateDraftRows([baseRow({ revenueEok: -1, headcount: 1.5 })], ctx);
  assert.equal(row.errors.length, 2);

  // ---- 템플릿 파싱 왕복 검증 (엑셀 생성 → 파싱) ----
  const XLSX = require("xlsx");
  const { parseTemplateWorkbook, extractSheetsAsCsv } = require(
    path.join(outDir, "lib/import/parse-template.js"),
  );
  const { templateHeaders, exampleRow } = require(
    path.join(outDir, "lib/import/template.js"),
  );

  const headers = templateHeaders();
  const dataRow = [
    "왕복테스트(주)",
    "9876543210", // 하이픈 없는 사업자번호
    "제조업",
    "금속가공",
    "경기 안산",
    "2020.01.05", // 점 구분 날짜 문자열
    "1,200", // 콤마 포함 매출
    12,
    "김대표",
    "이담당",
    "010-1234-5678",
    "a@b.co",
    "성장기, 수출기업",
    "메모",
    "ISO 9001",
    "인증",
    new Date(2024, 0, 10), // Date 객체 → 엑셀 날짜 셀
    "2027-01-09",
    "", "", "", "", "", "", "", "",
  ];
  const sheet = XLSX.utils.aoa_to_sheet(
    [headers, exampleRow(["인증"]), dataRow, ["", ""]],
    { cellDates: true },
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "기업목록");
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx", cellDates: true });

  const parsed = parseTemplateWorkbook(buffer);
  assert.equal(parsed.length, 1, "예시 행·빈 행 제외, 데이터 1행만 파싱");
  const p = parsed[0];
  assert.equal(p.name, "왕복테스트(주)");
  assert.equal(p.bizNo, "9876543210");
  assert.equal(p.foundedDate, "2020-01-05", "점 구분 날짜 정규화");
  assert.equal(p.revenueEok, 1200, "콤마 매출 숫자 변환");
  assert.equal(p.headcount, 12);
  assert.deepEqual(p.conditionTags, ["성장기", "수출기업"]);
  assert.equal(p.credentials.length, 1);
  assert.equal(p.credentials[0].type, "ISO 9001");
  assert.equal(p.credentials[0].issuedDate, "2024-01-10", "엑셀 날짜 셀 → YYYY-MM-DD");
  assert.equal(p.credentials[0].expiresDate, "2027-01-09");

  // 파싱 결과가 검증도 통과하는지 (categoryId 매칭 포함)
  const [validated] = validateDraftRows(parsed, ctx);
  assert.equal(validated.errors.length, 0);
  assert.equal(validated.bizNo, "987-65-43210", "사업자번호 하이픈 정규화");
  assert.equal(validated.credentials[0].categoryId, "cat-1");

  // AI 경로용 시트 텍스트 추출
  const sheets = extractSheetsAsCsv(buffer);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].name, "기업목록");
  assert.equal(sheets[0].csv.includes("왕복테스트(주)"), true);

  console.log("✅ import validate smoke: 모든 검증 통과 (검증 규칙 + 템플릿 파싱 왕복)");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

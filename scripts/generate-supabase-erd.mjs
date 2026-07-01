import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "supabase-erd-current.svg");

function runQuery(sql) {
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--linked", sql],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 16,
    },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }
  const parsed = JSON.parse(result.stdout);
  return parsed.rows ?? [];
}

const columns = runQuery(`
  select
    c.table_name,
    c.column_name,
    c.ordinal_position,
    case
      when c.data_type = 'USER-DEFINED' then c.udt_name
      when c.data_type = 'ARRAY' then c.udt_name
      when c.data_type = 'character varying' then 'varchar'
      when c.data_type = 'timestamp with time zone' then 'timestamptz'
      when c.data_type = 'timestamp without time zone' then 'timestamp'
      when c.data_type = 'double precision' then 'float8'
      else c.data_type
    end as data_type,
    c.is_nullable,
    t.table_type,
    exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      where tc.table_schema = c.table_schema
        and tc.table_name = c.table_name
        and tc.constraint_type = 'PRIMARY KEY'
        and kcu.column_name = c.column_name
    ) as is_pk
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
  where c.table_schema = 'public'
    and t.table_type in ('BASE TABLE', 'VIEW')
  order by c.table_name, c.ordinal_position;
`);

const fks = runQuery(`
  select
    tc.table_name,
    kcu.column_name,
    ccu.table_name as foreign_table_name,
    ccu.column_name as foreign_column_name,
    tc.constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
  order by tc.table_name, kcu.column_name;
`);

const tableOrder = [
  "tenant",
  "profile",
  "company",
  "category",
  "credential",
  "task",
  "schedule",
  "document",
  "task_file",
  "todo_note",
  "ip_right",
  "ip_deadline",
  "notification",
  "deadline_item",
  "mobile_device",
  "mobile_push_delivery",
  "campaign",
  "campaign_recipient",
  "gov_program",
  "gov_program_sync_log",
  "rule",
  "google_drive_connections",
  "google_drive_sync_jobs",
  "billing_plan",
  "billing_customer",
  "payment_method",
  "tenant_subscription",
  "payment_transaction",
  "webhook_event",
];

const groups = [
  {
    title: "Core Tenant & CRM",
    tables: ["tenant", "profile", "company", "category"],
    fill: "#f8fbff",
  },
  {
    title: "Operations",
    tables: [
      "credential",
      "task",
      "schedule",
      "document",
      "task_file",
      "todo_note",
      "ip_right",
      "ip_deadline",
      "notification",
      "deadline_item",
      "mobile_device",
      "mobile_push_delivery",
    ],
    fill: "#fffdf7",
  },
  {
    title: "Campaigns & Programs",
    tables: [
      "campaign",
      "campaign_recipient",
      "gov_program",
      "gov_program_sync_log",
      "rule",
    ],
    fill: "#fbfbff",
  },
  {
    title: "Integrations & Billing",
    tables: [
      "google_drive_connections",
      "google_drive_sync_jobs",
      "billing_plan",
      "billing_customer",
      "payment_method",
      "tenant_subscription",
      "payment_transaction",
      "webhook_event",
    ],
    fill: "#f9fffb",
  },
];

const byTable = new Map();
const tableTypes = new Map();
for (const column of columns) {
  if (!byTable.has(column.table_name)) byTable.set(column.table_name, []);
  tableTypes.set(column.table_name, column.table_type);
  byTable.get(column.table_name).push(column);
}

const fkByTarget = new Map();
for (const fk of fks) {
  const key = `${fk.table_name}.${fk.column_name}`;
  fkByTarget.set(key, `${fk.foreign_table_name}.${fk.foreign_column_name}`);
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tableHeight(table) {
  const rows = byTable.get(table) ?? [];
  return 34 + rows.length * 19 + 12;
}

const CARD_W = 276;
const GAP_X = 58;
const GAP_Y = 24;
const TOP = 98;
const LEFT = 42;
const COLS = 4;
const colHeights = Array.from({ length: COLS }, () => TOP);
const positions = new Map();

for (const group of groups) {
  for (const table of group.tables) {
    if (!byTable.has(table)) continue;
    const col = tableOrder.indexOf(table) % COLS;
    const x = LEFT + col * (CARD_W + GAP_X);
    const y = colHeights[col];
    const h = tableHeight(table);
    positions.set(table, { x, y, w: CARD_W, h, group });
    colHeights[col] += h + GAP_Y;
  }
}

for (const table of tableOrder) {
  if (!positions.has(table) && byTable.has(table)) {
    const col = colHeights.indexOf(Math.min(...colHeights));
    const x = LEFT + col * (CARD_W + GAP_X);
    const y = colHeights[col];
    const h = tableHeight(table);
    positions.set(table, { x, y, w: CARD_W, h, group: groups.at(-1) });
    colHeights[col] += h + GAP_Y;
  }
}

const width = LEFT * 2 + COLS * CARD_W + (COLS - 1) * GAP_X;
const height = Math.max(...colHeights) + 60;

function anchor(table, side = "right") {
  const pos = positions.get(table);
  if (!pos) return null;
  return {
    x: side === "right" ? pos.x + pos.w : pos.x,
    y: pos.y + Math.min(pos.h - 28, Math.max(42, pos.h / 2)),
  };
}

function pathFor(fk) {
  const fromPos = positions.get(fk.table_name);
  const toPos = positions.get(fk.foreign_table_name);
  if (!fromPos || !toPos) return "";
  const fromRight = fromPos.x < toPos.x;
  const from = anchor(fk.table_name, fromRight ? "right" : "left");
  const to = anchor(fk.foreign_table_name, fromRight ? "left" : "right");
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

const relationLines = fks
  .filter((fk) => positions.has(fk.table_name) && positions.has(fk.foreign_table_name))
  .map((fk, index) => {
    const path = pathFor(fk);
    return `
      <path id="rel-${index}" d="${path}" class="relation"/>
      <title>${escape(fk.table_name)}.${escape(fk.column_name)} → ${escape(fk.foreign_table_name)}.${escape(fk.foreign_column_name)}</title>
    `;
  })
  .join("\n");

function renderTable(table) {
  const pos = positions.get(table);
  const rows = byTable.get(table) ?? [];
  const isView = tableTypes.get(table) === "VIEW";
  return `
    <g class="table" transform="translate(${pos.x}, ${pos.y})">
      <rect class="${isView ? "card card-view" : "card"}" width="${pos.w}" height="${pos.h}" rx="12"/>
      <rect class="${isView ? "head head-view" : "head"}" width="${pos.w}" height="34" rx="12"/>
      <path d="M 0 24 H ${pos.w} V 34 H 0 Z" fill="${isView ? "#385898" : "#0a1317"}"/>
      <text class="table-name" x="14" y="22">${escape(table)}</text>
      ${isView ? `<text class="view-badge" x="${pos.w - 14}" y="22">VIEW</text>` : ""}
      ${rows
        .map((row, i) => {
          const y = 54 + i * 19;
          const key = `${row.table_name}.${row.column_name}`;
          const fk = fkByTarget.get(key);
          const badges = `${row.is_pk ? "PK " : ""}${fk ? "FK " : ""}`.trim();
          const required = row.is_nullable === "NO" ? "not null" : "nullable";
          return `
            <text class="col-name" x="14" y="${y}">${escape(row.column_name)}</text>
            <text class="col-type" x="${pos.w - 14}" y="${y}">${escape(
              `${badges ? `${badges} · ` : ""}${row.data_type} · ${required}`,
            )}</text>
          `;
        })
        .join("\n")}
    </g>
  `;
}

function renderGroupLegend() {
  return groups
    .map(
      (group, i) => `
        <g transform="translate(${LEFT + i * 292}, 56)">
          <rect width="16" height="16" rx="4" fill="${group.fill}" stroke="#ced0d4"/>
          <text class="legend" x="24" y="12">${escape(group.title)}</text>
        </g>
      `,
    )
    .join("\n");
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#8595a4"/>
    </marker>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0a1317" flood-opacity="0.08"/>
    </filter>
  </defs>
  <style>
    .bg { fill: #f2f4f7; }
    .title { font: 700 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #0a1317; }
    .subtitle { font: 500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #5d6c7b; }
    .legend { font: 600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #444950; }
    .relation { fill: none; stroke: #8595a4; stroke-width: 1.15; opacity: 0.68; marker-end: url(#arrow); }
    .card { fill: #ffffff; stroke: #ced0d4; stroke-width: 1; filter: url(#shadow); }
    .card-view { stroke: #385898; stroke-dasharray: 4 3; }
    .head { fill: #0a1317; }
    .head-view { fill: #385898; }
    .table-name { font: 700 13px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; fill: #ffffff; }
    .view-badge { font: 800 9px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; fill: #ffffff; text-anchor: end; opacity: 0.88; }
    .col-name { font: 600 11px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; fill: #1c1e21; }
    .col-type { font: 500 9px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; fill: #5d6c7b; text-anchor: end; }
  </style>
  <rect class="bg" width="100%" height="100%"/>
  <text class="title" x="${LEFT}" y="34">관제 Supabase ERD</text>
  <text class="subtitle" x="${LEFT}" y="53">Generated from linked Supabase public schema · ${new Date().toISOString().slice(0, 10)} · ${Array.from(tableTypes.values()).filter((type) => type === "BASE TABLE").length} tables + ${Array.from(tableTypes.values()).filter((type) => type === "VIEW").length} view · ${fks.length} foreign keys</text>
  ${renderGroupLegend()}
  <g class="relations">
    ${relationLines}
  </g>
  <g class="tables">
    ${Array.from(positions.keys()).map(renderTable).join("\n")}
  </g>
</svg>
`;

fs.writeFileSync(OUT, svg);
console.log(OUT);

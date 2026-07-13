import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ReportComponent, ReportData, ReportSection } from "@/lib/reports/types";

const NAVY = "051C2A";
const BLUE = "163E93";
const CYAN = "30A3DA";
const GRAY_LIGHT = "F2F2F2";
const GRAY_BORDER = "D9D9D9";
const WHITE = "FFFFFF";

function textValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(textValue).map((item) => item.trim()).filter(Boolean)
    : [];
}

function run(text: string, options?: { bold?: boolean; color?: string; size?: number }) {
  return new TextRun({
    text,
    bold: options?.bold,
    color: options?.color ?? "060200",
    size: options?.size ?? 21,
    font: "Arial",
  });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({
    children: [run(text)],
    spacing: { after: 160 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function heading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 260, after: 120 },
  });
}

function eyebrow(text: string): Paragraph {
  return new Paragraph({
    children: [run(text.toUpperCase(), { bold: true, color: CYAN, size: 16 })],
    spacing: { before: 220, after: 40 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [run("■  ", { bold: true, color: CYAN }), run(text)],
    indent: { left: 420, hanging: 240 },
    spacing: { after: 80 },
  });
}

function numbered(text: string, index: number): Paragraph {
  return new Paragraph({
    children: [run(`${index}.  `, { bold: true, color: BLUE }), run(text)],
    indent: { left: 420, hanging: 260 },
    spacing: { after: 80 },
  });
}

function cell(text: string, header = false): TableCell {
  return new TableCell({
    shading: header
      ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY }
      : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
      left: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
      right: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
    },
    children: [
      new Paragraph({
        children: [run(text, { bold: header, color: header ? WHITE : "060200" })],
        spacing: { before: 80, after: 80 },
      }),
    ],
  });
}

function table(headers: string[], rows: string[][]): Table | null {
  if (headers.length === 0) return null;
  const width = headers.length;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h) => cell(h, true)) }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: Array.from({ length: width }, (_, i) => cell(row[i] ?? "")),
          }),
      ),
    ],
  });
}

function callout(label: string, text: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, color: "auto", fill: GRAY_LIGHT },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: BLUE },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
              left: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
              right: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER },
            },
            children: [
              new Paragraph({
                children: [run(label.toUpperCase(), { bold: true, color: CYAN, size: 16 })],
                spacing: { before: 120, after: 80 },
              }),
              paragraph(text),
            ],
          }),
        ],
      }),
    ],
  });
}

function kpiStrip(items: Array<{ value: string; label: string }>): Table {
  const normalized = [...items, ...Array(3).fill({ value: "-", label: "-" })].slice(0, 3);
  const fills = [NAVY, BLUE, CYAN];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: normalized.map(
          (item, index) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, color: "auto", fill: fills[index] },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
                left: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
                right: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [run(item.value, { bold: true, color: WHITE, size: 36 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [run(item.label, { color: WHITE, size: 18 })],
                }),
              ],
            }),
        ),
      }),
    ],
  });
}

function componentBlocks(component: ReportComponent): Array<Paragraph | Table> {
  switch (component.type) {
    case "h3":
      return [heading(textValue(component.text), HeadingLevel.HEADING_2)];
    case "paragraph":
      return [paragraph(textValue(component.text))];
    case "bullets":
      return textList(component.items).map(bullet);
    case "numbered":
      return textList(component.items).map((item, index) => numbered(item, index + 1));
    case "lead_in_bullets":
      return Array.isArray(component.items)
        ? component.items.map((item) =>
            typeof item === "string"
              ? bullet(item)
              : bullet(`${textValue(item?.lead)} - ${textValue(item?.rest)}`),
          )
        : [];
    case "table": {
      const headers = textList(component.headers);
      const rows = Array.isArray(component.rows)
        ? component.rows.map((row) => textList(row))
        : [];
      const built = table(headers, rows);
      return built ? [built] : [];
    }
    case "kpi_strip":
      return [
        kpiStrip(
          Array.isArray(component.items)
            ? component.items.map((item) => ({
                value: textValue(item?.value),
                label: textValue(item?.label),
              }))
            : [],
        ),
      ];
    case "callout":
      return [callout(textValue(component.label), textValue(component.text))];
    default:
      return [];
  }
}

function sectionBlocks(section: ReportSection): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];
  if (section.eyebrow) blocks.push(eyebrow(textValue(section.eyebrow)));
  blocks.push(heading(textValue(section.title) || "섹션", HeadingLevel.HEADING_1));
  if (section.intro) blocks.push(paragraph(textValue(section.intro)));
  const components = Array.isArray(section.components) ? section.components : [];
  for (const component of components) {
    blocks.push(...componentBlocks(component));
  }
  return blocks;
}

export interface BuildReportDocxOptions {
  compact?: boolean;
}

export async function buildReportDocx(
  report: ReportData,
  options: BuildReportDocxOptions = {},
): Promise<Buffer> {
  const blocks: Array<Paragraph | Table> = options.compact
    ? [
        new Paragraph({
          children: [
            run("MEETING REPORT SUMMARY", { bold: true, color: CYAN, size: 18 }),
          ],
          spacing: { before: 180, after: 100 },
        }),
        new Paragraph({
          children: [
            run(report.cover.company_name, { bold: true, color: NAVY, size: 42 }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            run(report.cover.subtitle ?? "미팅 보고서 요약본", {
              color: NAVY,
              size: 24,
            }),
          ],
          spacing: { after: 140 },
        }),
        new Paragraph({
          children: [
            run(`Prepared for: ${report.cover.prepared_for ?? report.cover.company_name}`),
            run(`  |  Prepared by: ${report.cover.prepared_by ?? "Gwanje"}`),
            run(`  |  Date: ${report.cover.date ?? "-"}`),
          ],
          spacing: { after: 160 },
        }),
      ]
    : [
        new Paragraph({
          children: [
            run("STRATEGIC BRIEFING", { bold: true, color: CYAN, size: 20 }),
          ],
          spacing: { before: 800, after: 180 },
        }),
        new Paragraph({
          children: [
            run(report.cover.company_name, { bold: true, color: NAVY, size: 56 }),
          ],
          spacing: { after: 180 },
        }),
        new Paragraph({
          children: [
            run(report.cover.subtitle ?? "미팅 기반 컨설팅 진단 보고서", {
              color: NAVY,
              size: 28,
            }),
          ],
          spacing: { after: 420 },
        }),
        paragraph(`Prepared for: ${report.cover.prepared_for ?? report.cover.company_name}`),
        paragraph(`Prepared by: ${report.cover.prepared_by ?? "Gwanje"}`),
        paragraph(`Date: ${report.cover.date ?? "-"}`),
        new Paragraph({ pageBreakBefore: true }),
      ];

  if (report.executive_summary) {
    blocks.push(
      ...sectionBlocks({
        eyebrow: report.executive_summary.eyebrow ?? "EXECUTIVE SUMMARY",
        title: report.executive_summary.title,
        intro: report.executive_summary.intro,
        components: [],
      }),
    );
    if (report.executive_summary.kpi?.length) {
      blocks.push(kpiStrip(report.executive_summary.kpi));
    }
    if (report.executive_summary.key_takeaway) {
      blocks.push(callout("KEY TAKEAWAY", report.executive_summary.key_takeaway));
    }
  }

  if (report.meta_table?.length) {
    blocks.push(heading("보고서 정보", HeadingLevel.HEADING_1));
    const built = table(["항목", "내용"], report.meta_table);
    if (built) blocks.push(built);
  }

  for (const section of report.sections) {
    blocks.push(...sectionBlocks(section));
  }
  if (report.closing) blocks.push(...sectionBlocks(report.closing));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, right: 900, bottom: 1000, left: 900 },
          },
        },
        children: blocks,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

import type { Json } from "@/lib/database.types";
import type { SupportField } from "@/lib/gov-programs/types";
import { SUPPORT_KEYWORDS, isSupportField } from "@/lib/gov-programs/types";

export type JsonRecord = Record<string, Json | undefined>;

export function buildUrl(
  base: string,
  params: Record<string, string | number | null | undefined>,
  rawParams: Record<string, string | null | undefined> = {},
): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const raw = Object.entries(rawParams)
    .filter(([, value]) => value)
    .map(([key, value]) => {
      const rawValue = value ?? "";
      const encoded = /%[0-9a-f]{2}/i.test(rawValue)
        ? rawValue
        : encodeURIComponent(rawValue);
      return `${encodeURIComponent(key)}=${encoded}`;
    });
  if (raw.length > 0) {
    url.search = [url.search.slice(1), ...raw].filter(Boolean).join("&");
  }
  return url.toString();
}

export async function fetchJson(url: string): Promise<Json> {
  const res = await fetch(url, {
    headers: { accept: "application/json, text/plain, */*" },
    next: { revalidate: 0 },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  try {
    return JSON.parse(text) as Json;
  } catch (err) {
    throw new Error(
      `JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { accept: "application/xml, text/xml, application/json, */*" },
    next: { revalidate: 0 },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return text;
}

export async function fetchItems(url: string): Promise<JsonRecord[]> {
  const text = await fetchText(url);
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return extractItems(JSON.parse(trimmed) as Json);
  }
  return parseXmlItems(trimmed);
}

/** 페이지 단위 수집 — 짧은 페이지(마지막)를 만나면 중단. */
export async function fetchPagedItems(
  makeUrl: (pageNo: number) => string,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<JsonRecord[]> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 5;
  const items: JsonRecord[] = [];
  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const rows = await fetchItems(makeUrl(pageNo));
    items.push(...rows);
    if (rows.length < pageSize) break;
  }
  return items;
}

function isRecord(value: Json | undefined): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecords(value: Json | undefined): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  return isRecord(value) ? [value] : [];
}

export function extractItems(payload: Json): JsonRecord[] {
  const root = isRecord(payload) ? payload : {};
  const jsonArray = isRecord(root.jsonArray) ? root.jsonArray : undefined;
  const candidates: (Json | undefined)[] = [
    root.jsonArray,
    jsonArray?.item,
    jsonArray?.items,
    root.items,
    isRecord(root.items) ? root.items.item : undefined,
    root.item,
    root.data,
    root.list,
    root.result,
  ];

  const response = isRecord(root.response) ? root.response : undefined;
  const body = isRecord(response?.body) ? response.body : undefined;
  const bodyItems = isRecord(body?.items) ? body.items : undefined;
  candidates.push(body?.items, bodyItems?.item, body?.item, body?.data);

  for (const candidate of candidates) {
    const rows = asRecords(candidate);
    if (rows.length > 0) return rows;
  }
  return [];
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseXmlItems(xml: string): JsonRecord[] {
  const itemMatches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  const rows = itemMatches.length > 0
    ? itemMatches
    : [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)];

  return rows.map((match) => {
    const itemXml = match[1] ?? "";
    const row: JsonRecord = {};
    for (const field of itemXml.matchAll(/<([A-Za-z0-9_:-]+)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const key = field[1]?.replace(/^.*:/, "");
      if (!key) continue;
      row[key] = decodeXml(field[2] ?? "");
    }
    return row;
  });
}

export function firstString(
  row: JsonRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function combineText(...values: (string | null | undefined)[]): string | null {
  const text = values
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

export function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[년./]/g, "-")
    .replace(/[월]/g, "-")
    .replace(/[일]/g, "")
    .replace(/\s+/g, "")
    .trim();

  const compact = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  const dashed = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!dashed) return null;
  const month = dashed[2].padStart(2, "0");
  const day = dashed[3].padStart(2, "0");
  return `${dashed[1]}-${month}-${day}`;
}

export function parseDateRange(
  value: string | null | undefined,
): { start: string | null; end: string | null } {
  if (!value) return { start: null, end: null };
  const dates = value.match(/\d{4}[년./-]?\s?\d{1,2}[월./-]?\s?\d{1,2}일?/g) ?? [];
  return {
    start: parseDate(dates[0] ?? null),
    end: parseDate(dates[1] ?? dates[0] ?? null),
  };
}

export function splitTags(value: string | null | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .replace(/#/g, " ")
        .split(/[,\s/|·]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 1 && tag.length <= 24),
    ),
  ).slice(0, 12);
}

export function inferSupportField(
  explicit: string | null,
  ...texts: (string | null | undefined)[]
): SupportField | null {
  if (isSupportField(explicit)) return explicit;
  const haystack = [explicit, ...texts].join(" ").toLowerCase();
  for (const field of Object.keys(SUPPORT_KEYWORDS) as SupportField[]) {
    if (field === "기타") continue;
    if (SUPPORT_KEYWORDS[field].some((keyword) => haystack.includes(keyword))) {
      return field;
    }
  }
  return explicit ? "기타" : null;
}

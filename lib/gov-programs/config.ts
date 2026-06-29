import type { SourceCode } from "@/lib/gov-programs/types";

export function getBizinfoApiKey(): string | null {
  return process.env.BIZINFO_API_KEY?.trim() || null;
}

export function getDataGoKrApiKey(): string | null {
  return process.env.DATA_GO_KR_API_KEY?.trim() || null;
}

export function enabledSources(): SourceCode[] {
  const sources: SourceCode[] = [];
  if (getBizinfoApiKey()) sources.push("bizinfo");
  if (getDataGoKrApiKey()) sources.push("kstartup", "smes", "msit");
  return sources;
}

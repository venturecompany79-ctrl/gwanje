import { bizinfoAdapter } from "@/lib/gov-programs/sources/bizinfo";
import { kstartupAdapter } from "@/lib/gov-programs/sources/kstartup";
import { msitAdapter } from "@/lib/gov-programs/sources/msit";
import { smesAdapter } from "@/lib/gov-programs/sources/smes";
import type { SourceAdapter, SourceCode } from "@/lib/gov-programs/types";

export const GOV_PROGRAM_ADAPTERS: Record<SourceCode, SourceAdapter> = {
  bizinfo: bizinfoAdapter,
  kstartup: kstartupAdapter,
  smes: smesAdapter,
  msit: msitAdapter,
};

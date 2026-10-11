import { createServiceClient } from "@/lib/supabase/service";

type Input = { tenantId: string; companyId: string | null; source?: string; sourceId?: string };

export async function buildTaskContext({ tenantId, companyId, source, sourceId }: Input): Promise<string> {
  const service = createServiceClient();
  if (!service) throw new Error("not_configured");
  const lines = ["[관제 자료 — 참고용 사실]"];
  const value = (item: unknown) => item === null || item === undefined || item === "" || (Array.isArray(item) && !item.length)
    ? "미입력" : Array.from(Array.isArray(item) ? item.join(", ") : String(item)).slice(0, 450).join("");
  const add = (label: string, item: unknown) => lines.push(`${label}: ${value(item)}`);
  const read = <Result extends { data: unknown; error: unknown }>(result: Result): NonNullable<Result["data"]> => {
    if (result.error) throw new Error("storage_unavailable");
    if (!result.data) throw new Error("forbidden");
    return result.data as NonNullable<Result["data"]>;
  };
  if (companyId) {
    const company = read(await service.from("company").select("name, industry, founded_date, revenue, headcount, condition_tags, memo")
      .eq("tenant_id", tenantId).eq("id", companyId).single());
    add("기업명", company.name); add("업종", company.industry); add("설립일", company.founded_date);
    add("매출(원)", company.revenue); add("인원", company.headcount); add("condition_tags", company.condition_tags); add("기업 메모", company.memo);
  } else add("기업", null);
  if (Boolean(source) !== Boolean(sourceId)) throw new Error("invalid_request");
  if (source && sourceId) {
    if (source === "task" && companyId) {
      const task = read(await service.from("task").select("title, category_id, due_date, work_status, memo").eq("tenant_id", tenantId).eq("company_id", companyId).eq("id", sourceId).single());
      const category = task.category_id ? read(await service.from("category").select("name").eq("tenant_id", tenantId).eq("id", task.category_id).single()) : null;
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
      add("대상 항목", task.title); add("분류", category?.name); add("마감일", task.due_date);
      add("D-day(남은 일수)", task.due_date ? Math.round((Date.parse(task.due_date) - Date.parse(today)) / 86_400_000) : null);
      add("작업상태", task.work_status); add("항목 메모", task.memo);
    } else if (source === "credential" && companyId) {
      const credential = read(await service.from("credential").select("type, issued_date, expires_date, renew_lead_days").eq("tenant_id", tenantId).eq("company_id", companyId).eq("id", sourceId).single());
      add("자격 종류", credential.type); add("발급일", credential.issued_date); add("만료일", credential.expires_date); add("갱신 리드타임(일)", credential.renew_lead_days);
    } else if (source === "ip_deadline" && companyId) {
      const deadline = read(await service.from("ip_deadline").select("ip_right_id, type").eq("tenant_id", tenantId).eq("company_id", companyId).eq("id", sourceId).single());
      const right = read(await service.from("ip_right").select("title").eq("tenant_id", tenantId).eq("company_id", companyId).eq("id", deadline.ip_right_id).single());
      add("권리명", right.title); add("기한 유형", deadline.type);
    } else if (source === "schedule") {
      let query = service.from("schedule").select("title, type, date, memo").eq("tenant_id", tenantId).eq("id", sourceId);
      query = companyId ? query.eq("company_id", companyId) : query.is("company_id", null);
      const schedule = read(await query.single());
      add("대상 항목", schedule.title); add("일정 유형", schedule.type); add("마감일", schedule.date); add("항목 메모", schedule.memo);
    } else throw new Error("invalid_request");
  }
  if (companyId) {
    const nearby = read(await service.from("deadline_item").select("source, id, title, due_date, days_left")
      .eq("tenant_id", tenantId).eq("company_id", companyId).gte("days_left", 0).lte("days_left", 30)
      .order("due_date").order("source").order("id").limit(11));
    lines.push("다른 마감 항목(향후 30일 이내, 최대 10건):");
    const others = nearby.filter((item) => item.source !== source || item.id !== sourceId).slice(0, 10);
    for (const item of others) lines.push(`- ${value(item.title)} | ${value(item.due_date)} | 남은 ${value(item.days_left)}일`);
    if (!others.length) lines.push("미입력");
  }
  const result = lines.join("\n");
  return result.length <= 6000 ? result : result.slice(0, 5980) + "\n[길이 제한으로 생략]";
}

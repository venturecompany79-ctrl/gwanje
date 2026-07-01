import { supabase, webApiBaseUrl } from "@/lib/supabase";

export async function mobileApi<T extends object>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T & { ok: true }> {
  if (!webApiBaseUrl) {
    throw new Error("EXPO_PUBLIC_WEB_API_BASE_URL이 설정되지 않았습니다.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const response = await fetch(`${webApiBaseUrl}${path}`, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error ?? `요청에 실패했습니다. (${response.status})`);
  }
  return payload as T & { ok: true };
}

const SUPABASE_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type SupabaseEnvKey = (typeof SUPABASE_ENV_KEYS)[number];

export function getMissingSupabaseEnvKeys(): SupabaseEnvKey[] {
  return SUPABASE_ENV_KEYS.filter((key) => !process.env[key]);
}

export function isSupabaseConfigured(): boolean {
  return getMissingSupabaseEnvKeys().length === 0;
}

export function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

export function isSupabaseDemoAllowed(): boolean {
  return process.env.NODE_ENV === "development" && !isVercelDeployment();
}

export function getSupabaseConfigErrorMessage(): string {
  const missing = getMissingSupabaseEnvKeys().join(", ");
  return [
    "Supabase 환경변수가 설정되지 않았습니다.",
    missing ? `누락: ${missing}.` : "",
    "데모 모드는 로컬 개발 환경에서만 허용됩니다.",
  ]
    .filter(Boolean)
    .join(" ");
}

import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
import type { Database } from "@root/lib/database.types";

type MobileConfigExtra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  webApiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileConfigExtra;

function firstPresent(...values: (string | undefined)[]) {
  return values.find((value) => value && value.trim().length > 0) ?? "";
}

function webOrigin() {
  if (Platform.OS !== "web") return "";
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export const supabaseUrl = firstPresent(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  extra.supabaseUrl,
);
export const supabaseAnonKey = firstPresent(
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  extra.supabasePublishableKey,
);
export const webApiBaseUrl = firstPresent(
  process.env.EXPO_PUBLIC_WEB_API_BASE_URL,
  extra.webApiBaseUrl,
  webOrigin(),
).replace(/\/$/, "");

export const hasMobileEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const hasWebApiBaseUrl = Boolean(webApiBaseUrl);

export const supabase = createClient<Database>(
  supabaseUrl || "https://missing.supabase.co",
  supabaseAnonKey || "missing-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Google OAuth(웹브라우저 콜백)에서 code를 직접 교환하므로 PKCE 사용.
      // 이메일+비밀번호 로그인은 flowType의 영향을 받지 않는다.
      flowType: "pkce",
      lock: processLock,
    },
  },
);

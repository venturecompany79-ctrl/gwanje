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

function webOrigin() {
  if (Platform.OS !== "web") return "";
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  extra.supabasePublishableKey ??
  "";
export const webApiBaseUrl = (
  process.env.EXPO_PUBLIC_WEB_API_BASE_URL ??
  extra.webApiBaseUrl ??
  webOrigin()
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
      lock: processLock,
    },
  },
);

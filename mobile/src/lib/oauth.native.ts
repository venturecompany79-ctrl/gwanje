import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import type { SignInWithGoogleOAuth } from "@/lib/oauth";

export const signInWithGoogleOAuth: SignInWithGoogleOAuth = async () => {
  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("인증 URL을 생성하지 못했습니다.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    return { cancelled: true };
  }
  if (result.type !== "success" || !result.url) {
    throw new Error("Google 인증이 완료되지 않았습니다.");
  }

  const url = new URL(result.url);
  const errorDescription =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (errorDescription) throw new Error(errorDescription);

  const code = url.searchParams.get("code");
  if (!code) throw new Error("인증 코드를 받지 못했습니다.");

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;

  return { cancelled: false };
};

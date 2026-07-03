import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

// 웹 인증 세션이 백그라운드에 남지 않도록 정리(웹 전용, 네이티브에선 무해)
WebBrowser.maybeCompleteAuthSession();

export type OAuthResult = { cancelled: boolean };

/**
 * Google OAuth — 시스템 웹브라우저로 Supabase 인증을 열고, 콜백 딥링크의
 * code(PKCE)를 세션으로 교환한다. 기존 Supabase 웹 OAuth 클라이언트를 그대로
 * 재사용하므로 iOS/Android용 별도 Google 클라이언트가 필요 없다.
 *
 * ⚠️ redirectTo(`gwanje://auth-callback`)를 Supabase Auth의 Redirect URLs
 *    허용목록에 반드시 추가해야 한다.
 */
export async function signInWithGoogleOAuth(): Promise<OAuthResult> {
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true, // 브라우저를 우리가 직접 연다
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

  const url = new URL(result.url); // react-native-url-polyfill 적용됨
  const errorDescription =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (errorDescription) throw new Error(errorDescription);

  const code = url.searchParams.get("code");
  if (!code) throw new Error("인증 코드를 받지 못했습니다.");

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;

  return { cancelled: false };
}

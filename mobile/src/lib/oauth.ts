import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

// 웹 인증 세션이 백그라운드에 남지 않도록 정리(웹 전용, 네이티브에선 무해)
WebBrowser.maybeCompleteAuthSession();

export type OAuthResult = { cancelled: boolean };

/**
 * Google OAuth 로그인. 기존 Supabase 웹 OAuth 클라이언트를 그대로 재사용한다.
 *
 * - 웹: 팝업(window.open) 대신 **전체 페이지 리다이렉트**. 모바일 브라우저는
 *   사용자 탭 이후 시간차로 열리는 팝업을 차단하므로 팝업 방식을 쓰면 안 된다.
 *   복귀 시 supabase 클라이언트의 detectSessionInUrl(웹 전용)이 ?code=를 자동 교환한다.
 * - 네이티브: 시스템 웹브라우저 + PKCE code 교환. redirectTo(`gwanje://auth-callback`)를
 *   Supabase Auth의 Redirect URLs 허용목록에 등록해야 한다.
 */
export async function signInWithGoogleOAuth(): Promise<OAuthResult> {
  if (Platform.OS === "web") {
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
    // 브라우저가 Google로 이동한다 — 아래 코드는 실행되지 않는다.
    return { cancelled: false };
  }

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

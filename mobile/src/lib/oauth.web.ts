import { supabase } from "@/lib/supabase";
import type { SignInWithGoogleOAuth } from "@/lib/oauth";

/** Mobile browsers require a full-page OAuth redirect instead of a popup. */
export const signInWithGoogleOAuth: SignInWithGoogleOAuth = async () => {
  const redirectTo = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  return { cancelled: false };
};

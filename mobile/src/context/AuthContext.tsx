import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, hasMobileEnv, hasWebApiBaseUrl } from "@/lib/supabase";
import { signInWithGoogleOAuth } from "@/lib/oauth";
import { registerDeviceForPush } from "@/lib/push";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  envReady: boolean;
}

// 앱에는 온보딩 화면이 없다 — 웹에서 아직 프로비저닝(가입 완료)되지 않은 계정은
// 세션이 생겨도 tenant가 없어 빈 화면이 된다. 이런 계정은 로그아웃시키고 안내한다.
async function assertProvisionedOrSignOut(userId: string) {
  const { data: profile } = await supabase
    .from("profile")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    throw new Error(
      "웹에서 회원가입을 먼저 완료해 주세요. (gwanje.vercel.app)",
    );
  }
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    throw new Error("비활성화되었거나 초대 수락 전인 계정입니다.");
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const envReady = hasMobileEnv && hasWebApiBaseUrl;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !envReady) return;
    registerDeviceForPush().catch((error) => {
      console.warn("[push:register]", error);
    });
  }, [envReady, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      envReady,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      async signInWithGoogle() {
        const { cancelled } = await signInWithGoogleOAuth();
        if (cancelled) return;
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) throw new Error("로그인에 실패했습니다. 다시 시도해 주세요.");
        await assertProvisionedOrSignOut(userId);
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [envReady, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

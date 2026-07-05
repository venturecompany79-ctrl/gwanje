import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
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
  /** 온보딩 게이트에서 막힌 경우의 안내(웹 리다이렉트 복귀 시 표시) */
  gateError: string | null;
  clearGateError: () => void;
  envReady: boolean;
}

// 앱에는 온보딩 화면이 없다 — 웹에서 아직 프로비저닝(가입 완료)되지 않은 계정은
// 세션이 생겨도 tenant가 없어 빈 화면이 된다. 이런 계정은 로그인시키지 않는다.
type GateResult = "ok" | "unprovisioned" | "inactive" | "unknown";

async function checkProfileGate(userId: string): Promise<GateResult> {
  const { data, error } = await supabase
    .from("profile")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  if (error) return "unknown"; // 판정 불가 — 통과(fail-open, 기존 동작 유지)
  if (!data) return "unprovisioned";
  return data.status === "active" ? "ok" : "inactive";
}

function gateMessage(result: GateResult): string | null {
  if (result === "unprovisioned") {
    return "웹에서 회원가입을 먼저 완료해 주세요. (gwanje.vercel.app)";
  }
  if (result === "inactive") {
    return "비활성화되었거나 초대 수락 전인 계정입니다.";
  }
  return null; // ok / unknown → 통과
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const envReady = hasMobileEnv && hasWebApiBaseUrl;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const current = data.session;
      // 웹: Google 리다이렉트 복귀 시 detectSessionInUrl이 세션을 만들지만
      // signInWithGoogle의 게이트를 거치지 않으므로 여기서 프로비저닝을 검증한다.
      if (current && Platform.OS === "web") {
        const message = gateMessage(await checkProfileGate(current.user.id));
        if (!mounted) return;
        if (message) {
          await supabase.auth.signOut({ scope: "local" });
          if (!mounted) return;
          setGateError(message);
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(current);
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
      gateError,
      clearGateError() {
        setGateError(null);
      },
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Google 로그인과 동일하게 프로비저닝/활성 상태를 검증한다
        const userId = data.user?.id;
        if (userId) {
          const message = gateMessage(await checkProfileGate(userId));
          if (message) {
            await supabase.auth.signOut({ scope: "local" });
            throw new Error(message);
          }
        }
      },
      async signInWithGoogle() {
        const { cancelled } = await signInWithGoogleOAuth();
        if (cancelled) return;
        // 웹은 전체 페이지 리다이렉트가 진행 중 — location 변경은 비동기라 이 뒤 코드가
        // 언로드 전에 실행된다. 아직 세션이 없어 getUser()가 null을 반환하므로 여기서
        // 게이트를 돌리면 안 된다(잘못된 "로그인 실패" 표시). 웹 게이트는 복귀 시
        // 부트스트랩(getSession)이 처리한다. 아래는 네이티브 전용.
        if (Platform.OS === "web") return;
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) throw new Error("로그인에 실패했습니다. 다시 시도해 주세요.");
        const message = gateMessage(await checkProfileGate(userId));
        if (message) {
          await supabase.auth.signOut({ scope: "local" });
          throw new Error(message);
        }
      },
      async signOut() {
        // global(기본값)은 같은 계정의 웹 대시보드 세션까지 무효화한다
        await supabase.auth.signOut({ scope: "local" });
      },
    }),
    [envReady, gateError, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

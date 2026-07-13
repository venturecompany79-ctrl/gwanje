import { cookies } from "next/headers";
import {
  canConsultantViewShare,
  getDemoSharedDashboard,
  getShareByToken,
  getSharedDashboard,
} from "@/lib/data/company-share";
import { getShareCookieSecret, isCompanyShareConfigured } from "@/lib/share/config";
import {
  SHARE_SESSION_COOKIE,
  verifyShareSessionCookieValue,
} from "@/lib/share/session";
import {
  isSupabaseConfigured,
  isSupabaseDemoAllowed,
} from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { ShareDashboard } from "./_components/ShareDashboard";
import { SharePasswordGate } from "./_components/SharePasswordGate";
import { ShareUnavailable } from "./_components/ShareUnavailable";

// 비밀번호 게이트·최신 데이터가 캐시되면 안 된다.
export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // 데모 모드(.env 없음) — 어떤 토큰이든 게이트 없이 데모 대시보드로 화면 확인
  if (!isSupabaseConfigured()) {
    if (isSupabaseDemoAllowed()) {
      return <ShareDashboard data={getDemoSharedDashboard()} />;
    }
    return <ShareUnavailable />;
  }

  if (!isCompanyShareConfigured()) return <ShareUnavailable />;

  const share = await getShareByToken(token);
  // 열거 방지 — 존재하지 않는 토큰과 공유 중지를 같은 화면으로 (구분 불가)
  if (!share || !share.enabled) return <ShareUnavailable />;

  const secret = getShareCookieSecret();
  const cookieValue = (await cookies()).get(SHARE_SESSION_COOKIE)?.value;
  const hasShareSession = Boolean(
    secret &&
      cookieValue &&
      verifyShareSessionCookieValue(
        secret,
        cookieValue,
        share.id,
        share.sessionVersion,
      ),
  );

  // 앱에 로그인한 컨설턴트는 비밀번호 없이 확인한다. company RLS가
  // 활성 멤버·tenant·companies.read 권한을 검증하므로 토큰만으로 우회할 수 없다.
  const supabase = hasShareSession ? null : await createClient();
  const hasConsultantAccess = Boolean(
    supabase && (await canConsultantViewShare(supabase, share)),
  );

  if (!hasShareSession && !hasConsultantAccess) {
    const locked = Boolean(
      share.lockedUntil && new Date(share.lockedUntil).getTime() > Date.now(),
    );
    return (
      <SharePasswordGate
        token={token}
        mode={share.hasPassword ? "enter" : "set"}
        initiallyLocked={locked}
      />
    );
  }

  const data = await getSharedDashboard(share);
  if (!data) {
    // 이미 인증된 사용자의 일시 오류 — 열거 방지 문구를 쓰면 컨설턴트가
    // 멀쩡한 링크를 재발급하는 헛수고를 하게 되므로 별도 안내
    return (
      <ShareUnavailable
        title="일시적인 오류가 발생했습니다"
        description="잠시 후 새로고침해 주세요. 문제가 계속되면 담당 컨설턴트에게 문의해 주세요."
      />
    );
  }
  return <ShareDashboard data={data} />;
}

import type { ReactNode } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { CategoryColorStyle } from "@/components/shell/CategoryColorStyle";
import { getShellData } from "@/lib/data/shell";
import { getSubscriptionGate } from "@/lib/billing/data";
import { IconAlert } from "@/components/ui/icons";

// ★ 앱 셸 — 사이드바(240px)+상단바. 모든 솔루션 화면이 공유하는 유일한 정의처.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [shell, gate] = await Promise.all([
    getShellData(),
    getSubscriptionGate(),
  ]);

  return (
    <div className="shell">
      <CategoryColorStyle />
      <Sidebar
        consultantName={shell.consultantName}
        orgName={shell.orgName}
        unreadCount={shell.unreadCount}
        role={shell.role}
        permissions={shell.permissions}
      />
      <div className="shell-main">
        <Topbar
          consultantName={shell.consultantName}
          consultantTitle={shell.consultantTitle}
          unreadCount={shell.unreadCount}
          permissions={shell.permissions}
        />
        {gate === "banner" ? (
          <Link href="/app/billing" className="billing-banner">
            <IconAlert />
            결제에 실패했습니다. 서비스 중단을 막으려면 결제수단을 확인해 주세요.
            <span className="billing-banner-cta">결제 관리 →</span>
          </Link>
        ) : null}
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}

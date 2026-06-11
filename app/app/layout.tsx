import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { getShellData } from "@/lib/data/shell";

// ★ 앱 셸 — 사이드바(240px)+상단바. 모든 솔루션 화면이 공유하는 유일한 정의처.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const shell = await getShellData();

  return (
    <div className="shell">
      <Sidebar
        consultantName={shell.consultantName}
        orgName={shell.orgName}
        unreadCount={shell.unreadCount}
      />
      <div className="shell-main">
        <Topbar
          consultantName={shell.consultantName}
          consultantTitle={shell.consultantTitle}
          unreadCount={shell.unreadCount}
        />
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}

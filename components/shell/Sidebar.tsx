"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconBell,
  IconBuilding,
  IconGear,
  IconGrid,
  IconKanban,
  IconSend,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/app", label: "대시보드", icon: IconGrid },
  { href: "/app/companies", label: "기업", icon: IconBuilding },
  { href: "/app/board", label: "Task 보드", icon: IconKanban },
  { href: "/app/campaigns", label: "일괄안내", icon: IconSend },
  { href: "/app/notifications", label: "알림", icon: IconBell },
  { href: "/app/settings", label: "설정", icon: IconGear },
] as const;

export function Sidebar({
  consultantName,
  orgName,
  unreadCount,
}: {
  consultantName: string;
  orgName: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="shell-nav">
      <div className="brand">
        <div className="brand-mark">관</div>
        <div>
          <b>관제</b>
          <small>Compliance Desk</small>
        </div>
      </div>
      <div className="nav-sec">메뉴</div>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? " is-active" : ""}`}
            onFocus={() => router.prefetch(href)}
            onPointerEnter={() => router.prefetch(href)}
          >
            <Icon />
            <span>{label}</span>
            {href === "/app/notifications" && unreadCount > 0 ? (
              <span className="nav-badge num">{unreadCount}</span>
            ) : null}
          </Link>
        );
      })}
      <div className="nav-foot">
        <div className="avatar">{consultantName.slice(0, 1)}</div>
        <div className="who">
          <b>{consultantName}</b>
          <span>{orgName}</span>
        </div>
      </div>
    </nav>
  );
}

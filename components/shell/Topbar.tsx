import Link from "next/link";
import { IconBell, IconSearch } from "@/components/ui/icons";

export function Topbar({
  consultantName,
  consultantTitle,
  unreadCount,
}: {
  consultantName: string;
  consultantTitle: string;
  unreadCount: number;
}) {
  return (
    <header className="topbar">
      <div className="search-pill">
        <IconSearch />
        <input placeholder="기업·자격·과제 검색" aria-label="검색" />
      </div>
      <div className="spacer" />
      <div className="topbar-noti">
        <Link href="/app/notifications" className="icon-btn" aria-label="알림">
          <IconBell />
        </Link>
        {unreadCount > 0 ? <span className="dot num">{unreadCount}</span> : null}
      </div>
      <div className="topbar-prof">
        <div className="avatar">{consultantName.slice(0, 1)}</div>
        <div className="pn">
          <b>{consultantName}</b>
          <span>{consultantTitle}</span>
        </div>
      </div>
    </header>
  );
}

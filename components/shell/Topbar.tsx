import Link from "next/link";
import { IconBell, IconSearch } from "@/components/ui/icons";
import { UserMenu } from "@/components/shell/UserMenu";

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
      {/* 전역 검색 — 기업 목록 검색으로 전송(GET). JS 없이도 동작 (F14)
          입력 중 동작 예측을 위한 'Enter로 검색' 정적 힌트 (GWJ-026, Server Component 유지) */}
      <form className="search-pill" action="/app/companies" role="search">
        <IconSearch />
        <input
          type="search"
          name="q"
          placeholder="기업 검색"
          aria-label="기업 검색"
          aria-describedby="global-search-hint"
        />
        <span id="global-search-hint" className="search-hint">
          Enter로 검색
        </span>
      </form>
      <div className="spacer" />
      <div className="topbar-noti">
        <Link href="/app/notifications" className="icon-btn" aria-label="알림">
          <IconBell />
        </Link>
        {unreadCount > 0 ? <span className="dot num">{unreadCount}</span> : null}
      </div>
      <UserMenu
        consultantName={consultantName}
        consultantTitle={consultantTitle}
      />
    </header>
  );
}

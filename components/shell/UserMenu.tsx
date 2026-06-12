"use client";

// 상단바 프로필 + 로그아웃 메뉴 (F15) — 세션 종료 수단 제공
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({
  consultantName,
  consultantTitle,
}: {
  consultantName: string;
  consultantTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function logout() {
    setPending(true);
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="topbar-prof" ref={ref}>
      <button
        type="button"
        className="prof-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="계정 메뉴"
      >
        <div className="avatar">{consultantName.slice(0, 1)}</div>
        <div className="pn">
          <b>{consultantName}</b>
          <span>{consultantTitle}</span>
        </div>
      </button>
      {open ? (
        <div className="prof-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="prof-menu-item"
            onClick={logout}
            disabled={pending}
          >
            <IconLogout /> {pending ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

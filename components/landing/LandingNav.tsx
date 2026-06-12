"use client";

import { useState } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { IconMenu, IconX } from "@/components/ui/icons";

const MENU = [
  { label: "기능", href: "#features" },
  { label: "작동 방식", href: "#how" },
  { label: "요금", href: "#pricing" },
  { label: "문의", href: "#contact" },
];

// 랜딩 스티키 네비 — 모바일 햄버거 토글만 클라이언트 상태
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="lnav">
      <div className="lnav-in">
        <Link href="/" className="lp-logo">
          <span className="brand-mark">관</span>관제
        </Link>
        <nav className="lp-nav-menu">
          {MENU.map((m) => (
            <a key={m.href} href={m.href}>
              {m.label}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        <div className="lp-nav-cta">
          <LinkButton variant="secondary" size="sm" href="/login">
            로그인
          </LinkButton>
          {/* 마케팅 1차 CTA만 검정 pill (Meta DS 규칙) */}
          <LinkButton variant="primary" size="sm" href="/login">
            서비스 이용하기
          </LinkButton>
        </div>
        <button
          type="button"
          className="lp-hamb"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <IconX /> : <IconMenu />}
        </button>
      </div>
      {open && (
        <nav className="lp-mobile-menu">
          {MENU.map((m) => (
            <a key={m.href} href={m.href} onClick={() => setOpen(false)}>
              {m.label}
            </a>
          ))}
          <div className="mcta">
            <LinkButton variant="primary" full href="/login">
              서비스 이용하기
            </LinkButton>
            <LinkButton variant="secondary" full href="/login">
              로그인
            </LinkButton>
          </div>
        </nav>
      )}
    </header>
  );
}

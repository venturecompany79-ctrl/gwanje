"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

/**
 * 마감 리스트 행 — 행 전체를 클릭(또는 Enter/Space)하면 href로 이동.
 * href가 null이면 일반(비링크) 행으로 렌더한다.
 */
export function DeadlineRow({
  href,
  className,
  children,
}: {
  href: string | null;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  if (!href) {
    return <tr className={className}>{children}</tr>;
  }

  const go = () => router.push(href);
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  };

  return (
    <tr
      className={`${className ?? ""} row-link`.trim()}
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
    >
      {children}
    </tr>
  );
}

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "cta"
  | "secondary"
  | "ghost"
  | "danger"
  | "ghost-danger";

interface ButtonBaseProps {
  /**
   * primary: 검정 pill — 랜딩/마케팅 1차 CTA 전용
   * cta: cobalt pill — 앱 내부 1차 액션
   * secondary / ghost: 아웃라인
   * danger: critical 솔리드 — 삭제 확정
   * ghost-danger: critical 텍스트 고스트 — 삭제 트리거
   */
  variant?: ButtonVariant;
  size?: "md" | "sm";
  full?: boolean;
  children: ReactNode;
}

type ButtonProps = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkButtonProps = ButtonBaseProps & { href: string; className?: string };

function classes({
  variant = "cta",
  size = "md",
  full = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  full?: boolean;
  className?: string;
}): string {
  return [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : null,
    full ? "btn--full" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  full,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={classes({ variant, size, full, className })} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  full,
  className,
  href,
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} className={classes({ variant, size, full, className })}>
      {children}
    </Link>
  );
}

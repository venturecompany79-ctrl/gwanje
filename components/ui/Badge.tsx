import type { ReactNode } from "react";

type BadgeTone =
  | "success"
  | "attention"
  | "warning"
  | "critical"
  | "neutral"
  | "soft-valid"
  | "soft-soon"
  | "soft-expired";

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={["badge", `badge--${tone}`, className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}

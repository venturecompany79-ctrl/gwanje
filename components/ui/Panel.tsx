import type { ReactNode } from "react";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export function PanelHead({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      {count ? <span className="cnt">{count}</span> : null}
      <div className="spacer" />
      {children}
    </div>
  );
}

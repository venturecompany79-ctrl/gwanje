import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  bare = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** true면 자체 테두리/배경 제거 — 패널 내부(탭 콘텐츠)용 */
  bare?: boolean;
}) {
  return (
    <div className={bare ? "empty empty--bare" : "empty"}>
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

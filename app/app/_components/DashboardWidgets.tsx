import Link from "next/link";
import {
  IconAlert,
  IconBell,
  IconCalendar,
  IconClock,
  IconFile,
  IconTarget,
} from "@/components/ui/icons";
import {
  notificationHref,
  type DashboardAlert,
  type DashboardFile,
} from "@/lib/data/dashboard";
import type { NotificationType } from "@/lib/database.types";

function alertIcon(type: NotificationType, urgent: boolean) {
  if (urgent) {
    return (
      <span className="alert-ico alert-ico--urgent">
        <IconAlert />
      </span>
    );
  }
  switch (type) {
    case "expiry":
      return (
        <span className="alert-ico alert-ico--expiry">
          <IconClock />
        </span>
      );
    case "deadline":
      return (
        <span className="alert-ico alert-ico--deadline">
          <IconCalendar />
        </span>
      );
    case "program_match":
      return (
        <span className="alert-ico alert-ico--match">
          <IconTarget />
        </span>
      );
  }
}

export function DashboardWidgets({
  alerts,
  files,
}: {
  alerts: DashboardAlert[];
  files: DashboardFile[];
}) {
  return (
    <section className="panel monitor-activity" aria-labelledby="activity-title">
      <header className="monitor-section-head monitor-section-head--compact">
        <div className="monitor-section-title">
          <span className="monitor-section-icon">
            <IconBell />
          </span>
          <div>
            <h2 id="activity-title">최근 활동</h2>
            <p>새 알림과 기업 자료를 간결하게 모았습니다.</p>
          </div>
        </div>
      </header>

      <div className="monitor-activity-grid">
        <div className="monitor-activity-group">
          <div className="monitor-activity-label">
            <strong>주요 알림</strong>
            <Link href="/app/notifications">전체 보기</Link>
          </div>
          {alerts.length === 0 ? (
            <div className="monitor-mini-empty">
              <IconBell /> 새 알림이 없습니다
            </div>
          ) : (
            <div className="monitor-activity-list">
              {alerts.slice(0, 3).map((alert) => (
                <Link
                  key={alert.id}
                  href={notificationHref(alert)}
                  className="monitor-activity-item"
                >
                  {alertIcon(alert.type, alert.urgent)}
                  <span className="monitor-activity-copy">
                    <strong>{alert.title}</strong>
                    {alert.sub ? <small>{alert.sub}</small> : null}
                  </span>
                  <time>{alert.timeAgo}</time>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="monitor-activity-group">
          <div className="monitor-activity-label">
            <strong>최근 자료</strong>
            <Link href="/app/companies">기업 보기</Link>
          </div>
          {files.length === 0 ? (
            <div className="monitor-mini-empty">
              <IconFile /> 새로 제출된 자료가 없습니다
            </div>
          ) : (
            <div className="monitor-activity-list">
              {files.slice(0, 3).map((file) => (
                <Link
                  key={file.id}
                  href={`/app/companies/${file.companyId}?tab=files`}
                  className="monitor-activity-item"
                >
                  <span className="monitor-file-type">{file.fileType.slice(0, 3)}</span>
                  <span className="monitor-activity-copy">
                    <strong>{file.name}</strong>
                    <small>{file.companyName}</small>
                  </span>
                  <time className="num">{file.when}</time>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

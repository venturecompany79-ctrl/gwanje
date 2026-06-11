import Link from "next/link";
import {
  IconAlert,
  IconBell,
  IconCalendar,
  IconClock,
  IconFile,
  IconTarget,
} from "@/components/ui/icons";
import type { DashboardAlert, DashboardFile } from "@/lib/data/dashboard";
import type { NotificationType } from "@/lib/database.types";

function alertIcon(type: NotificationType, urgent: boolean) {
  if (urgent) {
    return (
      <div className="alert-ico alert-ico--urgent">
        <IconAlert />
      </div>
    );
  }
  switch (type) {
    case "expiry":
      return (
        <div className="alert-ico alert-ico--expiry">
          <IconClock />
        </div>
      );
    case "deadline":
      return (
        <div className="alert-ico alert-ico--deadline">
          <IconCalendar />
        </div>
      );
    case "program_match":
      return (
        <div className="alert-ico alert-ico--match">
          <IconTarget />
        </div>
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
    <aside className="widgets">
      <section className="panel">
        <div className="wpanel-head">
          <h3>오늘의 알림</h3>
          <div className="spacer" />
          <Link href="/app/notifications">전체</Link>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-w">
            <IconBell />
            <p>아직 알림이 없습니다</p>
          </div>
        ) : (
          <div className="wpanel-body">
            {alerts.map((a) => (
              <div key={a.id} className="alert-item">
                {alertIcon(a.type, a.urgent)}
                <div className="alert-body">
                  <div className="alert-title">{a.title}</div>
                  {a.sub ? <div className="alert-sub">{a.sub}</div> : null}
                </div>
                <div className="alert-time">{a.timeAgo}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="wpanel-head">
          <h3>최근 자료 제출</h3>
          <div className="spacer" />
          <Link href="/app/companies">전체</Link>
        </div>
        {files.length === 0 ? (
          <div className="empty-w">
            <IconFile />
            <p>제출된 자료가 없습니다</p>
          </div>
        ) : (
          <div className="wpanel-body">
            {files.map((f) => (
              <div key={f.id} className="file-item">
                <div className="file-type">{f.fileType}</div>
                <div className="file-body">
                  <div className="file-name">{f.name}</div>
                  <div className="file-co">{f.companyName}</div>
                </div>
                <div className="file-when num">{f.when}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

export default function NotificationsLoading() {
  return (
    <>
      <div className="page-head">
        <div className="skeleton" style={{ width: 160, height: 34 }} />
        <div className="spacer" />
        <div className="skeleton" style={{ width: 150, height: 38, borderRadius: 100 }} />
      </div>
      <div className="filter-bar">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 84, height: 38, borderRadius: 100 }}
          />
        ))}
        <div className="spacer" />
        <div className="skeleton" style={{ width: 130, height: 40, borderRadius: 100 }} />
      </div>
      <div className="inbox">
        <div className="grp-head">
          <div className="skeleton" style={{ width: 60, height: 14 }} />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="notif" style={{ cursor: "default" }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 100 }} />
            <div className="n-body">
              <div className="skeleton" style={{ width: 320, height: 17 }} />
              <div className="skeleton" style={{ width: 120, height: 13, marginTop: 8 }} />
            </div>
            <div className="skeleton" style={{ width: 44, height: 14 }} />
          </div>
        ))}
      </div>
    </>
  );
}

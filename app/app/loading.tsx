export default function DashboardLoading() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="skeleton" style={{ width: 220, height: 34 }} />
          <div
            className="skeleton"
            style={{ width: 320, height: 16, marginTop: 10 }}
          />
        </div>
      </div>
      <div className="kpi-row">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi">
            <div className="skeleton" style={{ width: 90, height: 15 }} />
            <div
              className="skeleton"
              style={{ width: 70, height: 42, marginTop: 14 }}
            />
            <div
              className="skeleton"
              style={{ width: 110, height: 12, marginTop: 9 }}
            />
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="panel" style={{ padding: 22 }}>
          <div className="skeleton" style={{ width: 140, height: 22 }} />
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 44, marginTop: 14 }}
            />
          ))}
        </div>
        <div className="widgets">
          <div className="panel" style={{ padding: 18 }}>
            <div className="skeleton" style={{ width: 100, height: 18 }} />
            <div className="skeleton" style={{ height: 52, marginTop: 14 }} />
            <div className="skeleton" style={{ height: 52, marginTop: 10 }} />
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div className="skeleton" style={{ width: 100, height: 18 }} />
            <div className="skeleton" style={{ height: 46, marginTop: 14 }} />
          </div>
        </div>
      </div>
    </>
  );
}

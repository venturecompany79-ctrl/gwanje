export default function CampaignDetailLoading() {
  return (
    <>
      <div
        className="skeleton"
        style={{ width: 180, height: 16, marginBottom: 16 }}
      />
      <div className="page-head">
        <div className="skeleton" style={{ width: 320, height: 34 }} />
        <div
          className="skeleton"
          style={{ width: 80, height: 26, borderRadius: 100, marginBottom: 5 }}
        />
      </div>
      <div className="kpi-row">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi">
            <div className="skeleton" style={{ width: 60, height: 16 }} />
            <div
              className="skeleton"
              style={{ width: 80, height: 38, marginTop: 14 }}
            />
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head">
          <div className="skeleton" style={{ width: 110, height: 20 }} />
        </div>
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 28 }} />
          ))}
        </div>
      </div>
    </>
  );
}

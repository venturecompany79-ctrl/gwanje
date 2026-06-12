export default function NewCampaignLoading() {
  return (
    <>
      <div
        className="skeleton"
        style={{ width: 180, height: 16, marginBottom: 16 }}
      />
      <div className="panel steps">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 120, height: 30, marginInline: 16, borderRadius: 100 }}
          />
        ))}
      </div>
      <div className="wz-grid">
        <div className="panel">
          <div className="panel-head">
            <div className="skeleton" style={{ width: 110, height: 20 }} />
          </div>
          <div style={{ padding: 22, display: "grid", gap: 12 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 42 }} />
            ))}
          </div>
        </div>
        <div className="panel">
          <div style={{ padding: 18 }}>
            <div className="skeleton" style={{ height: 220 }} />
          </div>
        </div>
      </div>
    </>
  );
}

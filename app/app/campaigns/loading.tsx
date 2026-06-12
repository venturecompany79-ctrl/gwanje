export default function CampaignsLoading() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="skeleton" style={{ width: 140, height: 34 }} />
          <div
            className="skeleton"
            style={{ width: 280, height: 16, marginTop: 10 }}
          />
        </div>
        <div className="spacer" />
        <div
          className="skeleton"
          style={{ width: 130, height: 44, borderRadius: 100 }}
        />
      </div>
      <div className="panel">
        <div className="panel-head">
          <div className="skeleton" style={{ width: 80, height: 20 }} />
        </div>
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 30 }} />
          ))}
        </div>
      </div>
    </>
  );
}

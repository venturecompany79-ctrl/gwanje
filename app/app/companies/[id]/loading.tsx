export default function CompanyDetailLoading() {
  return (
    <>
      <div className="crumb">
        <div className="skeleton" style={{ width: 90, height: 15 }} />
        <span className="sep">/</span>
        <div className="skeleton" style={{ width: 120, height: 15 }} />
      </div>
      <div className="co-header">
        <div className="co-top">
          <div className="skeleton" style={{ width: 220, height: 32 }} />
          <div className="spacer" />
          <div className="skeleton" style={{ width: 88, height: 38, borderRadius: 100 }} />
        </div>
        <div className="co-summary" style={{ gap: 22 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ width: 90, height: 38 }} />
          ))}
        </div>
      </div>
      <div className="tabs">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 96, height: 36, borderRadius: 100 }}
          />
        ))}
      </div>
      <div className="panel" style={{ padding: 22 }}>
        <div className="skeleton" style={{ width: 140, height: 22 }} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 48, marginTop: 14 }} />
        ))}
      </div>
    </>
  );
}

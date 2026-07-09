export default function ShareLoading() {
  return (
    <>
      <div className="share-co-head">
        <div className="skeleton" style={{ width: 220, height: 32 }} />
        <div className="skeleton" style={{ width: 160, height: 15, marginTop: 10 }} />
      </div>
      <div className="kpi-row share-kpi-row">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />
        ))}
      </div>
      <div className="panel share-panel" style={{ padding: 22 }}>
        <div className="skeleton" style={{ width: 140, height: 22 }} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 44, marginTop: 12 }} />
        ))}
      </div>
    </>
  );
}

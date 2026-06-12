export default function SettingsLoading() {
  return (
    <>
      <div className="page-head">
        <div className="skeleton" style={{ width: 100, height: 34 }} />
      </div>
      <div className="set-grid">
        <div className="set-nav">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 42, margin: 3, borderRadius: 8 }}
            />
          ))}
        </div>
        <div className="panel">
          <div className="sp-head">
            <div className="skeleton" style={{ width: 120, height: 22 }} />
            <div
              className="skeleton"
              style={{ width: 280, height: 14, marginTop: 8 }}
            />
          </div>
          <div className="sp-body">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="setrow" style={{ gap: 18 }}>
                <div className="skeleton" style={{ width: 46, height: 30, borderRadius: 100 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: 180, height: 16 }} />
                  <div className="skeleton" style={{ width: 260, height: 12, marginTop: 7 }} />
                </div>
                <div className="skeleton" style={{ width: 46, height: 27, borderRadius: 100 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function BoardLoading() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="skeleton" style={{ width: 200, height: 34 }} />
          <div
            className="skeleton"
            style={{ width: 120, height: 16, marginTop: 10 }}
          />
        </div>
        <div className="spacer" />
        <div className="skeleton" style={{ width: 120, height: 40, borderRadius: 100 }} />
      </div>
      <div className="filter-bar">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 110, height: 40, borderRadius: 100 }}
          />
        ))}
        <div className="spacer" />
        <div className="skeleton" style={{ width: 280, height: 42, borderRadius: 100 }} />
      </div>
      <div className="board">
        {Array.from({ length: 4 }, (_, col) => (
          <div key={col} className="kcol" style={{ minHeight: 420 }}>
            <div className="kcol-head">
              <div className="skeleton" style={{ width: 90, height: 18 }} />
            </div>
            <div className="kcol-body">
              {Array.from({ length: col === 3 ? 1 : 2 }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 124, borderRadius: 8 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

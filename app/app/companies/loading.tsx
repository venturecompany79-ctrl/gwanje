export default function CompaniesLoading() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="skeleton" style={{ width: 120, height: 34 }} />
          <div
            className="skeleton"
            style={{ width: 180, height: 16, marginTop: 10 }}
          />
        </div>
        <div className="spacer" />
        <div className="skeleton" style={{ width: 120, height: 40, borderRadius: 100 }} />
      </div>
      <div className="filter-bar">
        <div className="skeleton" style={{ width: 300, height: 42, borderRadius: 100 }} />
        <div className="skeleton" style={{ width: 70, height: 36, borderRadius: 100 }} />
        <div className="skeleton" style={{ width: 70, height: 36, borderRadius: 100 }} />
      </div>
      <div className="panel" style={{ padding: 22 }}>
        <div className="skeleton" style={{ height: 18, width: "60%" }} />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 46, marginTop: 14 }} />
        ))}
      </div>
    </>
  );
}

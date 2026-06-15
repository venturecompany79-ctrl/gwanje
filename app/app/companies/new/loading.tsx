export default function NewCompanyLoading() {
  return (
    <>
      <div className="crumb">
        <div className="skeleton" style={{ width: 190, height: 18 }} />
      </div>
      <div className="page-head">
        <div>
          <div className="skeleton" style={{ width: 210, height: 34 }} />
          <div
            className="skeleton"
            style={{ width: 320, height: 16, marginTop: 10 }}
          />
        </div>
      </div>
      <div className="intake-layout">
        <div className="intake-main">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="panel" style={{ padding: 22, marginBottom: 18 }}>
              <div className="skeleton" style={{ width: "45%", height: 22 }} />
              <div className="skeleton" style={{ width: "70%", height: 14, marginTop: 12 }} />
              <div className="skeleton" style={{ width: "100%", height: 92, marginTop: 18 }} />
            </div>
          ))}
        </div>
        <div className="intake-side">
          <div className="panel" style={{ padding: 22 }}>
            <div className="skeleton" style={{ width: "70%", height: 22 }} />
            <div className="skeleton" style={{ width: "100%", height: 170, marginTop: 18 }} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function ImportCompaniesLoading() {
  return (
    <>
      <div className="crumb">
        <div className="skeleton" style={{ width: 150, height: 18 }} />
      </div>
      <div className="page-head">
        <div>
          <div className="skeleton" style={{ width: 190, height: 34 }} />
          <div
            className="skeleton"
            style={{ width: 320, height: 16, marginTop: 10 }}
          />
        </div>
      </div>
      <div className="panel" style={{ padding: 24 }}>
        <div className="skeleton" style={{ width: 260, height: 32 }} />
        <div className="skeleton" style={{ width: "60%", height: 16, marginTop: 16 }} />
        <div className="skeleton" style={{ width: "100%", height: 160, marginTop: 18 }} />
      </div>
    </>
  );
}

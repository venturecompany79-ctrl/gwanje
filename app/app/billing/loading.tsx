export default function BillingLoading() {
  return (
    <>
      <div className="page-head">
        <div className="skeleton" style={{ width: 92, height: 34 }} />
      </div>
      <div className="panel" style={{ padding: 22 }}>
        <div className="skeleton" style={{ width: 180, height: 24 }} />
        <div className="skeleton" style={{ height: 56, marginTop: 18 }} />
        <div className="skeleton" style={{ height: 56, marginTop: 12 }} />
        <div className="skeleton" style={{ height: 120, marginTop: 18 }} />
      </div>
    </>
  );
}

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
      <div className="board-tab-row">
        <div className="skeleton" style={{ width: 116, height: 40, borderRadius: 100 }} />
        <div className="skeleton" style={{ width: 104, height: 40, borderRadius: 100 }} />
      </div>
      <div className="todo-board">
        {Array.from({ length: 4 }, (_, i) => (
          <section key={i} className="todo-group">
            <div className="todo-group-head">
              <div>
                <div className="skeleton" style={{ width: 150, height: 22 }} />
                <div
                  className="skeleton"
                  style={{ width: 90, height: 14, marginTop: 9 }}
                />
              </div>
            </div>
            <div className="todo-list">
              <div className="skeleton" style={{ height: 36 }} />
              {i === 0 ? <div className="skeleton" style={{ height: 36 }} /> : null}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

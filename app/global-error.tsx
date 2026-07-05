"use client";

// 루트 레이아웃 렌더 실패 시 최후 방어선 — 자체 html/body를 정의해야 한다.
// globals.css가 로드되지 않을 수 있어 인라인 스타일만 사용한다.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f4f7",
          fontFamily:
            "'Noto Sans KR', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#1c1e21",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>
            일시적인 오류가 발생했습니다
          </h1>
          <p style={{ fontSize: 14, color: "#5d6c7b", marginBottom: 20 }}>
            잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해
            주세요.
          </p>
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 100,
              padding: "10px 24px",
              background: "#0064e0",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}

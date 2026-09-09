"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0a0a0c",
          color: "#edeef1",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "#ff4a1c",
            }}
          >
            Total failure
          </div>
          <h1 style={{ fontSize: "1.25rem", margin: "0.75rem 0 0.5rem" }}>
            Surviver could not start.
          </h1>
          <p style={{ color: "#8b919c", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            {error.digest ? `Reference ${error.digest}. ` : ""}
            Reload the page, or try again shortly.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              background: "#ff4a1c",
              color: "#0a0a0c",
              border: 0,
              borderRadius: 3,
              padding: "0.5rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

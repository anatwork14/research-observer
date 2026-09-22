"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "12vh auto", padding: 24 }}>
          <h1>Research Observer encountered a fatal rendering error.</h1>
          <p>The Markdown source remains unchanged. Retry the interface, then run npm run doctor locally if the problem persists.</p>
          <button onClick={reset}>Retry</button>
        </main>
      </body>
    </html>
  );
}

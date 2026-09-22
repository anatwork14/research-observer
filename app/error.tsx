"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="empty-home">
      <div>
        <p className="eyebrow">Observaire / recovery</p>
        <h1>This research view could not be rendered.</h1>
        <p className="hero-copy">{error.message || "An unexpected rendering error occurred."}</p>
        <button className="search-trigger" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}

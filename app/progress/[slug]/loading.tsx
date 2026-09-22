export default function NoteLoading() {
  return (
    <div className="site-shell route-skeleton" aria-busy="true" aria-label="Loading research note">
      <header className="skeleton-topbar" aria-hidden="true">
        <span className="skeleton-block skeleton-brand" />
        <span className="skeleton-block skeleton-tabs" />
        <span className="skeleton-block skeleton-search" />
      </header>

      <section className="note-loading-overview panel" aria-hidden="true">
        <span className="skeleton-block" />
        <span className="skeleton-block skeleton-heading" />
        <span className="skeleton-block skeleton-summary" />
        <span className="skeleton-block skeleton-meta" />
      </section>

      <main className="note-loading-grid" aria-hidden="true">
        <aside className="skeleton-rail panel">
          {Array.from({ length: 8 }, (_, index) => (
            <span
              className="skeleton-block"
              key={index}
              style={{ height: index === 0 ? 22 : 34, width: index === 0 ? "62%" : "100%" }}
            />
          ))}
        </aside>

        <section className="skeleton-reader panel">
          <span className="skeleton-block" style={{ width: "28%", height: 12 }} />
          <span className="skeleton-block heading" />
          {Array.from({ length: 11 }, (_, index) => (
            <span
              className={`skeleton-block paragraph ${index % 4 === 3 ? "short" : ""}`}
              key={index}
            />
          ))}
        </section>

        <aside className="skeleton-rail panel">
          {Array.from({ length: 9 }, (_, index) => (
            <span
              className="skeleton-block"
              key={index}
              style={{ height: index === 0 ? 18 : 28, width: index % 3 === 2 ? "72%" : "100%" }}
            />
          ))}
        </aside>
      </main>
      <span className="sr-only">Loading research note…</span>
    </div>
  );
}

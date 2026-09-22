export default function PaperLoading() {
  return (
    <div className="site-shell pdf-site-shell route-skeleton" aria-busy="true" aria-label="Loading PDF reader">
      <header className="skeleton-topbar" aria-hidden="true">
        <span className="skeleton-block skeleton-brand" />
        <span className="skeleton-block skeleton-tabs" />
        <span className="skeleton-block skeleton-search" />
      </header>

      <main className="pdf-route-skeleton" aria-hidden="true">
        <section className="pdf-skeleton-toolbar panel">
          <span className="skeleton-block title" />
          <span className="skeleton-block controls" />
          <span className="skeleton-block actions" />
        </section>

        <section className="pdf-skeleton-layout">
          <aside className="pdf-skeleton-thumbs panel">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="skeleton-block pdf-skeleton-thumb" key={index} />
            ))}
          </aside>
          <div className="pdf-skeleton-stage panel">
            <span className="skeleton-block pdf-skeleton-paper" />
          </div>
          <aside className="pdf-skeleton-inspector panel">
            <span className="skeleton-block" />
            {Array.from({ length: 8 }, (_, index) => (
              <span className={`skeleton-block ${index % 3 === 2 ? "short" : ""}`} key={index} />
            ))}
          </aside>
        </section>
      </main>
      <span className="sr-only">Loading PDF research reader…</span>
    </div>
  );
}

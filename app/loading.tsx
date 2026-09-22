export default function Loading() {
  return (
    <div className="site-shell route-skeleton" aria-busy="true" aria-label="Loading Research Observer">
      <header className="skeleton-topbar" aria-hidden="true">
        <span className="skeleton-block skeleton-brand" />
        <span className="skeleton-block skeleton-tabs" />
        <span className="skeleton-block skeleton-search" />
      </header>

      <main>
        <section className="skeleton-hero panel" aria-hidden="true">
          <div className="skeleton-stack">
            <span className="skeleton-block line short" />
            <span className="skeleton-block title" />
            <span className="skeleton-block line" />
            <span className="skeleton-block line short" />
          </div>
          <span className="skeleton-block skeleton-health" />
        </section>

        <section className="skeleton-cards" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span className="skeleton-block skeleton-card" key={index} />
          ))}
        </section>
      </main>
      <span className="sr-only">Loading research workspace…</span>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./LocalWorkspaceHealth.module.css";

type HealthState = "ready" | "attention" | "unavailable";
type HealthCheck = {
  id: string;
  group: string;
  title: string;
  state: HealthState;
  detail: string;
  meta?: string;
  repair?: "rebuild-research" | "prepare-pdf-runtime";
};
type HealthPayload = {
  generatedAt: string;
  maintenanceEnabled: boolean;
  summary: {
    ready: number;
    attention: number;
    unavailable: number;
    overall: "ready" | "partial" | "attention";
  };
  paths: Record<string, string>;
  checks: HealthCheck[];
};

const GROUP_ORDER = ["Core", "Storage", "Generated runtime", "Toolchain", "Integrations"];

function statusLabel(state: HealthState) {
  if (state === "ready") return "Ready";
  if (state === "attention") return "Needs attention";
  return "Optional / unavailable";
}

export function LocalWorkspaceHealth() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("check");
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("check");
    setError("");
    try {
      const response = await fetch("/api/health/local", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not inspect the local workspace.");
      setHealth(payload);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not inspect the local workspace.");
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function checkInitialHealth() {
      try {
        const response = await fetch("/api/health/local", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not inspect the local workspace.");
        if (active) setHealth(payload);
      } catch (nextError) {
        if (active && !(nextError instanceof Error && nextError.name === "AbortError")) {
          setError(nextError instanceof Error ? nextError.message : "Could not inspect the local workspace.");
        }
      } finally {
        if (active) setBusy("");
      }
    }

    void checkInitialHealth();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function repair(action: "rebuild-research" | "prepare-pdf-runtime" | "repair-generated") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(action);
    setError("");
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const response = await fetch("/api/health/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Local maintenance failed.");
      setHealth(payload);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Local maintenance failed.");
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }

  const groups = useMemo(() => {
    if (!health) return [];
    return GROUP_ORDER.map((group) => ({
      group,
      checks: health.checks.filter((check) => check.group === group),
    })).filter((item) => item.checks.length > 0);
  }, [health]);

  return (
    <section className={`${styles.shell} panel`} aria-labelledby="local-workspace-health-heading">
      <div className={styles.heading}>
        <div>
          <span className="kicker">Local workspace</span>
          <h2 id="local-workspace-health-heading">Runtime readiness</h2>
          <p>Inspect the local filesystem, generated runtime assets, toolchains, and optional research integrations without replacing the research-integrity checks below.</p>
        </div>
        <div className={styles.headingActions}>
          {health && (
            <span className={`${styles.summaryBadge} ${styles[health.summary.overall]}`}>
              {health.summary.ready}/{health.checks.length} ready
            </span>
          )}
          <button type="button" className={styles.secondaryButton} onClick={() => void load()} disabled={Boolean(busy)}>
            {busy === "check" ? "Checking…" : "Recheck"}
          </button>
        </div>
      </div>

      {!health && !error && <div className={styles.loading}>Checking local runtime…</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {health && (
        <>
          <div className={styles.overview}>
            <div><span>Ready</span><strong>{health.summary.ready}</strong></div>
            <div><span>Needs attention</span><strong>{health.summary.attention}</strong></div>
            <div><span>Optional unavailable</span><strong>{health.summary.unavailable}</strong></div>
            <div><span>Checked</span><strong>{new Date(health.generatedAt).toLocaleTimeString()}</strong></div>
          </div>

          <div className={styles.groups}>
            {groups.map(({ group, checks }) => (
              <section key={group} className={styles.group} aria-label={group}>
                <h3>{group}</h3>
                <div className={styles.grid}>
                  {checks.map((check) => (
                    <article key={check.id} className={`${styles.card} ${styles[check.state]}`}>
                      <div className={styles.cardHeader}>
                        <span className={styles.statusDot} aria-hidden="true" />
                        <div>
                          <strong>{check.title}</strong>
                          <small>{statusLabel(check.state)}</small>
                        </div>
                      </div>
                      <p>{check.detail}</p>
                      {check.meta && <code>{check.meta}</code>}
                      {check.repair && (
                        <button
                          type="button"
                          className={styles.repairButton}
                          onClick={() => void repair(check.repair!)}
                          disabled={!health.maintenanceEnabled || Boolean(busy)}
                        >
                          {busy === check.repair ? "Repairing…" : check.repair === "rebuild-research" ? "Rebuild research" : "Prepare PDF runtime"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className={styles.paths}>
            <div>
              <strong>Durable paths</strong>
              <span>Research: <code>{health.paths.progress}</code></span>
              <span>Annotations: <code>{health.paths.annotations}</code></span>
              <span>Manuscripts: <code>{health.paths.manuscripts}</code></span>
            </div>
            <div className={styles.maintenance}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void repair("repair-generated")}
                disabled={!health.maintenanceEnabled || Boolean(busy)}
              >
                {busy === "repair-generated" ? "Repairing generated runtime…" : "Rebuild generated runtime"}
              </button>
              <small>
                {health.maintenanceEnabled
                  ? "Rebuilds only disposable research artifacts and local PDF.js runtime assets. Durable research, annotations, and manuscripts are not rewritten."
                  : "Maintenance actions are disabled in this runtime. For a local production build, opt in with OBSERVAIRE_LOCAL_MAINTENANCE=1."}
              </small>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  journal: string;
  doi?: string;
  url: string;
  abstract?: string;
  takeaway?: string;
  studyType?: string;
  citationCount?: number;
  semanticScore?: number;
  fullTextChunks: Array<{ text: string; section?: string }>;
};

type Plan = {
  overview?: string;
  researchGaps?: Array<{ title: string; rationale: string; sourceIds: string[] }>;
  hypotheses?: Array<{
    title: string;
    statement: string;
    falsificationCriterion: string;
    derivedFromGaps: string[];
    sourceIds: string[];
  }>;
  experiments?: Array<{
    title: string;
    hypothesisTitle: string;
    design: string;
    independentVariables: string[];
    dependentVariables: string[];
    controls: string[];
    metrics: string[];
    confounders: string[];
    stoppingCriteria: string[];
  }>;
  nextActions?: string[];
  cautions?: string[];
};

type ServiceState = { enabled: boolean; reason?: string };

function authors(paper: Paper) {
  if (!paper.authors.length) return "Authors unavailable";
  const visible = paper.authors.slice(0, 3).join(", ");
  return paper.authors.length > 3 ? visible + " et al." : visible;
}

function sourceLabel(paper: Paper) {
  return [authors(paper), paper.year, paper.journal].filter(Boolean).join(" · ");
}

export function NewResearchWorkbench() {
  const currentYear = new Date().getFullYear();
  const [consensus, setConsensus] = useState<ServiceState | null>(null);
  const [codex, setCodex] = useState<ServiceState | null>(null);
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [yearMin, setYearMin] = useState(String(currentYear - 6));
  const [yearMax, setYearMax] = useState(String(currentYear));
  const [paperCount, setPaperCount] = useState("12");
  const [includeFullText, setIncludeFullText] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/consensus/search", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
      fetch("/api/research/new/plan", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
    ]).then(([consensusState, codexState]) => {
      setConsensus({ enabled: Boolean(consensusState.enabled), reason: consensusState.reason });
      setCodex({ enabled: Boolean(codexState.enabled), reason: codexState.reason });
    }).catch((requestError) => {
      if ((requestError as Error).name !== "AbortError") {
        setConsensus({ enabled: false, reason: "Consensus status is unavailable." });
        setCodex({ enabled: false, reason: "Codex status is unavailable." });
      }
    });
    return () => controller.abort();
  }, []);

  const selectedPapers = useMemo(
    () => papers.filter((paper) => selected.has(paper.id || paper.url)),
    [papers, selected],
  );

  const evidenceOverview = useMemo(() => {
    if (!papers.length) return null;
    const years = papers.map((paper) => paper.year).filter((year): year is number => Boolean(year));
    const studyTypes = new Map<string, number>();
    const journals = new Map<string, number>();
    for (const paper of papers) {
      if (paper.studyType) studyTypes.set(paper.studyType, (studyTypes.get(paper.studyType) ?? 0) + 1);
      if (paper.journal) journals.set(paper.journal, (journals.get(paper.journal) ?? 0) + 1);
    }
    return {
      yearRange: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "unknown",
      studyTypes: [...studyTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      journals: [...journals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      takeaways: papers.filter((paper) => paper.takeaway).slice(0, 8),
    };
  }, [papers]);

  async function search() {
    if (!topic.trim() || searching) return;
    setSearching(true);
    setError("");
    setPlan(null);
    try {
      const response = await fetch("/api/consensus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: topic.trim(),
          pageSize: Number(paperCount),
          yearMin: Number(yearMin),
          yearMax: Number(yearMax),
          excludePreprints: true,
          includeFullText,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Consensus search failed.");
      const nextPapers = Array.isArray(payload.papers) ? payload.papers : [];
      setPapers(nextPapers);
      setTotalResults(Number(payload.totalResults) || nextPapers.length);
      setSelected(new Set(nextPapers.map((paper: Paper) => paper.id || paper.url)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Consensus search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function buildPlan() {
    if (selectedPapers.length < 2 || planning || !codex?.enabled) return;
    setPlanning(true);
    setError("");
    setPlan(null);
    try {
      const response = await fetch("/api/research/new/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), objective: objective.trim(), papers: selectedPapers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Codex research planning failed.");
      setPlan(payload.plan ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Codex research planning failed.");
    } finally {
      setPlanning(false);
    }
  }

  function togglePaper(paper: Paper) {
    const key = paper.id || paper.url;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="new-research-workbench">
      <section className="new-research-stage panel">
        <div className="new-research-stage-heading">
          <div><span className="stage-number">01</span><div><span className="kicker">Define</span><h2>Research topic</h2></div></div>
          <span className={`service-pill ${consensus?.enabled ? "ready" : ""}`}>Consensus {consensus === null ? "checking" : consensus.enabled ? "ready" : "offline"}</span>
        </div>

        <label className="new-research-field">
          <span>Topic or research question</span>
          <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} placeholder="e.g. Can retrieval-augmented generation reduce hallucinations in medical question answering?" />
        </label>
        <label className="new-research-field">
          <span>Research objective <small>optional</small></span>
          <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} placeholder="What specifically do you want to understand, optimize, compare, or test?" />
        </label>

        <div className="new-research-filters">
          <label><span>From</span><input value={yearMin} onChange={(event) => setYearMin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" /></label>
          <label><span>To</span><input value={yearMax} onChange={(event) => setYearMax(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" /></label>
          <label><span>Papers</span><select value={paperCount} onChange={(event) => setPaperCount(event.target.value)}><option>8</option><option>12</option><option>20</option><option>30</option></select></label>
          <label className="new-research-check"><input type="checkbox" checked={includeFullText} onChange={(event) => setIncludeFullText(event.target.checked)} /><span>Eligible full-text passages</span></label>
        </div>

        {!consensus?.enabled && consensus?.reason && <p className="research-service-note">{consensus.reason}</p>}
        <button className="primary-research-action" onClick={() => void search()} disabled={!consensus?.enabled || searching || !topic.trim()}>
          {searching ? "Searching Consensus…" : "Build Consensus overview"}
        </button>
      </section>

      {papers.length > 0 && (
        <section className="new-research-stage panel">
          <div className="new-research-stage-heading">
            <div><span className="stage-number">02</span><div><span className="kicker">Consensus</span><h2>Evidence overview</h2></div></div>
            <span className="collection-count">{selected.size} selected · {totalResults.toLocaleString()} found</span>
          </div>

          {evidenceOverview && (
            <div className="consensus-overview-grid">
              <article><span>Retrieved</span><strong>{papers.length}</strong><small>peer-reviewed search results</small></article>
              <article><span>Publication span</span><strong>{evidenceOverview.yearRange}</strong><small>among returned papers</small></article>
              <article><span>Study signals</span><strong>{evidenceOverview.studyTypes.length || "—"}</strong><small>study types reported</small></article>
              <article><span>Full-text</span><strong>{papers.filter((paper) => paper.fullTextChunks.length).length}</strong><small>papers with returned passages</small></article>
            </div>
          )}

          {evidenceOverview?.takeaways.length ? (
            <div className="consensus-takeaways">
              <span className="kicker">Consensus-provided takeaways</span>
              {evidenceOverview.takeaways.map((paper) => (
                <blockquote key={paper.id || paper.url}>
                  <p>{paper.takeaway}</p>
                  <cite>{paper.title} · {paper.year ?? "year unavailable"}</cite>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="research-service-note">This Consensus plan did not return per-paper takeaways. The paper abstracts remain available for review and Codex planning.</p>
          )}

          <div className="consensus-paper-list">
            {papers.map((paper) => {
              const key = paper.id || paper.url;
              const checked = selected.has(key);
              return (
                <article className={`consensus-paper-row ${checked ? "selected" : ""}`} key={key}>
                  <label><input type="checkbox" checked={checked} onChange={() => togglePaper(paper)} /><span className="sr-only">Include {paper.title}</span></label>
                  <div className="consensus-paper-copy">
                    <a href={paper.url} target="_blank" rel="noreferrer"><strong>{paper.title}</strong></a>
                    <small>{sourceLabel(paper)}</small>
                    {(paper.takeaway || paper.abstract) && <p>{paper.takeaway || paper.abstract?.slice(0, 280)}</p>}
                    <div className="consensus-paper-meta">
                      {paper.studyType && <span>{paper.studyType}</span>}
                      {paper.citationCount !== undefined && <span>{paper.citationCount.toLocaleString()} citations</span>}
                      {paper.doi && <span>DOI {paper.doi}</span>}
                      {paper.fullTextChunks.length > 0 && <span>{paper.fullTextChunks.length} passages</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="new-research-stage-action">
            <div>
              <strong>Literature packet ready</strong>
              <small>Codex receives only the {selectedPapers.length} papers you keep selected.</small>
              {!codex?.enabled && codex?.reason && <p>{codex.reason}</p>}
            </div>
            <button className="primary-research-action" onClick={() => void buildPlan()} disabled={!codex?.enabled || planning || selectedPapers.length < 2}>
              {planning ? "Codex is designing the research…" : "Continue to hypotheses & experiments"}
            </button>
          </div>
        </section>
      )}

      {plan && (
        <section className="new-research-stage panel research-plan-stage">
          <div className="new-research-stage-heading">
            <div><span className="stage-number">03</span><div><span className="kicker">Codex</span><h2>Research plan</h2></div></div>
            <span className="service-pill ready">read-only proposal</span>
          </div>

          {plan.overview && <div className="research-plan-overview"><span className="kicker">Synthesis</span><p>{plan.overview}</p></div>}

          <div className="research-plan-grid">
            <section>
              <span className="kicker">Research gaps</span>
              {(plan.researchGaps ?? []).map((gap, index) => (
                <article key={`${gap.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gap.title}</h3><p>{gap.rationale}</p><small>Sources: {(gap.sourceIds ?? []).join(", ") || "none cited"}</small></div></article>
              ))}
            </section>
            <section>
              <span className="kicker">Hypotheses</span>
              {(plan.hypotheses ?? []).map((hypothesis, index) => (
                <article key={`${hypothesis.title}-${index}`}><span>H{index + 1}</span><div><h3>{hypothesis.title}</h3><p>{hypothesis.statement}</p><strong>Falsification</strong><small>{hypothesis.falsificationCriterion}</small></div></article>
              ))}
            </section>
          </div>

          <div className="experiment-plan-list">
            <span className="kicker">Experiment designs</span>
            {(plan.experiments ?? []).map((experiment, index) => (
              <article key={`${experiment.title}-${index}`} className="experiment-plan-card">
                <div><span>E{String(index + 1).padStart(2, "0")}</span><div><h3>{experiment.title}</h3><small>Tests: {experiment.hypothesisTitle}</small></div></div>
                <p>{experiment.design}</p>
                <dl>
                  <div><dt>Independent</dt><dd>{(experiment.independentVariables ?? []).join(", ") || "—"}</dd></div>
                  <div><dt>Dependent</dt><dd>{(experiment.dependentVariables ?? []).join(", ") || "—"}</dd></div>
                  <div><dt>Metrics</dt><dd>{(experiment.metrics ?? []).join(", ") || "—"}</dd></div>
                  <div><dt>Controls</dt><dd>{(experiment.controls ?? []).join(", ") || "—"}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="research-plan-footer">
            <div><span className="kicker">Next actions</span><ol>{(plan.nextActions ?? []).map((action) => <li key={action}>{action}</li>)}</ol></div>
            {(plan.cautions ?? []).length > 0 && <div><span className="kicker">Cautions</span><ul>{plan.cautions?.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>}
          </div>
        </section>
      )}

      {error && <p className="new-research-error" role="alert">{error}</p>}
    </div>
  );
}

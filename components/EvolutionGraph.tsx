"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { traceEvolutionNeighborhood } from "@/lib/research/evolution-trace.mjs";
import styles from "./EvolutionGraph.module.css";

type EvolutionNode = {
  id: string;
  kind: "research" | "paper" | "annotation" | "manuscript" | "passage" | "citation" | "revision";
  label: string;
  research: string;
  role?: string;
  href?: string;
  type?: string;
  status?: string;
  page?: number;
  annotationType?: string;
  key?: string;
  file?: string;
  line?: number;
  lineEnd?: number;
  column?: number;
  section?: string;
  sectionLevel?: string;
  excerpt?: string;
  shortCommit?: string;
  author?: string;
  date?: string;
  added?: number;
  removed?: number;
};

type EvolutionEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  layer: "semantic" | "reference" | "source" | "version" | "citation";
  explicit: boolean;
};

type NodePosition = { x: number; y: number; width: number; height: number };

const LANE_ORDER = ["paper", "annotation", "research", "citation", "passage", "manuscript", "revision"] as const;
const LANE_WIDTH = 244;
const LANE_GAP = 18;
const NODE_WIDTH = 210;
const NODE_HEIGHT = 52;
const MAX_VISIBLE_PER_LANE = 90;
const TRACE_DEPTH = 6;
const LANE_LABELS: Record<string, string> = {
  paper: "Papers",
  annotation: "Annotations",
  research: "Research objects",
  citation: "Citations",
  passage: "Manuscript passages",
  manuscript: "Manuscripts",
  revision: "Revisions",
};
const LAYER_LABELS: Record<EvolutionEdge["layer"], string> = {
  source: "Source provenance",
  semantic: "Semantic",
  version: "Versions & revisions",
  citation: "Citations",
  reference: "References",
};

function short(value: string, max = 30) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function edgePath(source: NodePosition, target: NodePosition) {
  const sourceRight = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetY = target.y + target.height / 2;

  if (source.x === target.x) {
    const targetRight = target.x + target.width;
    const railX = Math.max(sourceRight, targetRight) + Math.min(86, Math.max(34, Math.abs(targetY - sourceY) * 0.2));
    return `M ${sourceRight} ${sourceY} C ${railX} ${sourceY}, ${railX} ${targetY}, ${targetRight} ${targetY}`;
  }

  const targetLeft = target.x;
  const horizontal = targetLeft - sourceRight;
  const bend = Math.max(28, Math.abs(horizontal) * 0.45);
  const sourceControl = horizontal >= 0 ? sourceRight + bend : sourceRight - bend;
  const targetControl = horizontal >= 0 ? targetLeft - bend : targetLeft + bend;
  return `M ${sourceRight} ${sourceY} C ${sourceControl} ${sourceY}, ${targetControl} ${targetY}, ${targetLeft} ${targetY}`;
}

function visualNodeCompare(a: EvolutionNode, b: EvolutionNode) {
  if (a.kind === "research" && b.kind === "research") {
    return (a.role || "").localeCompare(b.role || "") || a.label.localeCompare(b.label);
  }
  if (a.kind === "revision" && b.kind === "revision") return (a.date || "").localeCompare(b.date || "");
  if (a.kind === "passage" && b.kind === "passage") {
    return (a.file || "").localeCompare(b.file || "") || (a.line || 0) - (b.line || 0);
  }
  return a.label.localeCompare(b.label);
}

export function EvolutionGraph({ nodes, edges }: { nodes: EvolutionNode[]; edges: EvolutionEdge[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [layers, setLayers] = useState<Set<EvolutionEdge["layer"]>>(
    new Set(["source", "semantic", "version", "citation"]),
  );

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const enabledEdges = useMemo(() => edges.filter((edge) => layers.has(edge.layer)), [edges, layers]);
  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of enabledEdges) {
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
    }
    return counts;
  }, [enabledEdges]);
  const selectedTrace = useMemo(
    () => traceEvolutionNeighborhood(enabledEdges, selected, TRACE_DEPTH),
    [enabledEdges, selected],
  );
  const needle = query.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!needle) return new Set<string>();
    return new Set(nodes
      .filter((node) => [
        node.label,
        node.kind,
        node.role || "",
        node.type || "",
        node.status || "",
        node.shortCommit || "",
        node.author || "",
        node.file || "",
        node.section || "",
        node.excerpt || "",
      ].some((value) => value.toLowerCase().includes(needle)))
      .map((node) => node.id));
  }, [needle, nodes]);
  const filteredNodes = useMemo(() => {
    if (!needle) return nodes;
    const expanded = new Set(matchIds);
    for (const edge of enabledEdges) {
      if (matchIds.has(edge.source)) expanded.add(edge.target);
      if (matchIds.has(edge.target)) expanded.add(edge.source);
    }
    return nodes.filter((node) => expanded.has(node.id));
  }, [enabledEdges, matchIds, needle, nodes]);

  const fullLaneCounts = useMemo(() => {
    const counts = new Map<string, number>(LANE_ORDER.map((lane) => [lane, 0] as [string, number]));
    for (const node of filteredNodes) counts.set(node.kind, (counts.get(node.kind) || 0) + 1);
    return counts;
  }, [filteredNodes]);

  const displayNodes = useMemo(() => {
    const grouped = new Map<string, EvolutionNode[]>(LANE_ORDER.map((lane) => [lane, []] as [string, EvolutionNode[]]));
    for (const node of filteredNodes) grouped.get(node.kind)?.push(node);
    const visible: EvolutionNode[] = [];
    for (const lane of LANE_ORDER) {
      const items = grouped.get(lane) || [];
      items.sort((a, b) => {
        if (a.id === selected) return -1;
        if (b.id === selected) return 1;
        const aTrace = selectedTrace.has(a.id);
        const bTrace = selectedTrace.has(b.id);
        if (aTrace !== bTrace) return aTrace ? -1 : 1;
        const aMatch = matchIds.has(a.id);
        const bMatch = matchIds.has(b.id);
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
        const degreeDelta = (degree.get(b.id) || 0) - (degree.get(a.id) || 0);
        return degreeDelta || visualNodeCompare(a, b);
      });
      visible.push(...items.slice(0, MAX_VISIBLE_PER_LANE));
    }
    return visible;
  }, [degree, filteredNodes, matchIds, selected, selectedTrace]);

  const hiddenNodeCount = filteredNodes.length - displayNodes.length;
  const visibleIds = useMemo(() => new Set(displayNodes.map((node) => node.id)), [displayNodes]);
  const visibleEdges = useMemo(
    () => enabledEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [enabledEdges, visibleIds],
  );

  const lanes = useMemo(() => {
    const grouped = new Map<string, EvolutionNode[]>();
    for (const lane of LANE_ORDER) grouped.set(lane, []);
    for (const node of displayNodes) grouped.get(node.kind)?.push(node);
    for (const items of grouped.values()) items.sort(visualNodeCompare);
    return grouped;
  }, [displayNodes]);

  const layout = useMemo(() => {
    const top = 82;
    const rowHeight = 72;
    const positions = new Map<string, NodePosition>();
    let maxRows = 1;
    LANE_ORDER.forEach((lane, laneIndex) => {
      const items = lanes.get(lane) || [];
      maxRows = Math.max(maxRows, items.length);
      items.forEach((node, rowIndex) => {
        positions.set(node.id, {
          x: 24 + laneIndex * (LANE_WIDTH + LANE_GAP),
          y: top + rowIndex * rowHeight,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        });
      });
    });
    return {
      positions,
      width: 24 + LANE_ORDER.length * LANE_WIDTH + (LANE_ORDER.length - 1) * LANE_GAP + 24,
      height: Math.max(560, top + maxRows * rowHeight + 70),
    };
  }, [lanes]);

  const connected = useMemo(
    () => traceEvolutionNeighborhood(visibleEdges, selected, TRACE_DEPTH),
    [selected, visibleEdges],
  );
  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const selectedEdges = selected
    ? visibleEdges.filter((edge) => edge.source === selected || edge.target === selected)
    : [];

  function toggleLayer(layer: EvolutionEdge["layer"]) {
    setLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  return (
    <section className={styles.shell}>
      <div className={styles.toolbar}>
        <div>
          <span className={styles.kicker}>Provenance graph</span>
          <strong>Trace research into cited manuscript passages and committed revisions</strong>
          <small className={styles.scopeNote} aria-live="polite">
            {selected
              ? `${connected.size} nodes in selected trace · ${visibleEdges.length} visible edges`
              : hiddenNodeCount > 0
                ? `Showing ${displayNodes.length} of ${filteredNodes.length} matching/connected nodes. Search narrows the complete projection.`
                : `${displayNodes.length} nodes · ${visibleEdges.length} visible edges`}
          </small>
        </div>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected("");
          }}
          placeholder="Filter papers, evidence, citations, passages, revisions…"
          aria-label="Filter provenance graph"
        />
        <div className={styles.layers} aria-label="Graph layers">
          {(Object.keys(LAYER_LABELS) as EvolutionEdge["layer"][]).map((layer) => (
            <button key={layer} type="button" aria-pressed={layers.has(layer)} onClick={() => toggleLayer(layer)}>
              {LAYER_LABELS[layer]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scroller}>
        <svg className={styles.canvas} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ minWidth: `${layout.width}px` }} role="img" aria-label="Research provenance graph">
          <defs>
            <marker id="evolution-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrow} />
            </marker>
          </defs>

          {LANE_ORDER.map((lane, index) => {
            const x = 24 + index * (LANE_WIDTH + LANE_GAP);
            const shown = lanes.get(lane)?.length || 0;
            const total = fullLaneCounts.get(lane) || 0;
            return (
              <g key={lane}>
                <rect x={x - 8} y={18} width={226} height={layout.height - 36} rx={14} className={styles.lane} />
                <text x={x} y={48} className={styles.laneTitle}>{LANE_LABELS[lane]}</text>
                <text x={x} y={64} className={styles.laneCount}>{shown === total ? `${shown} nodes` : `${shown} / ${total} nodes`}</text>
              </g>
            );
          })}

          {visibleEdges.map((edge) => {
            const source = layout.positions.get(edge.source);
            const target = layout.positions.get(edge.target);
            if (!source || !target) return null;
            const active = !selected || (connected.has(edge.source) && connected.has(edge.target));
            return (
              <path
                key={edge.id}
                d={edgePath(source, target)}
                className={`${styles.edge} ${styles[`layer_${edge.layer}`]} ${active ? "" : styles.dim}`}
                markerEnd="url(#evolution-arrow)"
              />
            );
          })}

          {[...layout.positions].map(([id, point]) => {
            const node = nodeById.get(id);
            if (!node) return null;
            const active = !selected || connected.has(id);
            const isSelected = selected === id;
            const secondary = node.kind === "revision"
              ? [node.shortCommit, node.added !== undefined ? `+${node.added}` : "", node.removed !== undefined ? `−${node.removed}` : ""].filter(Boolean).join(" · ")
              : node.kind === "passage"
                ? [node.section || "unsectioned", node.line && node.lineEnd && node.lineEnd !== node.line ? `lines ${node.line}–${node.lineEnd}` : node.line ? `line ${node.line}` : ""].filter(Boolean).join(" · ")
                : [node.role || node.kind, node.type, node.status].filter(Boolean).join(" · ");
            return (
              <g
                key={id}
                className={`${styles.node} ${active ? "" : styles.dim} ${isSelected ? styles.selected : ""}`}
                data-kind={node.kind}
                data-role={node.role || ""}
                tabIndex={0}
                role="button"
                aria-label={`${node.kind}: ${node.label}`}
                onClick={() => setSelected((current) => current === id ? "" : id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected((current) => current === id ? "" : id);
                  }
                }}
              >
                <rect x={point.x} y={point.y} width={point.width} height={point.height} rx={10} />
                <text x={point.x + 12} y={point.y + 20} className={styles.nodeLabel}>{short(node.label)}</text>
                <text x={point.x + 12} y={point.y + 38} className={styles.nodeMeta}>{short(secondary, 34)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside className={styles.inspector} data-open={Boolean(selectedNode)}>
        {selectedNode ? (
          <>
            <div className={styles.inspectorHeader}>
              <div><span>{selectedNode.kind}</span><strong>{selectedNode.label}</strong></div>
              <button type="button" onClick={() => setSelected("")} aria-label="Clear selection">×</button>
            </div>
            <div className={styles.meta}>
              {selectedNode.role && <span>{selectedNode.role}</span>}
              {selectedNode.type && <span>{selectedNode.type}</span>}
              {selectedNode.status && <span>{selectedNode.status}</span>}
              {selectedNode.page && <span>page {selectedNode.page}</span>}
              {selectedNode.file && <span>{selectedNode.file}</span>}
              {selectedNode.section && <span>{selectedNode.sectionLevel ? `${selectedNode.sectionLevel}: ` : ""}{selectedNode.section}</span>}
              {selectedNode.line && <span>{selectedNode.lineEnd && selectedNode.lineEnd !== selectedNode.line ? `lines ${selectedNode.line}–${selectedNode.lineEnd}` : `line ${selectedNode.line}`}</span>}
              {selectedNode.shortCommit && <span>{selectedNode.shortCommit}</span>}
              {selectedNode.date && <span>{selectedNode.date.slice(0, 10)}</span>}
              {selectedNode.author && <span>{selectedNode.author}</span>}
            </div>
            {selectedNode.excerpt && <p className={styles.excerpt}>{selectedNode.excerpt}</p>}
            <div className={styles.connections}>
              {selectedEdges.map((edge) => {
                const outgoing = edge.source === selectedNode.id;
                const other = nodeById.get(outgoing ? edge.target : edge.source);
                return other ? (
                  <button key={edge.id} type="button" onClick={() => setSelected(other.id)}>
                    <span>{outgoing ? edge.type : `← ${edge.type}`}</span>
                    <strong>{other.label}</strong>
                  </button>
                ) : null;
              })}
              {!selectedEdges.length && <p>No direct connections in the enabled visible layers.</p>}
            </div>
            {selectedNode.href && (
              <button className={styles.open} type="button" onClick={() => router.push(selectedNode.href!)}>
                {selectedNode.kind === "revision" ? "Open current manuscript" : selectedNode.kind === "passage" || selectedNode.kind === "citation" ? "Open manuscript location" : "Open source"}
              </button>
            )}
          </>
        ) : (
          <p className={styles.empty}>Select a node to trace its source, semantic, citation, passage, manuscript, and revision path.</p>
        )}
      </aside>
    </section>
  );
}
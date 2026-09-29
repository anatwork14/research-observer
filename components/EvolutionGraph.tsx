"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./EvolutionGraph.module.css";

type EvolutionNode = {
  id: string;
  kind: "research" | "paper" | "annotation" | "manuscript" | "citation" | "revision";
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

const LANE_ORDER = ["paper", "annotation", "research", "citation", "manuscript", "revision"] as const;
const LANE_WIDTH = 244;
const LANE_GAP = 18;
const NODE_WIDTH = 210;
const NODE_HEIGHT = 52;
const LANE_LABELS: Record<string, string> = {
  paper: "Papers",
  annotation: "Annotations",
  research: "Research objects",
  citation: "Citations",
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

export function EvolutionGraph({ nodes, edges }: { nodes: EvolutionNode[]; edges: EvolutionEdge[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [layers, setLayers] = useState<Set<EvolutionEdge["layer"]>>(
    new Set(["source", "semantic", "version", "citation"]),
  );

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    const matches = new Set(nodes.filter((node) => [node.label, node.kind, node.role || "", node.type || "", node.status || "", node.shortCommit || "", node.author || ""]
      .some((value) => value.toLowerCase().includes(needle))).map((node) => node.id));
    const expanded = new Set(matches);
    for (const edge of edges) {
      if (matches.has(edge.source)) expanded.add(edge.target);
      if (matches.has(edge.target)) expanded.add(edge.source);
    }
    return nodes.filter((node) => expanded.has(node.id));
  }, [edges, nodes, query]);

  const visibleIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => layers.has(edge.layer) && visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [edges, layers, visibleIds],
  );

  const lanes = useMemo(() => {
    const grouped = new Map<string, EvolutionNode[]>();
    for (const lane of LANE_ORDER) grouped.set(lane, []);
    for (const node of filteredNodes) grouped.get(node.kind)?.push(node);
    for (const items of grouped.values()) {
      items.sort((a, b) => {
        if (a.kind === "research" && b.kind === "research") {
          return (a.role || "").localeCompare(b.role || "") || a.label.localeCompare(b.label);
        }
        if (a.kind === "revision" && b.kind === "revision") return (a.date || "").localeCompare(b.date || "");
        return a.label.localeCompare(b.label);
      });
    }
    return grouped;
  }, [filteredNodes]);

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

  const connected = useMemo(() => {
    if (!selected) return new Set<string>();
    const next = new Set([selected]);
    for (const edge of visibleEdges) {
      if (edge.source === selected) next.add(edge.target);
      if (edge.target === selected) next.add(edge.source);
    }
    return next;
  }, [selected, visibleEdges]);

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
          <strong>Trace research into the manuscript and its committed revisions</strong>
        </div>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter papers, evidence, claims, citations, revisions…"
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
            return (
              <g key={lane}>
                <rect x={x - 8} y={18} width={226} height={layout.height - 36} rx={14} className={styles.lane} />
                <text x={x} y={48} className={styles.laneTitle}>{LANE_LABELS[lane]}</text>
                <text x={x} y={64} className={styles.laneCount}>{lanes.get(lane)?.length || 0} nodes</text>
              </g>
            );
          })}

          {visibleEdges.map((edge) => {
            const source = layout.positions.get(edge.source);
            const target = layout.positions.get(edge.target);
            if (!source || !target) return null;
            const active = !selected || edge.source === selected || edge.target === selected;
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
              {selectedNode.shortCommit && <span>{selectedNode.shortCommit}</span>}
              {selectedNode.date && <span>{selectedNode.date.slice(0, 10)}</span>}
              {selectedNode.author && <span>{selectedNode.author}</span>}
            </div>
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
              {!selectedEdges.length && <p>No visible connections in the enabled layers.</p>}
            </div>
            {selectedNode.href && <button className={styles.open} type="button" onClick={() => router.push(selectedNode.href!)}>Open source</button>}
          </>
        ) : (
          <p className={styles.empty}>Select a node to inspect its source, semantic, version, citation, and revision connections.</p>
        )}
      </aside>
    </section>
  );
}

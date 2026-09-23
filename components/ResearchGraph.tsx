"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clampGraphPoint,
  fitGraphViewport,
  graphDegreeMap,
  graphNeighborhood,
  initialGraphPositions,
} from "@/lib/research/graph-layout.mjs";
import styles from "./ResearchGraph.module.css";

type GraphNode = {
  slug: string;
  title: string;
  type?: string;
  status?: string;
  research: string;
  order: number;
};

type GraphEdge = {
  source: string;
  target: string;
  type: string;
  explicit: boolean;
};

type Point = { x: number; y: number };
type Velocity = { x: number; y: number };
type ForceState = { center: number; repel: number; link: number; distance: number };

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 720;
const MAX_GLOBAL_NODES = 140;
const STORAGE_KEY = "observaire-graph-pins-v1";
const DEFAULT_FORCES: ForceState = { center: 0.7, repel: 1, link: 0.85, distance: 150 };

function truncate(value: string, length = 28) {
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ResearchGraph({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const router = useRouter();
  const viewportRef = useRef<SVGGElement>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const velocitiesRef = useRef<Record<string, Velocity>>({});
  const dragRef = useRef<{ slug: string; pointerId: number } | null>(null);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  const [positions, setPositions] = useState<Record<string, Point>>(() => initialGraphPositions(nodes));
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [hovered, setHovered] = useState<string>("");
  const [localMode, setLocalMode] = useState(false);
  const [depth, setDepth] = useState(1);
  const [showTyped, setShowTyped] = useState(true);
  const [showReferences, setShowReferences] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showArrows, setShowArrows] = useState(true);
  const [physics, setPhysics] = useState(true);
  const [forces, setForces] = useState<ForceState>(DEFAULT_FORCES);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const degree = useMemo(() => graphDegreeMap(nodes, edges), [nodes, edges]);
  const nodeBySlug = useMemo(() => new Map(nodes.map((node) => [node.slug, node])), [nodes]);

  const eligibleEdges = useMemo(
    () => edges.filter((edge) => (edge.explicit ? showTyped : showReferences)),
    [edges, showReferences, showTyped],
  );

  const searchNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((node) =>
      [node.title, node.slug, node.type ?? "", node.status ?? "", node.research]
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [nodes, query]);

  const localSlugs = useMemo(() => {
    if (!localMode || !selected) return null;
    return graphNeighborhood(eligibleEdges, selected, depth);
  }, [depth, eligibleEdges, localMode, selected]);

  const candidateNodes = useMemo(() => {
    const scoped = localSlugs ? searchNodes.filter((node) => localSlugs.has(node.slug)) : searchNodes;
    if (scoped.length <= MAX_GLOBAL_NODES) return scoped;

    const ranked = scoped.slice().sort((a, b) => {
      if (a.slug === selected) return -1;
      if (b.slug === selected) return 1;
      return (degree.get(b.slug) ?? 0) - (degree.get(a.slug) ?? 0) || a.order - b.order;
    });
    return ranked.slice(0, MAX_GLOBAL_NODES);
  }, [degree, localSlugs, searchNodes, selected]);

  const visibleSlugs = useMemo(() => new Set(candidateNodes.map((node) => node.slug)), [candidateNodes]);
  const visibleEdges = useMemo(
    () => eligibleEdges.filter((edge) => visibleSlugs.has(edge.source) && visibleSlugs.has(edge.target)),
    [eligibleEdges, visibleSlugs],
  );

  const focusSlug = hovered || selected;
  const focusNeighbors = useMemo(
    () => focusSlug ? graphNeighborhood(visibleEdges, focusSlug, 1) : new Set<string>(),
    [focusSlug, visibleEdges],
  );

  const selectedNode = selected ? nodeBySlug.get(selected) : undefined;
  const selectedConnections = useMemo(() => {
    if (!selected) return [];
    return edges
      .filter((edge) => edge.source === selected || edge.target === selected)
      .map((edge) => {
        const outgoing = edge.source === selected;
        const other = nodeBySlug.get(outgoing ? edge.target : edge.source);
        return { edge, outgoing, other };
      })
      .filter((item) => item.other)
      .sort((a, b) => Number(b.edge.explicit) - Number(a.edge.explicit) || a.edge.type.localeCompare(b.edge.type));
  }, [edges, nodeBySlug, selected]);

  useEffect(() => {
    const seeded = initialGraphPositions(nodes);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- replace stale node positions when the graph data changes
    setPositions((current) => {
      const next = { ...seeded };
      for (const node of nodes) if (current[node.slug]) next[node.slug] = current[node.slug];
      return next;
    });
  }, [nodes]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { positions?: Record<string, Point>; pinned?: string[] };
      const allowed = new Set(nodes.map((node) => node.slug));
      const nextPinned = new Set((parsed.pinned ?? []).filter((slug) => allowed.has(slug)));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore optional persisted graph controls after hydration
      setPinned(nextPinned);
      setPositions((current) => {
        const next = { ...current };
        for (const slug of nextPinned) {
          const point = parsed.positions?.[slug];
          if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) next[slug] = clampGraphPoint(point);
        }
        return next;
      });
    } catch {
      // Saved graph layout is optional UI state.
    }
  }, [nodes]);

  useEffect(() => {
    const fitted = fitGraphViewport(positions, visibleSlugs, WORLD_WIDTH, WORLD_HEIGHT);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recalculate the initial viewport after graph scope changes
    setZoom(fitted.zoom);
    setPan({ x: fitted.panX, y: fitted.panY });
    // Fit only when the graph scope changes; positions intentionally stay user-controlled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMode, depth, query, showTyped, showReferences]);

  useEffect(() => {
    if (!physics || candidateNodes.length < 2) return;
    let frame = 0;
    let cancelled = false;
    const maxFrames = 360;

    function tick() {
      if (cancelled || frame >= maxFrames) return;
      frame += 1;
      setPositions((current) => {
        const next = { ...current };
        const velocity = velocitiesRef.current;
        const active = candidateNodes.filter((node) => next[node.slug]);

        for (const node of active) {
          velocity[node.slug] ??= { x: 0, y: 0 };
          if (pinned.has(node.slug)) {
            velocity[node.slug] = { x: 0, y: 0 };
            continue;
          }
          const point = next[node.slug];
          velocity[node.slug].x += -point.x * 0.00045 * forces.center;
          velocity[node.slug].y += -point.y * 0.00045 * forces.center;
        }

        for (let i = 0; i < active.length; i += 1) {
          const a = active[i];
          const pa = next[a.slug];
          for (let j = i + 1; j < active.length; j += 1) {
            const b = active[j];
            const pb = next[b.slug];
            let dx = pa.x - pb.x;
            let dy = pa.y - pb.y;
            let distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < 1) {
              dx = (i % 2 ? 1 : -1) * 0.5;
              dy = (j % 2 ? 1 : -1) * 0.5;
              distanceSquared = dx * dx + dy * dy;
            }
            const distance = Math.sqrt(distanceSquared);
            const repel = Math.min(1.6, (5200 * forces.repel) / Math.max(900, distanceSquared));
            const ux = dx / distance;
            const uy = dy / distance;
            if (!pinned.has(a.slug)) {
              velocity[a.slug].x += ux * repel;
              velocity[a.slug].y += uy * repel;
            }
            if (!pinned.has(b.slug)) {
              velocity[b.slug].x -= ux * repel;
              velocity[b.slug].y -= uy * repel;
            }

            const minDistance = 66 + Math.min(30, Math.sqrt((degree.get(a.slug) ?? 0) + (degree.get(b.slug) ?? 0)) * 4);
            if (distance < minDistance) {
              const push = (minDistance - distance) * 0.018;
              if (!pinned.has(a.slug)) {
                velocity[a.slug].x += ux * push;
                velocity[a.slug].y += uy * push;
              }
              if (!pinned.has(b.slug)) {
                velocity[b.slug].x -= ux * push;
                velocity[b.slug].y -= uy * push;
              }
            }
          }
        }

        for (const edge of visibleEdges) {
          const source = next[edge.source];
          const target = next[edge.target];
          if (!source || !target) continue;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const desired = forces.distance * (edge.explicit ? 1 : 1.15);
          const pull = (distance - desired) * 0.0025 * forces.link * (edge.explicit ? 1 : 0.55);
          const ux = dx / distance;
          const uy = dy / distance;
          if (!pinned.has(edge.source)) {
            velocity[edge.source].x += ux * pull;
            velocity[edge.source].y += uy * pull;
          }
          if (!pinned.has(edge.target)) {
            velocity[edge.target].x -= ux * pull;
            velocity[edge.target].y -= uy * pull;
          }
        }

        for (const node of active) {
          if (pinned.has(node.slug)) continue;
          const speed = velocity[node.slug];
          speed.x *= 0.82;
          speed.y *= 0.82;
          next[node.slug] = clampGraphPoint({
            x: next[node.slug].x + speed.x,
            y: next[node.slug].y + speed.y,
          });
        }
        return next;
      });
      requestAnimationFrame(tick);
    }

    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [candidateNodes, degree, forces, physics, pinned, visibleEdges]);

  function persistPinned(nextPinned = pinned, nextPositions = positions) {
    try {
      const savedPositions = Object.fromEntries(
        [...nextPinned].filter((slug) => nextPositions[slug]).map((slug) => [slug, nextPositions[slug]]),
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pinned: [...nextPinned], positions: savedPositions }));
    } catch {
      // Persistence is optional.
    }
  }

  function graphPoint(event: React.PointerEvent<SVGGElement>) {
    const matrix = viewportRef.current?.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  }

  function startNodeDrag(event: React.PointerEvent<SVGGElement>, slug: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { slug, pointerId: event.pointerId };
    setSelected(slug);
    setPinned((current) => new Set(current).add(slug));
  }

  function moveNode(event: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = graphPoint(event);
    if (!point) return;
    setPositions((current) => ({ ...current, [drag.slug]: clampGraphPoint(point) }));
  }

  function finishNodeDrag(event: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setPinned((current) => {
      persistPinned(current, positions);
      return current;
    });
  }

  function startPan(event: React.PointerEvent<SVGRectElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function movePan(event: React.PointerEvent<SVGRectElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const scale = WORLD_WIDTH / Math.max(1, canvasRef.current?.clientWidth ?? WORLD_WIDTH);
    setPan({
      x: drag.panX + (event.clientX - drag.x) * scale,
      y: drag.panY + (event.clientY - drag.y) * scale,
    });
  }

  function endPan(event: React.PointerEvent<SVGRectElement>) {
    if (panDragRef.current?.pointerId === event.pointerId) panDragRef.current = null;
  }

  function fitVisible() {
    const fitted = fitGraphViewport(positions, visibleSlugs, WORLD_WIDTH, WORLD_HEIGHT);
    setZoom(fitted.zoom);
    setPan({ x: fitted.panX, y: fitted.panY });
  }

  function resetLayout() {
    const seeded = initialGraphPositions(nodes);
    velocitiesRef.current = {};
    setPositions(seeded);
    setPinned(new Set());
    setPhysics(true);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    const fitted = fitGraphViewport(seeded, visibleSlugs, WORLD_WIDTH, WORLD_HEIGHT);
    setZoom(fitted.zoom);
    setPan({ x: fitted.panX, y: fitted.panY });
  }

  function unpinAll() {
    const next = new Set<string>();
    setPinned(next);
    persistPinned(next, positions);
    setPhysics(true);
  }

  function updateForce(key: keyof ForceState, value: number) {
    setForces((current) => ({ ...current, [key]: value }));
  }

  const hiddenCount = Math.max(0, searchNodes.length - candidateNodes.length);

  return (
    <section className={`${styles.shell} panel`} aria-label="Interactive typed research graph">
      <svg
        ref={canvasRef}
        className={styles.canvas}
        viewBox={`${-WORLD_WIDTH / 2} ${-WORLD_HEIGHT / 2} ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((current) => clamp(current * Math.exp(-event.deltaY * 0.0012), 0.32, 3.4));
        }}
      >
        <defs>
          <marker id="observaire-graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrow} />
          </marker>
        </defs>

        <rect
          className={styles.background}
          x={-WORLD_WIDTH / 2}
          y={-WORLD_HEIGHT / 2}
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        />

        <g ref={viewportRef} className={styles.viewport} transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {visibleEdges.map((edge, index) => {
            const source = positions[edge.source];
            const target = positions[edge.target];
            if (!source || !target) return null;
            const involved = !focusSlug || edge.source === focusSlug || edge.target === focusSlug;
            const className = [
              styles.edge,
              edge.explicit ? styles.edgeTyped : styles.edgeReference,
              focusSlug && !involved ? styles.edgeDim : "",
              focusSlug && involved ? styles.edgeActive : "",
            ].filter(Boolean).join(" ");
            const showEdgeLabel = edge.explicit && involved && Boolean(focusSlug);
            return (
              <g key={`${edge.source}-${edge.type}-${edge.target}-${index}`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={className}
                  markerEnd={showArrows && edge.explicit ? "url(#observaire-graph-arrow)" : undefined}
                />
                {showEdgeLabel && (
                  <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 7} className={styles.edgeLabel} textAnchor="middle">
                    {edge.type}
                  </text>
                )}
              </g>
            );
          })}

          {candidateNodes.map((node) => {
            const point = positions[node.slug];
            if (!point) return null;
            const connections = degree.get(node.slug) ?? 0;
            const radius = Math.min(35, 18 + Math.sqrt(connections) * 3.2);
            const related = !focusSlug || focusNeighbors.has(node.slug);
            const active = selected === node.slug;
            const labelVisible = showLabels && (zoom >= 0.62 || active || hovered === node.slug);
            const className = [
              styles.node,
              active ? styles.nodeSelected : "",
              focusSlug && !related ? styles.nodeDim : "",
              pinned.has(node.slug) ? styles.nodePinned : "",
            ].filter(Boolean).join(" ");

            return (
              <g
                key={node.slug}
                className={className}
                data-type={node.type ?? "note"}
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${node.title}. ${connections} connections. Double click or press Enter to open.`}
                onPointerDown={(event) => startNodeDrag(event, node.slug)}
                onPointerMove={moveNode}
                onPointerUp={finishNodeDrag}
                onPointerCancel={finishNodeDrag}
                onPointerEnter={() => setHovered(node.slug)}
                onPointerLeave={() => setHovered((current) => current === node.slug ? "" : current)}
                onClick={(event) => { event.stopPropagation(); setSelected(node.slug); }}
                onDoubleClick={() => router.push(`/progress/${node.slug}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") router.push(`/progress/${node.slug}`);
                  if (event.key === " ") { event.preventDefault(); setSelected(node.slug); }
                }}
              >
                <circle r={radius} />
                <text y={3} textAnchor="middle" className={styles.order}>{String(node.order).padStart(2, "0")}</text>
                {labelVisible && (
                  <>
                    <text y={radius + 18} className={styles.label}>{truncate(node.title)}</text>
                    <text y={radius + 31} className={styles.typeLabel}>{node.type ?? "note"} · {node.research}</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <aside className={styles.controls} aria-label="Graph controls">
        <div className={styles.controlHeader}>
          <strong>Graph controls</strong>
          <span>{candidateNodes.length} nodes · {visibleEdges.length} edges</span>
        </div>
        <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter title, type, project…" aria-label="Filter graph nodes" />

        <div className={styles.segmented} aria-label="Graph scope">
          <button type="button" aria-pressed={!localMode} onClick={() => setLocalMode(false)}>Global</button>
          <button type="button" aria-pressed={localMode} disabled={!selected} onClick={() => selected && setLocalMode(true)}>Local</button>
          {localMode && [1, 2, 3].map((value) => (
            <button key={value} type="button" aria-pressed={depth === value} onClick={() => setDepth(value)}>Depth {value}</button>
          ))}
        </div>

        <div className={styles.toggleGrid}>
          <button type="button" aria-pressed={showTyped} onClick={() => setShowTyped((value) => !value)}>Typed links</button>
          <button type="button" aria-pressed={showReferences} onClick={() => setShowReferences((value) => !value)}>References</button>
          <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((value) => !value)}>Labels</button>
          <button type="button" aria-pressed={showArrows} onClick={() => setShowArrows((value) => !value)}>Arrows</button>
          <button type="button" aria-pressed={physics} onClick={() => setPhysics((value) => !value)}>Physics</button>
        </div>

        <div className={styles.buttonRow}>
          <button type="button" onClick={fitVisible}>Fit</button>
          <button type="button" onClick={() => setZoom((value) => clamp(value * 1.18, 0.32, 3.4))}>Zoom +</button>
          <button type="button" onClick={() => setZoom((value) => clamp(value / 1.18, 0.32, 3.4))}>Zoom −</button>
          <button type="button" onClick={unpinAll} disabled={!pinned.size}>Unpin all</button>
          <button type="button" onClick={resetLayout}>Reset</button>
        </div>

        <div className={styles.forcePanel}>
          <div className={styles.forceHeading}>
            <span className="kicker">Forces</span>
            <button type="button" onClick={() => setForces(DEFAULT_FORCES)}>Restore defaults</button>
          </div>
          <label className={styles.slider}><span>Center</span><input type="range" min="0" max="2" step="0.05" value={forces.center} onChange={(event) => updateForce("center", Number(event.target.value))} /><output>{forces.center.toFixed(2)}</output></label>
          <label className={styles.slider}><span>Repel</span><input type="range" min="0.2" max="2.5" step="0.05" value={forces.repel} onChange={(event) => updateForce("repel", Number(event.target.value))} /><output>{forces.repel.toFixed(2)}</output></label>
          <label className={styles.slider}><span>Link force</span><input type="range" min="0.1" max="2" step="0.05" value={forces.link} onChange={(event) => updateForce("link", Number(event.target.value))} /><output>{forces.link.toFixed(2)}</output></label>
          <label className={styles.slider}><span>Distance</span><input type="range" min="80" max="300" step="5" value={forces.distance} onChange={(event) => updateForce("distance", Number(event.target.value))} /><output>{forces.distance}</output></label>
        </div>

        <p className={styles.hint}>Drag a node to pin it. Drag empty space to pan. Scroll to zoom. Hover highlights its immediate neighborhood. Double-click a node to open it.</p>
      </aside>

      <aside className={styles.inspector} aria-label="Selected graph node">
        {selectedNode ? (
          <>
            <div className={styles.inspectorHeader}>
              <div><span className="kicker">Selected node</span><h3 className={styles.inspectorTitle}>{selectedNode.title}</h3></div>
              <span>{degree.get(selectedNode.slug) ?? 0} links</span>
            </div>
            <div className={styles.inspectorMeta}>
              <span>{selectedNode.type ?? "note"}</span>
              <span>{selectedNode.status ?? "no status"}</span>
              <span>{selectedNode.research}</span>
              {pinned.has(selectedNode.slug) && <span>pinned</span>}
            </div>
            <div className={styles.connectionList}>
              {selectedConnections.slice(0, 12).map(({ edge, outgoing, other }, index) => other && (
                <button key={`${edge.source}-${edge.type}-${edge.target}-${index}`} type="button" onClick={() => setSelected(other.slug)}>
                  <em>{outgoing ? edge.type + " →" : "← " + edge.type}</em>
                  <span>{other.title}</span>
                </button>
              ))}
              {!selectedConnections.length && <p className={styles.emptyInspector}>No graph connections for this research object.</p>}
            </div>
            <button type="button" className={styles.openButton} onClick={() => router.push(`/progress/${selectedNode.slug}`)}>Open research object →</button>
          </>
        ) : (
          <p className={styles.emptyInspector}>Select a node to inspect its project, type, status, and semantic connections. Local mode becomes available after selection.</p>
        )}
      </aside>

      <div className={styles.statusBar} aria-live="polite">
        <span>{localMode ? `Local depth ${depth}` : "Global graph"}</span>
        <span>{Math.round(zoom * 100)}%</span>
        <span>{pinned.size} pinned</span>
        {hiddenCount > 0 && <span>{hiddenCount} lower-connectivity nodes hidden at the global readability cap</span>}
      </div>
    </section>
  );
}

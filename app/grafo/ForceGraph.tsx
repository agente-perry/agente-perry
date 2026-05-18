"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";

export type NodeType = "company" | "entity" | "address" | "person";

export type GraphNode = {
  id: string;
  label: string;
  sub: string;
  type: NodeType;
  flagged?: boolean;
  ruc?: string;
  // d3 adds these at runtime:
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

export type GraphEdge = {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  flagged?: boolean;
};

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  selectedId?: string | null;
  fitRef?: React.MutableRefObject<(() => void) | null>;
};

const NODE_RADIUS: Record<NodeType, number> = {
  company: 26,
  entity: 22,
  address: 16,
  person: 18,
};

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  isSelected: boolean,
  isConnected: boolean,
  isDimmed: boolean,
  scale: number,
) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const r = NODE_RADIUS[node.type];
  const alpha = isDimmed ? 0.15 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Pulse ring for flagged nodes
  if (node.flagged && !isDimmed) {
    ctx.beginPath();
    ctx.arc(x, y, r + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  }

  // Selected glow
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
  }

  // Shape by type — no text inside, labels drawn in screen-space below
  if (node.type === "entity") {
    const w = r * 2.2;
    const h = r * 1.4;
    ctx.fillStyle = isSelected ? "#333" : "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = (node.flagged ? 2 : 1) / scale;
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.stroke();
  } else if (node.type === "address") {
    const s = r;
    ctx.fillStyle = isSelected ? "#222" : "#000";
    ctx.strokeStyle = node.flagged ? "#fff" : "#666";
    ctx.lineWidth = (node.flagged ? 2 : 1) / scale;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Circle (company + person)
    ctx.fillStyle = isSelected ? "#fff" : "#000";
    ctx.strokeStyle = node.flagged ? "#fff" : node.type === "person" ? "#888" : "#fff";
    ctx.lineWidth = (node.flagged ? 2.5 : 1.5) / scale;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

// Labels drawn in screen-space (after ctx.restore) — fixed pixel size, always readable
function drawNodeLabels(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  t: d3.ZoomTransform,
  selectedId: string | null | undefined,
  connectedIds: Set<string>,
) {
  nodes.forEach((node) => {
    const isDimmed = !!selectedId && !connectedIds.has(node.id);
    const sx = t.x + (node.x ?? 0) * t.k;
    const sy = t.y + (node.y ?? 0) * t.k;
    const sr = NODE_RADIUS[node.type] * t.k;

    ctx.save();
    ctx.globalAlpha = isDimmed ? 0.12 : 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Main label
    const label = node.label.length > 18 ? node.label.slice(0, 17) + "…" : node.label;
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#ffffff";
    // Slight shadow for contrast
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    ctx.fillText(label, sx, sy + sr + 5);

    // Sub-label
    if (!isDimmed) {
      ctx.shadowBlur = 2;
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      const sub = node.sub.length > 20 ? node.sub.slice(0, 19) + "…" : node.sub;
      ctx.fillText(sub, sx, sy + sr + 20);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: GraphEdge,
  isHighlighted: boolean,
  isDimmed: boolean,
  scale: number,
) {
  const src = edge.source as GraphNode;
  const tgt = edge.target as GraphNode;
  if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;

  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const srcR = NODE_RADIUS[src.type];
  const tgtR = NODE_RADIUS[tgt.type];
  const startX = src.x + (dx / dist) * srcR;
  const startY = src.y + (dy / dist) * srcR;
  const endX = tgt.x - (dx / dist) * (tgtR + 6);
  const endY = tgt.y - (dy / dist) * (tgtR + 6);

  ctx.save();
  ctx.globalAlpha = isDimmed ? 0.05 : isHighlighted ? 1 : edge.flagged ? 0.75 : 0.3;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = (edge.flagged ? 2 : 1) / scale;

  if (!edge.flagged) {
    ctx.setLineDash([4 / scale, 3 / scale]);
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  if (!isDimmed) {
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowSize = 6 / scale;
    ctx.fillStyle = "rgba(255,255,255," + (isDimmed ? 0.05 : isHighlighted ? 0.9 : 0.4) + ")";
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowSize * Math.cos(angle - 0.4), endY - arrowSize * Math.sin(angle - 0.4));
    ctx.lineTo(endX - arrowSize * Math.cos(angle + 0.4), endY - arrowSize * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

const EDGE_LABEL_ES: Record<string, string> = {
  WON:        "ganó contrato",
  LOCATED_AT: "domicilio fiscal",
  REPRESENTS: "representa",
  SAME_ADDR:  "⚠ mismo domicilio",
  SAME_REPR:  "⚠ mismo representante",
};

function drawEdgeLabels(
  ctx: CanvasRenderingContext2D,
  edges: GraphEdge[],
  t: d3.ZoomTransform,
  selectedId: string | null | undefined,
  hoveredId: string | null,
) {
  edges.forEach((e) => {
    const src = e.source as GraphNode;
    const tgt = e.target as GraphNode;
    if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;

    const srcId = src.id;
    const tgtId = tgt.id;
    const isHighlighted = selectedId
      ? (srcId === selectedId || tgtId === selectedId)
      : hoveredId
      ? (srcId === hoveredId || tgtId === hoveredId)
      : false;
    const isDimmed = selectedId ? !isHighlighted : hoveredId ? !isHighlighted : false;
    if (isDimmed) return;

    // World-space distance — skip very short edges
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 50) return;

    // Midpoint in screen-space
    const mx = t.x + ((src.x + tgt.x) / 2) * t.k;
    const my = t.y + ((src.y + tgt.y) / 2) * t.k;

    const text = EDGE_LABEL_ES[e.label] ?? e.label;

    ctx.save();
    ctx.globalAlpha = e.flagged ? (isHighlighted ? 1 : 0.85) : (isHighlighted ? 0.9 : 0.5);
    ctx.font = e.flagged ? "bold 11px monospace" : "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = e.flagged ? "#ffffff" : "rgba(255,255,255,0.8)";
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = 4;
    ctx.fillText(text, mx, my - 4);
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

export default function ForceGraph({ nodes, edges, onNodeClick, selectedId, fitRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const fitTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const rafRef = useRef<number>(0);
  const drawRef = useRef<() => void>(() => {});
  const nodesRef = useRef<GraphNode[]>(nodes);
  const onNodeClickRef = useRef<((n: GraphNode) => void) | undefined>(onNodeClick);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);

  // Memoize connected-node set — prevents draw from being recreated every render
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId) {
      ids.add(selectedId);
      edges.forEach((e) => {
        const srcId = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const tgtId = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        if (srcId === selectedId) ids.add(tgtId);
        if (tgtId === selectedId) ids.add(srcId);
      });
    }
    return ids;
  }, [selectedId, edges]);

  // Keep drawRef always pointing to latest draw (fixes stale closure in sim tick)
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const t = transformRef.current;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridSize = 50 * t.k;
    const ox = (t.x % gridSize + gridSize) % gridSize;
    const oy = (t.y % gridSize + gridSize) % gridSize;
    for (let x = ox; x < width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = oy; y < height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Edges first
    edges.forEach((e) => {
      const srcId = typeof e.source === "string" ? e.source : e.source.id;
      const tgtId = typeof e.target === "string" ? e.target : e.target.id;
      const isHighlighted = selectedId
        ? (srcId === selectedId || tgtId === selectedId)
        : hoveredId
        ? (srcId === hoveredId || tgtId === hoveredId)
        : false;
      const isDimmed = selectedId
        ? !isHighlighted
        : hoveredId
        ? !isHighlighted
        : false;
      drawEdge(ctx, e, isHighlighted, isDimmed, t.k);
    });

    // Nodes on top
    nodes.forEach((node) => {
      const isSelected = selectedId === node.id;
      const isConnected = connectedIds.has(node.id);
      const isDimmed = !!selectedId && !isConnected;
      drawNode(ctx, node, isSelected, isConnected, isDimmed, t.k);
    });

    ctx.restore();

    // Node labels in screen-space (fixed 12px, always readable at any zoom)
    drawNodeLabels(ctx, nodes, t, selectedId, connectedIds);

    // Edge labels in screen-space (fixed size, Spanish storytelling names)
    drawEdgeLabels(ctx, edges, t, selectedId, hoveredId);

    // Tooltip — drawn in screen space (no transform) so always readable
    const hovNode = hoveredId ? nodes.find((n) => n.id === hoveredId) : null;
    const pos = hoverPosRef.current;
    if (hovNode && pos) {
      const lines: string[] = [hovNode.label];
      if (hovNode.sub) lines.push(hovNode.sub);
      if (hovNode.flagged) lines.push("⚠ SEÑAL DE ALERTA ACTIVA");

      const PAD = 10;
      const LINE_H = 16;
      const tipW = Math.max(...lines.map((l) => l.length)) * 7 + PAD * 2;
      const tipH = lines.length * LINE_H + PAD * 2;

      // Position: prefer right+below cursor, clamp to canvas edges
      let tx = pos.x + 14;
      let ty = pos.y + 14;
      if (tx + tipW > width - 8) tx = pos.x - tipW - 14;
      if (ty + tipH > height - 8) ty = pos.y - tipH - 14;

      // Background
      ctx.save();
      ctx.fillStyle = hovNode.flagged ? "#ffffff" : "#111111";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(tx, ty, tipW, tipH);
      ctx.fill();
      ctx.stroke();

      // Text lines
      lines.forEach((line, i) => {
        ctx.fillStyle = hovNode.flagged
          ? (i === 0 ? "#000000" : i === lines.length - 1 ? "#cc0000" : "#333333")
          : (i === 0 ? "#ffffff" : "#aaaaaa");
        ctx.font = i === 0 ? "bold 11px monospace" : "10px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(line, tx + PAD, ty + PAD + i * LINE_H);
      });
      ctx.restore();
    }
  }, [nodes, edges, selectedId, hoveredId, connectedIds]);

  // Sync refs to latest values — fixes stale closures in sim/event handlers
  useEffect(() => { drawRef.current = draw; }, [draw]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, [draw]);

  // Initialize simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Use container dimensions (always correct, canvas may not be sized yet)
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    canvas.width = w;
    canvas.height = h;

    // Clone nodes so d3 can mutate positions
    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n, x: w / 2 + (Math.random() - 0.5) * 200, y: h / 2 + (Math.random() - 0.5) * 200 }));
    const idToNode = new Map(simNodes.map((n) => [n.id, n]));

    // Only keep edges where both endpoints exist in nodes (prevents d3 "node not found" error)
    const simEdges: GraphEdge[] = edges
      .filter((e) => {
        const srcId = typeof e.source === "string" ? e.source : e.source.id;
        const tgtId = typeof e.target === "string" ? e.target : e.target.id;
        return idToNode.has(srcId) && idToNode.has(tgtId);
      })
      .map((e) => ({
        ...e,
        source: idToNode.get(typeof e.source === "string" ? e.source : e.source.id)!,
        target: idToNode.get(typeof e.target === "string" ? e.target : e.target.id)!,
      }));

    const sim = d3
      .forceSimulation<GraphNode>(simNodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(simEdges).id((d) => d.id).distance(180).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-600).distanceMax(500))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.08))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => NODE_RADIUS[d.type] + 38))
      .alphaDecay(0.15)
      .velocityDecay(0.75)
      .stop();

    // Pre-compute layout synchronously — no jiggle on first render
    const tickCount = Math.ceil(Math.log(sim.alphaMin() / sim.alpha()) / Math.log(1 - sim.alphaDecay()));
    for (let i = 0; i < Math.min(tickCount, 300); i++) sim.tick();

    // Sync positions to original nodes for draw()
    function syncPositions() {
      simNodes.forEach((sn) => {
        const orig = nodes.find((n) => n.id === sn.id);
        if (orig) { orig.x = sn.x; orig.y = sn.y; orig.vx = sn.vx; orig.vy = sn.vy; }
      });
      edges.forEach((e, i) => {
        const se = simEdges[i];
        if (se) { e.source = se.source; e.target = se.target; }
      });
    }

    syncPositions();

    // Auto-fit: compute bounding box and set initial zoom transform
    let fitTransform = d3.zoomIdentity;
    if (simNodes.length > 0) {
      const xs = simNodes.map((n) => n.x ?? 0);
      const ys = simNodes.map((n) => n.y ?? 0);
      const minX = Math.min(...xs) - 100;
      const maxX = Math.max(...xs) + 100;
      const minY = Math.min(...ys) - 60;
      const maxY = Math.max(...ys) + 120;
      const bw = maxX - minX;
      const bh = maxY - minY;
      const scale = Math.min(0.85, Math.min(w / bw, h / bh));
      const tx = w / 2 - scale * (minX + bw / 2);
      const ty = h / 2 - scale * (minY + bh / 2);
      fitTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    }
    transformRef.current = fitTransform;
    fitTransformRef.current = fitTransform;

    // Live ticks only during drag — use drawRef to avoid stale closure
    sim.on("tick", () => {
      syncPositions();
      drawRef.current();
    });

    simRef.current = sim as unknown as d3.Simulation<GraphNode, GraphEdge>;

    // Zoom behavior
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        drawRef.current();
      });

    const d3canvas = d3.select(canvas);
    d3canvas.call(zoom);
    // CRITICAL: sync d3 zoom's internal state to match auto-fit transform
    d3canvas.call(zoom.transform, fitTransform);
    zoomRef.current = zoom;

    // Expose fit function for external "CENTRAR" button
    if (fitRef) {
      fitRef.current = () => {
        d3canvas.transition().duration(500).call(zoom.transform, fitTransformRef.current);
      };
    }

    draw();

    // Drag nodes
    let dragNode: GraphNode | null = null;
    let dragSimNode: GraphNode | null = null;
    let dragMoved = false; // true if node was actually moved during drag

    function getTransformedPos(event: MouseEvent) {
      const t = transformRef.current;
      return {
        x: (event.offsetX - t.x) / t.k,
        y: (event.offsetY - t.y) / t.k,
      };
    }

    function findNode(x: number, y: number): GraphNode | null {
      let found: GraphNode | null = null;
      let minDist = Infinity;
      nodesRef.current.forEach((n) => {
        const r = NODE_RADIUS[n.type] + 12;
        const dx = (n.x ?? 0) - x;
        const dy = (n.y ?? 0) - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r && dist < minDist) {
          minDist = dist;
          found = n;
        }
      });
      return found;
    }

    canvas.addEventListener("mousedown", (e: MouseEvent) => {
      const { x, y } = getTransformedPos(e);
      const hit = findNode(x, y);
      dragMoved = false; // reset on every mousedown
      if (hit) {
        dragNode = nodesRef.current.find((n) => n.id === hit.id) ?? hit;
        dragSimNode = simNodes.find((n) => n.id === hit.id) ?? null;
        if (dragSimNode) {
          dragSimNode.fx = dragSimNode.x;
          dragSimNode.fy = dragSimNode.y;
        }
        sim.alphaTarget(0.1).restart();
        e.stopPropagation();
        d3canvas.on(".zoom", null);
      }
    });

    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      const { x, y } = getTransformedPos(e);
      if (dragSimNode) {
        dragMoved = true;
        dragSimNode.fx = x;
        dragSimNode.fy = y;
        return;
      }
      const hit = findNode(x, y);
      const newHovered = hit?.id ?? null;
      // Track screen-space position for tooltip
      hoverPosRef.current = hit ? { x: e.offsetX, y: e.offsetY } : null;
      setHoveredId((prev) => {
        if (prev !== newHovered) return newHovered;
        return prev;
      });
      canvas.style.cursor = hit ? "grab" : "default";
      // Redraw immediately so tooltip follows cursor without waiting for state update
      if (!hit && hoveredId) drawRef.current();
    });

    canvas.addEventListener("mouseup", (e: MouseEvent) => {
      if (dragNode) {
        if (dragSimNode) {
          dragSimNode.fx = null;
          dragSimNode.fy = null;
        }
        sim.alphaTarget(0);
        dragNode = null;
        dragSimNode = null;
        // dragMoved intentionally NOT reset here — click handler reads it
        d3canvas.call(zoom);
      }
    });

    canvas.addEventListener("click", (e: MouseEvent) => {
      if (dragMoved) { dragMoved = false; return; } // was a drag, not a click
      const { x, y } = getTransformedPos(e);
      const hit = findNode(x, y);
      if (hit) onNodeClickRef.current?.(hit);
    });

    canvas.addEventListener("mouseleave", () => {
      hoverPosRef.current = null;
      setHoveredId(null);
    });

    // Touch support
    canvas.addEventListener("touchstart", (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      const x = (touch.clientX - rect.left - t.x) / t.k;
      const y = (touch.clientY - rect.top - t.y) / t.k;
      const hit = findNode(x, y);
      if (hit) {
        dragNode = hit;
        dragSimNode = simNodes.find((n) => n.id === hit.id) ?? null;
        if (dragSimNode) { dragSimNode.fx = dragSimNode.x; dragSimNode.fy = dragSimNode.y; }
        sim.alphaTarget(0.1).restart();
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("touchmove", (e: TouchEvent) => {
      if (!dragSimNode) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      dragSimNode.fx = (touch.clientX - rect.left - t.x) / t.k;
      dragSimNode.fy = (touch.clientY - rect.top - t.y) / t.k;
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener("touchend", () => {
      if (dragSimNode) { dragSimNode.fx = null; dragSimNode.fy = null; }
      sim.alphaTarget(0);
      dragNode = null; dragSimNode = null;
    });

    return () => {
      sim.stop();
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when selection/hover changes
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

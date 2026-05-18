"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export type GNode = {
  id: string; type: string; label: string; sub?: string;
  x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null;
};
export type GEdge = { source: string | GNode; target: string | GNode; label?: string };

interface Props { nodes: GNode[]; edges: GEdge[]; onClose: () => void; }

const TYPE_COLORS: Record<string, { fill: string; text: string; r: number }> = {
  Company:      { fill: "#000", text: "#fff", r: 22 },
  PublicEntity: { fill: "#fff", text: "#000", r: 18 },
  Person:       { fill: "#555", text: "#fff", r: 14 },
  Contract:     { fill: "#ddd", text: "#000", r: 12 },
};

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + "…" : s; }

export default function GraphPanel({ nodes, edges, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<GNode, GEdge> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const W = canvas.clientWidth || 400;
    const H = canvas.clientHeight || 440;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const simNodes: GNode[] = nodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges = edges
      .map((e) => ({
        source: typeof e.source === "string" ? e.source : e.source.id,
        target: typeof e.target === "string" ? e.target : e.target.id,
        label: e.label,
      }))
      .filter((e) => nodeById.has(e.source as string) && nodeById.has(e.target as string));

    let transform = { x: 0, y: 0, k: 1 };

    const sim = d3
      .forceSimulation<GNode>(simNodes)
      .force("link", d3.forceLink<GNode, { source: string; target: string }>(simEdges as any).id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(35));

    simRef.current = sim as any;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Edges
      for (const e of simEdges as any[]) {
        const s = e.source as GNode;
        const t = e.target as GNode;
        if (!s.x || !t.x) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(t.x, t.y!);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Edge label midpoint
        if (e.label) {
          const mx = (s.x + t.x) / 2;
          const my = (s.y! + t.y!) / 2;
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(e.label, mx, my);
        }
      }

      // Nodes
      for (const n of simNodes) {
        if (n.x == null) continue;
        const cfg = TYPE_COLORS[n.type] ?? TYPE_COLORS.Contract;
        ctx.beginPath();
        ctx.arc(n.x, n.y!, cfg.r, 0, Math.PI * 2);
        ctx.fillStyle = cfg.fill;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Labels — screen space for readability
      for (const n of simNodes) {
        if (n.x == null) continue;
        const cfg = TYPE_COLORS[n.type] ?? TYPE_COLORS.Contract;
        const sx = transform.x + n.x * transform.k;
        const sy = transform.y + n.y! * transform.k;
        const sr = cfg.r * transform.k;

        ctx.font = `bold ${Math.max(8, 10 * transform.k)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        ctx.fillText(truncate(n.label, 18), sx, sy + sr + 12);
        if (n.sub) {
          ctx.font = `${Math.max(7, 9 * transform.k)}px monospace`;
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillText(truncate(n.sub, 20), sx, sy + sr + 22);
        }
      }
    }

    sim.on("tick", draw);

    // Zoom
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (ev) => { transform = ev.transform; draw(); });
    d3.select(canvas).call(zoom);

    // Drag
    let dragging: GNode | null = null;
    canvas.addEventListener("mousedown", (ev) => {
      const [mx, my] = [(ev.offsetX - transform.x) / transform.k, (ev.offsetY - transform.y) / transform.k];
      dragging = simNodes.find((n) => n.x != null && Math.hypot((n.x ?? 0) - mx, (n.y ?? 0) - my) < (TYPE_COLORS[n.type]?.r ?? 14) + 6) ?? null;
      if (dragging) { dragging.fx = dragging.x; dragging.fy = dragging.y; }
    });
    canvas.addEventListener("mousemove", (ev) => {
      if (!dragging) return;
      dragging.fx = (ev.offsetX - transform.x) / transform.k;
      dragging.fy = (ev.offsetY - transform.y) / transform.k;
      sim.alpha(0.3).restart();
    });
    canvas.addEventListener("mouseup", () => {
      if (dragging) { dragging.fx = null; dragging.fy = null; dragging = null; }
    });

    return () => { sim.stop(); d3.select(canvas).on(".zoom", null); };
  }, [nodes, edges]);

  return (
    <div
      className="fixed z-50 bg-white border-2 border-black flex flex-col font-mono shadow-2xl"
      style={{ bottom: "5rem", right: "calc(480px + 2.5rem)", width: 420, height: 520 }}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-black text-white text-xs shrink-0 border-b border-black">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-white inline-block" />
          <span className="font-black tracking-widest">◈ GRAFO DE RESULTADOS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-40">{nodes.length} nodos · {edges.length} relaciones</span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity">✕</button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs opacity-40">
          Sin suficientes nodos para graficar
        </div>
      ) : (
        <canvas ref={canvasRef} className="flex-1 w-full cursor-grab active:cursor-grabbing" />
      )}

      <div className="px-4 py-2 border-t border-black text-xs opacity-40 shrink-0">
        ● Company &nbsp; ○ EntidadPública &nbsp; ● Persona
      </div>
    </div>
  );
}

// ── Build synthetic graph from flat Neo4j results ──────────────────────────

export function buildGraphFromResults(results: Record<string, unknown>[]): { nodes: GNode[]; edges: GEdge[] } {
  const nodeMap = new Map<string, GNode>();
  const edgeSet = new Set<string>();
  const edges: GEdge[] = [];

  const get = (row: Record<string, unknown>, ...keys: string[]): string => {
    for (const k of keys) if (row[k] != null && row[k] !== "") return String(row[k]);
    return "";
  };

  for (const row of results) {
    const cRuc  = get(row, "c.ruc", "ruc", "supplier_ruc");
    const cName = get(row, "c.name", "name", "empresa");
    const eRuc  = get(row, "e.ruc", "entity_ruc");
    const eName = get(row, "e.name", "entity_name", "entidad");
    const pDoc  = get(row, "p.doc_id", "doc_id");
    const pName = get(row, "p.name");
    const total = get(row, "total_pen", "total", "c.total_won_pen", "sum(w.monto)", "monto");

    if (cRuc && cName) {
      const id = `c_${cRuc}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id, type: "Company", label: cName,
          sub: total ? `S/ ${Number(total).toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : `RUC ${cRuc}`,
        });
      }
    }

    if (eRuc && eName) {
      const id = `e_${eRuc}`;
      if (!nodeMap.has(id)) nodeMap.set(id, { id, type: "PublicEntity", label: eName, sub: eRuc });
    }

    if (pDoc && pName) {
      const id = `p_${pDoc}`;
      if (!nodeMap.has(id)) nodeMap.set(id, { id, type: "Person", label: pName, sub: pDoc });
    }

    // Company → Entity edge
    if (cRuc && eRuc) {
      const key = `${cRuc}→${eRuc}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: `c_${cRuc}`, target: `e_${eRuc}`, label: "contrato" });
      }
    }

    // Person → Company edge
    if (pDoc && cRuc) {
      const key = `${pDoc}→${cRuc}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: `p_${pDoc}`, target: `c_${cRuc}`, label: "representa" });
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

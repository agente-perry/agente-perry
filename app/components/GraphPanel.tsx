"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type GNode = {
  id: string;
  type: string;
  label: string;
  sub?: string;
  props?: Record<string, unknown>;
  riskScore?: number;
  x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null;
};
export type GEdge = {
  source: string | GNode;
  target: string | GNode;
  label?: string;
  edgeType?: string;
};

interface Props { nodes: GNode[]; edges: GEdge[]; onClose: () => void; }

const BASE_R: Record<string, number> = {
  Company: 22, PublicEntity: 18, Person: 14, Contract: 12,
};

function nodeStyle(n: GNode): { fill: string; stroke: string; r: number } {
  const r = BASE_R[n.type] ?? 14;
  if (n.type === "Company") {
    const risk = n.riskScore ?? 0;
    if (risk >= 0.7) return { fill: "#dc2626", stroke: "#991b1b", r };
    if (risk >= 0.4) return { fill: "#d97706", stroke: "#92400e", r };
    return { fill: "#000", stroke: "#222", r };
  }
  if (n.type === "PublicEntity") return { fill: "#fff", stroke: "#000", r };
  if (n.type === "Person") return { fill: "#555", stroke: "#333", r };
  return { fill: "#ddd", stroke: "#999", r };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fmtVal(key: string, val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "boolean") return val ? "SÍ" : "NO";
  if (typeof val === "number") {
    if (key === "risk_score_v2") return val.toFixed(3);
    if (key === "total_won_pen") {
      if (val >= 1_000_000) return `S/ ${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `S/ ${(val / 1_000).toFixed(0)}K`;
      return `S/ ${val.toFixed(0)}`;
    }
    return val.toLocaleString("es-PE");
  }
  return String(val);
}

const PROP_LABELS: Record<string, [string, string][]> = {
  Company: [
    ["risk_score_v2", "Riesgo"],
    ["total_contracts", "Contratos ganados"],
    ["total_won_pen", "Total adjudicado"],
    ["max_trabajadores", "Trabajadores (máx)"],
    ["deuda_coactiva", "Deuda coactiva"],
    ["condicion", "Condición SUNAT"],
    ["estado", "Estado"],
  ],
  PublicEntity: [
    ["region", "Región"],
    ["ruc", "RUC"],
  ],
  Person: [
    ["doc_id", "DNI/CE"],
  ],
};

const TYPE_LABEL: Record<string, string> = {
  Company: "EMPRESA",
  PublicEntity: "ENTIDAD PÚBLICA",
  Person: "PERSONA",
  Contract: "CONTRATO",
};

function InfoPanel({ node, onClose }: { node: GNode; onClose: () => void }) {
  const fields = PROP_LABELS[node.type] ?? [];
  const props = node.props ?? {};
  const risk = typeof props["risk_score_v2"] === "number" ? props["risk_score_v2"] : null;

  return (
    <div className="absolute bottom-2 left-2 w-56 bg-white border-2 border-black text-xs font-mono z-20 shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 bg-black text-white">
        <span className="font-black tracking-wider text-[10px]">{TYPE_LABEL[node.type] ?? node.type}</span>
        <button onClick={onClose} className="opacity-50 hover:opacity-100 text-sm leading-none">✕</button>
      </div>
      <div className="px-3 py-2 border-b border-black">
        <p className="font-black leading-5 break-words text-[11px]">{node.label}</p>
        {node.sub && <p className="opacity-40 mt-0.5 text-[10px]">{node.sub}</p>}
      </div>
      {risk !== null && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="opacity-50">Riesgo</span>
            <span className={`font-black ${risk >= 0.7 ? "text-red-600" : risk >= 0.4 ? "text-amber-600" : ""}`}>
              {risk.toFixed(3)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 border border-black">
            <div
              className={`h-full ${risk >= 0.7 ? "bg-red-600" : risk >= 0.4 ? "bg-amber-500" : "bg-black"}`}
              style={{ width: `${Math.min(risk * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
      {fields.filter(([k]) => k !== "risk_score_v2" && props[k] != null).length > 0 && (
        <div className="px-3 py-2 space-y-1">
          {fields
            .filter(([k]) => k !== "risk_score_v2" && props[k] != null)
            .map(([key, label]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className="opacity-40 shrink-0">{label}</span>
                <span className="font-bold text-right truncate max-w-[110px]">
                  {fmtVal(key, props[key])}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function GraphPanel({ nodes, edges, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<GNode, GEdge> | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const redrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    selectedIdRef.current = selectedNode?.id ?? null;
    redrawRef.current();
  }, [selectedNode]);

  useEffect(() => {
    setSelectedNode(null);
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const W = canvas.clientWidth || 400;
    const H = canvas.clientHeight || 400;
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
        edgeType: e.edgeType,
      }))
      .filter((e) => nodeById.has(e.source as string) && nodeById.has(e.target as string));

    let transform = { x: 0, y: 0, k: 1 };

    const sim = d3
      .forceSimulation<GNode>(simNodes)
      .force("link", d3.forceLink<GNode, { source: string; target: string }>(simEdges as any).id((d) => d.id).distance(110))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(42));

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
        if (s.x == null || t.x == null) continue;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(t.x, t.y!);

        if (e.edgeType === "same_repr") {
          ctx.strokeStyle = "rgba(220,38,38,0.6)";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
        } else if (e.edgeType === "same_addr") {
          ctx.strokeStyle = "rgba(217,119,6,0.6)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
        } else if (e.edgeType === "represents") {
          ctx.strokeStyle = "rgba(85,85,85,0.35)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 5]);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (e.label) {
          const mx = (s.x + t.x) / 2;
          const my = (s.y! + t.y!) / 2;
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.font = "7px monospace";
          ctx.textAlign = "center";
          ctx.fillText(e.label, mx, my);
        }
      }

      // Nodes
      for (const n of simNodes) {
        if (n.x == null) continue;
        const st = nodeStyle(n);
        const isSelected = selectedIdRef.current === n.id;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y!, st.r + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y!, st.r, 0, Math.PI * 2);
        ctx.fillStyle = st.fill;
        ctx.strokeStyle = isSelected ? "#000" : st.stroke;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Labels — screen space
      for (const n of simNodes) {
        if (n.x == null) continue;
        const st = nodeStyle(n);
        const sx = transform.x + n.x * transform.k;
        const sy = transform.y + n.y! * transform.k;
        const sr = st.r * transform.k;

        ctx.font = `bold ${Math.max(8, 10 * transform.k)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        ctx.fillText(truncate(n.label, 18), sx, sy + sr + 12);
        if (n.sub) {
          ctx.font = `${Math.max(7, 9 * transform.k)}px monospace`;
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillText(truncate(n.sub, 22), sx, sy + sr + 22);
        }
      }
    }

    redrawRef.current = draw;
    sim.on("tick", draw);

    // Zoom
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (ev) => { transform = ev.transform; draw(); });
    d3.select(canvas).call(zoom);

    // Drag + click detection
    let dragging: GNode | null = null;
    let dragMoved = false;
    let dragStart = { x: 0, y: 0 };

    canvas.addEventListener("mousedown", (ev) => {
      dragStart = { x: ev.offsetX, y: ev.offsetY };
      dragMoved = false;
      const [mx, my] = [(ev.offsetX - transform.x) / transform.k, (ev.offsetY - transform.y) / transform.k];
      dragging = simNodes.find(
        (n) => n.x != null && Math.hypot((n.x ?? 0) - mx, (n.y ?? 0) - my) < (BASE_R[n.type] ?? 14) + 8
      ) ?? null;
      if (dragging) { dragging.fx = dragging.x; dragging.fy = dragging.y; }
    });

    canvas.addEventListener("mousemove", (ev) => {
      if (!dragging) return;
      if (Math.hypot(ev.offsetX - dragStart.x, ev.offsetY - dragStart.y) > 5) dragMoved = true;
      dragging.fx = (ev.offsetX - transform.x) / transform.k;
      dragging.fy = (ev.offsetY - transform.y) / transform.k;
      sim.alpha(0.3).restart();
    });

    canvas.addEventListener("mouseup", () => {
      if (dragging && !dragMoved) {
        const clicked = dragging;
        setSelectedNode((prev) => (prev?.id === clicked.id ? null : { ...clicked }));
      } else if (!dragging && !dragMoved) {
        setSelectedNode(null);
      }
      if (dragging) { dragging.fx = null; dragging.fy = null; dragging = null; }
      dragMoved = false;
    });

    return () => {
      sim.stop();
      d3.select(canvas).on(".zoom", null);
      redrawRef.current = () => {};
    };
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
          <span className="opacity-40">{nodes.length} nodos · {edges.length} rel.</span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity">✕</button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs opacity-40">
          Sin suficientes nodos para graficar
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          {selectedNode && (
            <InfoPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-black shrink-0 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] opacity-40">
        <span>● Empresa</span>
        <span>○ Entidad</span>
        <span>● Persona</span>
        <span className="text-red-400">╌ mismo repr.</span>
        <span className="text-amber-400">╌ misma dir.</span>
        <span className="opacity-60 italic">clic en nodo = info</span>
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
    const cRuc    = get(row, "c.ruc", "ruc", "supplier_ruc");
    const cName   = get(row, "c.name", "name", "empresa");
    const eRuc    = get(row, "e.ruc", "entity_ruc");
    const eName   = get(row, "e.name", "entity_name", "entidad");
    const eRegion = get(row, "e.region");
    const pDoc    = get(row, "p.doc_id", "doc_id");
    const pName   = get(row, "p.name");
    const c2Ruc   = get(row, "c2.ruc");
    const c2Name  = get(row, "c2.name");
    const relation = get(row, "c.relation");
    const total   = get(row, "total_pen", "total", "c.total_won_pen", "sum(w.monto)", "monto");

    // Collect company props for info panel
    const cProps: Record<string, unknown> = {};
    for (const k of ["c.risk_score_v2", "c.max_trabajadores", "c.deuda_coactiva",
                     "c.total_contracts", "c.total_won_pen", "c.condicion", "c.estado"] as const) {
      if (row[k] != null) cProps[k.slice(2)] = row[k];  // strip "c."
    }
    const riskScore = row["c.risk_score_v2"] != null ? Number(row["c.risk_score_v2"]) : undefined;

    if (cRuc && cName) {
      const id = `c_${cRuc}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id, type: "Company", label: cName,
          sub: total
            ? `S/ ${Number(total).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`
            : `RUC ${cRuc}`,
          props: cProps,
          riskScore,
        });
      } else {
        const existing = nodeMap.get(id)!;
        if (Object.keys(cProps).length > 0) existing.props = { ...existing.props, ...cProps };
        if (riskScore !== undefined && existing.riskScore === undefined) existing.riskScore = riskScore;
      }
    }

    if (eRuc && eName) {
      const id = `e_${eRuc}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id, type: "PublicEntity", label: eName,
          sub: eRegion || eRuc,
          props: { region: eRegion || undefined, ruc: eRuc },
        });
      }
    }

    if (pDoc && pName) {
      const id = `p_${pDoc}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, type: "Person", label: pName, sub: pDoc, props: { doc_id: pDoc } });
      }
    }

    if (c2Ruc && c2Name) {
      const id = `c_${c2Ruc}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, type: "Company", label: c2Name, sub: `RUC ${c2Ruc}` });
      }
    }

    // Company → Entity
    if (cRuc && eRuc) {
      const key = `${cRuc}→${eRuc}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: `c_${cRuc}`, target: `e_${eRuc}`, label: "contrato", edgeType: "contract" });
      }
    }

    // Person → Company
    if (pDoc && cRuc) {
      const key = `${pDoc}→${cRuc}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: `p_${pDoc}`, target: `c_${cRuc}`, label: "representa", edgeType: "represents" });
      }
    }

    // Company ↔ Company
    if (cRuc && c2Ruc) {
      const key = [cRuc, c2Ruc].sort().join("↔");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        const edgeType = relation === "SAME_REPR" ? "same_repr" : relation === "SAME_ADDR" ? "same_addr" : "related";
        const label = relation === "SAME_REPR" ? "mismo repr." : relation === "SAME_ADDR" ? "misma dir." : "relacionada";
        edges.push({ source: `c_${cRuc}`, target: `c_${c2Ruc}`, label, edgeType });
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

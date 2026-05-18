"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { GraphNode, GraphEdge } from "./ForceGraph";

// Load canvas component only client-side (no SSR)
const ForceGraph = dynamic(() => import("./ForceGraph"), { ssr: false });

// ── Static fallback data (shown when DB not connected) ────────────────────────

const RAW_NODES_FALLBACK: GraphNode[] = [
  // Flagged companies
  { id: "hevimo",   label: "GRUPO HEVIMO",    sub: "0 trabaj. · S/9.9M",      type: "company", flagged: true, ruc: "20601638658" },
  { id: "corprodi", label: "CORPRODI",         sub: "1 trabaj. · S/10.1M",     type: "company", flagged: true, ruc: "20523689879" },
  { id: "dachi",    label: "SERVICIOS DACHI",  sub: "2 trabaj. · S/3.2M",      type: "company", flagged: true, ruc: "20604035873" },
  { id: "dafa",     label: "DAFA MEDIC",       sub: "0 trabaj. · S/886K",      type: "company", flagged: true, ruc: "20606381264" },
  { id: "grifo",    label: "GRIFO SAN JUAN",   sub: "1 trabaj. · S/759K",      type: "company", flagged: true, ruc: "20531570929" },
  { id: "nova",     label: "INV. NOVA",        sub: "0 trabaj. · S/1.85M",     type: "company", flagged: true, ruc: "20578901234" },
  // Normal companies
  { id: "normal1",  label: "PROV. ALFA",       sub: "Estado: ACTIVO",          type: "company" },
  { id: "normal2",  label: "CONSULT. BETA",    sub: "Estado: ACTIVO",          type: "company" },
  { id: "normal3",  label: "TECN. DELTA",      sub: "Estado: ACTIVO",          type: "company" },
  // Public entities
  { id: "essalud",  label: "ESSALUD",          sub: "Entidad pública",         type: "entity" },
  { id: "loreto",   label: "GOB.REG.LORETO",   sub: "Entidad pública",         type: "entity" },
  { id: "fap",      label: "FUERZA AÉREA",     sub: "Entidad pública",         type: "entity" },
  { id: "minsa",    label: "MINSA",            sub: "Entidad pública",         type: "entity" },
  { id: "munic1",   label: "MUNIC.PACHACAMAC", sub: "Entidad pública",         type: "entity" },
  { id: "munic2",   label: "MUNIC.CHOTA",      sub: "Entidad pública",         type: "entity" },
  { id: "munic3",   label: "MUNIC.HUANCAYO",   sub: "Entidad pública",         type: "entity" },
  // Addresses (shared — flagged)
  { id: "addr1",    label: "AV.JAVIER PRADO",  sub: "Lima · compartido",       type: "address", flagged: true },
  { id: "addr2",    label: "JR.UCAYALI 420",   sub: "Loreto · compartido",     type: "address", flagged: true },
  { id: "addr3",    label: "AV.AREQUIPA 890",  sub: "Lima",                    type: "address" },
  // Persons (shared reps — flagged)
  { id: "repr1",    label: "REPR.COMPARTIDO",  sub: "DNI 44███████",           type: "person", flagged: true },
  { id: "repr2",    label: "REPR.COMPARTIDO",  sub: "DNI 76███████",           type: "person", flagged: true },
];

const RAW_EDGES_FALLBACK: GraphEdge[] = [
  // WON — flagged companies → entities
  { source: "corprodi", target: "essalud",  label: "WON" },
  { source: "corprodi", target: "loreto",   label: "WON" },
  { source: "hevimo",   target: "munic1",   label: "WON" },
  { source: "hevimo",   target: "munic2",   label: "WON" },
  { source: "hevimo",   target: "essalud",  label: "WON" },
  { source: "dachi",    target: "fap",      label: "WON" },
  { source: "dachi",    target: "loreto",   label: "WON" },
  { source: "dafa",     target: "essalud",  label: "WON" },
  { source: "dafa",     target: "minsa",    label: "WON" },
  { source: "grifo",    target: "munic1",   label: "WON" },
  { source: "nova",     target: "munic3",   label: "WON" },
  // Normal WON
  { source: "normal1",  target: "fap",      label: "WON" },
  { source: "normal2",  target: "munic1",   label: "WON" },
  { source: "normal3",  target: "essalud",  label: "WON" },
  // Shared addresses (flagged)
  { source: "corprodi", target: "addr1",    label: "LOCATED_AT", flagged: true },
  { source: "hevimo",   target: "addr1",    label: "LOCATED_AT", flagged: true },
  { source: "dachi",    target: "addr2",    label: "LOCATED_AT", flagged: true },
  { source: "nova",     target: "addr2",    label: "LOCATED_AT", flagged: true },
  { source: "normal1",  target: "addr3",    label: "LOCATED_AT" },
  // SAME_ADDRESS_AS (derived, flagged)
  { source: "corprodi", target: "hevimo",   label: "SAME_ADDR", flagged: true },
  { source: "dachi",    target: "nova",     label: "SAME_ADDR", flagged: true },
  // Shared representatives (flagged)
  { source: "repr1",    target: "hevimo",   label: "REPRESENTS", flagged: true },
  { source: "repr1",    target: "dachi",    label: "REPRESENTS", flagged: true },
  { source: "repr2",    target: "dafa",     label: "REPRESENTS", flagged: true },
  { source: "repr2",    target: "grifo",    label: "REPRESENTS", flagged: true },
  // SAME_REPR_AS (derived, flagged)
  { source: "hevimo",   target: "dachi",    label: "SAME_REPR", flagged: true },
  { source: "dafa",     target: "grifo",    label: "SAME_REPR", flagged: true },
];

// ── Filter options ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { id: "won",     label: "CONTRATOS GANADOS",     defaultOn: true },
  { id: "located", label: "DOMICILIOS FISCALES",   defaultOn: true },
  { id: "same_a",  label: "MISMO DOMICILIO",       defaultOn: true },
  { id: "repr",    label: "REPRESENTANTES",        defaultOn: true },
  { id: "same_r",  label: "MISMO REPRESENTANTE",   defaultOn: true },
  { id: "normal",  label: "EMPRESAS SIN ALERTAS",  defaultOn: true },
];

const EDGE_LABEL_ES: Record<string, string> = {
  WON:        "ganó contrato con",
  LOCATED_AT: "comparte domicilio fiscal",
  REPRESENTS: "tiene representante en",
  SAME_ADDR:  "⚠ mismo domicilio que",
  SAME_REPR:  "⚠ mismo representante que",
};

const STATS = [
  { label: "NODOS EN GRAFO", value: "107,195" },
  { label: "RELACIONES MAPEADAS", value: "116,509" },
  { label: "EMPRESAS CON ALERTAS", value: "924" },
  { label: "EN CONTRATOS ALERTADOS", value: "S/23M+" },
];

const LEGEND = [
  { type: "company" as const, label: "EMPRESA", flagged: false },
  { type: "company" as const, label: "EMPRESA ALERTADA", flagged: true },
  { type: "entity" as const,  label: "ENTIDAD PÚBLICA",  flagged: false },
  { type: "address" as const, label: "DOMICILIO",         flagged: false },
  { type: "person" as const,  label: "REPRESENTANTE",     flagged: false },
];

// ── Node story sidebar ────────────────────────────────────────────────────────

function getOtherId(e: GraphEdge, nodeId: string) {
  const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
  const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
  return s === nodeId ? t : s;
}

function NodeChip({ n, warn, onSelect }: { n: GraphNode; warn?: boolean; onSelect: (n: GraphNode) => void }) {
  return (
    <button
      onClick={() => onSelect(n)}
      className={`text-left text-xs px-2 py-1.5 border transition-colors hover:bg-white hover:text-black w-full ${
        warn ? "border-white" : "border-white border-opacity-20"
      }`}
    >
      {warn && <span className="mr-1 opacity-70">⚠</span>}
      <span className="font-bold">{n.label}</span>
      {n.sub && <span className="block opacity-40 text-xs mt-0.5">{n.sub}</span>}
    </button>
  );
}

function NodeStory({
  node,
  connectedEdges,
  rawNodes,
  onSelect,
  onClose,
}: {
  node: GraphNode;
  connectedEdges: GraphEdge[];
  rawNodes: GraphNode[];
  onSelect: (n: GraphNode) => void;
  onClose: () => void;
}) {
  const won   = connectedEdges.filter((e) => e.label === "WON");
  const same_a = connectedEdges.filter((e) => e.label === "SAME_ADDR");
  const same_r = connectedEdges.filter((e) => e.label === "SAME_REPR");
  const repr  = connectedEdges.filter((e) => e.label === "REPRESENTS");
  const located = connectedEdges.filter((e) => e.label === "LOCATED_AT");

  const other = (e: GraphEdge) => rawNodes.find((n) => n.id === getOtherId(e, node.id));

  // Parse "0 trab. · S/9.9M" from sub
  const wMatch = node.sub.match(/^(\d+)\s*trab/);
  const tMatch = node.sub.match(/S\/([\d.]+[KM]?)/);
  const workers = wMatch ? parseInt(wMatch[1]) : null;
  const total = tMatch ? `S/${tMatch[1]}` : null;

  // ── Per-type narrative + flags ───────────────────────────────────────────
  let headline = "";
  let narrative = "";
  const flags: string[] = [];

  if (node.type === "company") {
    headline = node.flagged ? "⚠ EMPRESA CON ALERTAS" : "EMPRESA PROVEEDORA";
    const n = won.length;
    if (workers === 0 && total && n > 0) {
      narrative = `Sin ningún trabajador registrado en SUNAT, esta empresa acumuló ${total} en contratos con ${n} entidad${n !== 1 ? "es" : ""} pública del Estado.`;
      flags.push(`Cero trabajadores con ${total} en contratos — desproporción crítica`);
    } else if (workers !== null && total && n > 0) {
      narrative = `Con solo ${workers} trabajador${workers !== 1 ? "es" : ""} registrado${workers !== 1 ? "s" : ""}, acumuló ${total} en contratos con ${n} entidad${n !== 1 ? "es" : ""} pública del Estado.`;
      if (workers <= 2) flags.push(`Capacidad operativa mínima (${workers} trabajador${workers !== 1 ? "es" : ""}) vs. volumen contractual`);
    } else if (n > 0) {
      narrative = `Participó en contratos con ${n} entidad${n !== 1 ? "es" : ""} pública del Estado.`;
    } else {
      narrative = "Empresa registrada en el grafo sin contratos directos visibles en esta vista.";
    }
    if (same_a.length > 0) flags.push(`Domicilio fiscal compartido con ${same_a.length} empresa${same_a.length !== 1 ? "s" : ""} alertada${same_a.length !== 1 ? "s" : ""}`);
    if (same_r.length > 0) flags.push(`Mismo representante legal que ${same_r.length} empresa${same_r.length !== 1 ? "s" : ""} proveedora del Estado`);

  } else if (node.type === "entity") {
    headline = "ENTIDAD PÚBLICA";
    const flagged = won.filter((e) => other(e)?.flagged);
    narrative = flagged.length > 0
      ? `Adjudicó contratos a ${won.length} empresa${won.length !== 1 ? "s" : ""} en este dataset. ${flagged.length} de ellas presentan alertas activas de riesgo.`
      : `Adjudicó contratos a ${won.length} empresa${won.length !== 1 ? "s" : ""} en este dataset. Ninguna con alertas.`;
    if (flagged.length > 0) flags.push(`${flagged.length} proveedor${flagged.length !== 1 ? "es" : ""} con alertas de riesgo activas`);

  } else if (node.type === "person") {
    headline = "⚠ REPRESENTANTE COMPARTIDO";
    narrative = `Figura como representante legal de ${repr.length} empresa${repr.length !== 1 ? "s" : ""} proveedoras del Estado de forma simultánea — patrón asociado a redes coordinadas bajo control común.`;
    flags.push(`${repr.length} empresas con el mismo representante legal`);

  } else if (node.type === "address") {
    headline = "⚠ DOMICILIO COMPARTIDO";
    const companies = located.map(other).filter(Boolean);
    narrative = `${companies.length} empresa${companies.length !== 1 ? "s" : ""} proveedora${companies.length !== 1 ? "s" : ""} del Estado registran este mismo domicilio fiscal — patrón asociado a empresas vinculadas o de fachada.`;
    flags.push(`${companies.length} empresas en un único domicilio`);
  }

  // ── Grouped connection lists (deduplicated by node id) ───────────────────
  const uniq = (arr: (GraphNode | undefined)[]): GraphNode[] => {
    const seen = new Set<string>();
    return arr.filter((n): n is GraphNode => !!n && !seen.has(n.id) && !!seen.add(n.id));
  };

  const entities        = uniq(won.map(other));
  const linkedCos       = uniq([...same_a, ...same_r].map(other));
  const repCos          = uniq(repr.map(other));
  const addrCos         = uniq(located.map(other));
  const flaggedProviders = uniq(won.filter((e) => other(e)?.flagged).map(other));
  const normalProviders  = uniq(won.filter((e) => !other(e)?.flagged).map(other));


  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-xs opacity-30 tracking-widest mb-1">{headline}</p>
          <p className="font-black text-sm leading-tight break-words">{node.label}</p>
          {node.ruc && <p className="text-xs opacity-30 mt-0.5 font-mono">RUC {node.ruc}</p>}
        </div>
        <button
          onClick={onClose}
          className="text-xs border border-white px-2 py-1 hover:bg-white hover:text-black transition-colors opacity-40 hover:opacity-100 shrink-0"
        >
          ×
        </button>
      </div>

      {/* Narrative */}
      <div className={`p-3 border text-xs leading-5 ${node.flagged ? "border-white bg-white text-black" : "border-white border-opacity-20 opacity-70"}`}>
        {narrative}
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">SEÑALES DETECTADAS</p>
          <div className="flex flex-col gap-1">
            {flags.map((f, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="opacity-50 shrink-0">▸</span>
                <span className="opacity-80 leading-4">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company → entities */}
      {entities.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">CONTRATOS CON ({entities.length})</p>
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
            {entities.map((n) => <NodeChip key={n.id} n={n} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {/* Company → linked companies (same addr / same repr) */}
      {linkedCos.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">EMPRESAS VINCULADAS ({linkedCos.length})</p>
          <div className="flex flex-col gap-1">
            {linkedCos.map((n) => <NodeChip key={n.id} n={n} warn={n.flagged} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {/* Entity → flagged providers first */}
      {flaggedProviders.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">PROVEEDORES ALERTADOS ({flaggedProviders.length})</p>
          <div className="flex flex-col gap-1">
            {flaggedProviders.map((n) => <NodeChip key={n.id} n={n} warn onSelect={onSelect} />)}
          </div>
        </div>
      )}
      {normalProviders.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">OTROS PROVEEDORES ({normalProviders.length})</p>
          <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
            {normalProviders.map((n) => <NodeChip key={n.id} n={n} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {/* Person → companies represented */}
      {repCos.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">EMPRESAS QUE REPRESENTA ({repCos.length})</p>
          <div className="flex flex-col gap-1">
            {repCos.map((n) => <NodeChip key={n.id} n={n} warn={n.flagged} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {/* Address → companies */}
      {addrCos.length > 0 && (
        <div>
          <p className="text-xs opacity-30 tracking-widest mb-2">EMPRESAS EN ESTE DOMICILIO ({addrCos.length})</p>
          <div className="flex flex-col gap-1">
            {addrCos.map((n) => <NodeChip key={n.id} n={n} warn={n.flagged} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {/* Actions */}
      {node.type === "company" && node.ruc && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white border-opacity-20">
          <Link
            href={`/empresa/${node.ruc}`}
            className="block text-center text-xs border border-white px-3 py-2 hover:bg-white hover:text-black transition-colors"
          >
            VER EXPEDIENTE COMPLETO →
          </Link>
          <a
            href={`https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${node.ruc}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs border border-white border-opacity-30 px-3 py-2 hover:bg-white hover:text-black transition-colors opacity-50 hover:opacity-100"
          >
            VERIFICAR EN SUNAT →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GrafoPage() {
  const [rawNodes, setRawNodes] = useState<GraphNode[]>(RAW_NODES_FALLBACK);
  const [rawEdges, setRawEdges] = useState<GraphEdge[]>(RAW_EDGES_FALLBACK);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphKey, setGraphKey] = useState(0);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(FILTER_OPTIONS.filter((f) => f.defaultOn).map((f) => f.id))
  );

  const [searchInput, setSearchInput] = useState("");

  const loadGraph = (ruc?: string) => {
    setGraphLoading(true);
    const url = ruc ? `/api/grafo?ruc=${encodeURIComponent(ruc)}` : "/api/grafo";
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        if (nodes.length > 0) {
          setRawNodes(nodes);
          setRawEdges(edges);
          setDbLoaded(true);
          setSelectedNode(null);
          setGraphKey((k) => k + 1); // remount ForceGraph so sim re-initializes with new nodes
        }
      })
      .catch((err) => console.warn("[grafo] DB not available, using fallback:", err))
      .finally(() => setGraphLoading(false));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ruc = params.get("ruc");
    if (ruc) setSearchInput(ruc);
    loadGraph(ruc ?? undefined);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) loadGraph(trimmed);
  };

  const toggleFilter = (id: string) =>
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { nodes, edges } = useMemo(() => {
    const edgeFilter = (e: GraphEdge): boolean => {
      if (e.label === "WON" && !activeFilters.has("won")) return false;
      if (e.label === "LOCATED_AT" && !activeFilters.has("located")) return false;
      if (e.label === "SAME_ADDR" && !activeFilters.has("same_a")) return false;
      if (e.label === "REPRESENTS" && !activeFilters.has("repr")) return false;
      if (e.label === "SAME_REPR" && !activeFilters.has("same_r")) return false;
      return true;
    };

    const filteredEdges = rawEdges.filter(edgeFilter);

    const usedIds = new Set<string>();
    filteredEdges.forEach((e) => {
      usedIds.add(typeof e.source === "string" ? e.source : (e.source as GraphNode).id);
      usedIds.add(typeof e.target === "string" ? e.target : (e.target as GraphNode).id);
    });

    let filteredNodes = rawNodes.filter((n) => usedIds.has(n.id));
    if (!activeFilters.has("normal")) {
      filteredNodes = filteredNodes.filter((n) => n.flagged || n.type === "entity" || n.type === "address" || n.type === "person");
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [activeFilters, rawNodes, rawEdges]);

  // Build connected edge list for sidebar
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return rawEdges.filter((e) => {
      const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
      const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
      return s === selectedNode.id || t === selectedNode.id;
    });
  }, [selectedNode]);

  return (
    <main className="flex flex-col" style={{ height: "calc(100vh - 41px)" }}>

      {/* Toolbar */}
      <div className="border-b border-white px-4 py-3 flex flex-wrap items-center gap-6 shrink-0">
        <div className="flex-1">
          <p className="text-xs opacity-40 tracking-widest mb-2 hidden md:block">CAPAS VISIBLES</p>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => toggleFilter(f.id)}
                className={`text-xs px-2 py-1 border transition-colors ${
                  activeFilters.has(f.id)
                    ? "bg-white text-black border-white"
                    : "border-white border-opacity-30 opacity-40 hover:opacity-80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {/* RUC search */}
        <form onSubmit={handleSearch} className="flex gap-1 shrink-0">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="RUC o nombre..."
            className="text-xs bg-transparent border border-white border-opacity-40 px-3 py-1.5 w-40 placeholder:opacity-30 focus:outline-none focus:border-opacity-100"
          />
          <button
            type="submit"
            disabled={graphLoading}
            className="text-xs border border-white border-opacity-40 px-3 py-1.5 hover:bg-white hover:text-black transition-colors disabled:opacity-30"
          >
            {graphLoading ? "..." : "BUSCAR"}
          </button>
          {dbLoaded && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); loadGraph(); }}
              className="text-xs border border-white border-opacity-20 px-2 py-1.5 opacity-40 hover:opacity-100 transition-colors"
              title="Volver al top-25"
            >
              ✕
            </button>
          )}
        </form>

        <button
          onClick={() => fitRef.current?.()}
          className="text-xs border border-white border-opacity-40 px-3 py-1.5 hover:bg-white hover:text-black transition-colors opacity-60 hover:opacity-100 shrink-0"
        >
          ⊕ CENTRAR
        </button>
        {!dbLoaded && (
          <span className="text-xs opacity-30 hidden lg:block">MUESTRA ESTÁTICA · Conecta Neo4j para datos reales</span>
        )}
        <div className="hidden lg:grid grid-cols-4 gap-px border border-white shrink-0">
          {STATS.map((s) => (
            <div key={s.label} className="border-r border-white last:border-r-0 px-4 py-2 text-right">
              <p className="text-lg font-black leading-none">{s.value}</p>
              <p className="text-xs opacity-30 leading-3 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas + sidebar */}
      <div className="flex flex-1 overflow-hidden">

        {/* Graph canvas */}
        <div className="flex-1 relative overflow-hidden bg-black">
          <ForceGraph
            key={graphKey}
            nodes={nodes}
            edges={edges}
            onNodeClick={(n) => setSelectedNode((prev) => prev?.id === n.id ? null : n)}
            selectedId={selectedNode?.id}
            fitRef={fitRef}
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 border border-white border-opacity-30 bg-black bg-opacity-90 p-3 text-xs pointer-events-none">
            <p className="opacity-30 mb-2 tracking-widest">LEYENDA</p>
            {LEGEND.map((l, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <svg width={14} height={14} viewBox="-7 -7 14 14">
                  {l.type === "entity" ? (
                    <rect x={-6} y={-4} width={12} height={8} fill="#fff" stroke="#fff" strokeWidth={1} />
                  ) : l.type === "address" ? (
                    <polygon points="0,-5 5,0 0,5 -5,0" fill="#000" stroke={l.flagged ? "#fff" : "#666"} strokeWidth={1} />
                  ) : (
                    <circle r={5} fill={l.flagged ? "#000" : "#000"} stroke={l.flagged ? "#fff" : l.type === "person" ? "#888" : "#555"} strokeWidth={l.flagged ? 2 : 1} />
                  )}
                </svg>
                <span className={l.flagged ? "opacity-90" : "opacity-50"}>{l.label}</span>
                {l.flagged && <span className="opacity-60 text-xs">⚠</span>}
              </div>
            ))}
            <div className="border-t border-white border-opacity-20 mt-2 pt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <svg width={14} height={4}><line x1={0} y1={2} x2={14} y2={2} stroke="#fff" strokeWidth={2}/></svg>
                <span className="opacity-50">ALERTA ACTIVA</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width={14} height={4}><line x1={0} y1={2} x2={14} y2={2} stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="4 3"/></svg>
                <span className="opacity-30">RELACIÓN NORMAL</span>
              </div>
            </div>
          </div>

          {/* Zoom hint */}
          <div className="absolute top-4 left-4 text-xs opacity-20 pointer-events-none">
            SCROLL → ZOOM · DRAG NODO → MOVER · DRAG FONDO → PAN
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l border-white flex flex-col overflow-y-auto shrink-0">
          {selectedNode ? (
            <NodeStory
              node={selectedNode}
              connectedEdges={connectedEdges}
              rawNodes={rawNodes}
              onSelect={(n) => setSelectedNode((prev) => prev?.id === n.id ? null : n)}
              onClose={() => setSelectedNode(null)}
            />
          ) : (
            <div className="p-5 flex flex-col gap-5">
              <div>
                <p className="text-xs opacity-40 tracking-widest mb-3">LO QUE ESTÁS VIENDO</p>
                <p className="text-xs leading-6 opacity-70">
                  Subgrafo de las empresas con mayor score de riesgo y sus conexiones reales: contratos ganados, domicilios compartidos, representantes en común.
                </p>
              </div>

              <div className="border border-white border-opacity-20 p-3">
                <p className="text-xs opacity-30 mb-2 tracking-widest">PATRONES A BUSCAR</p>
                <div className="flex flex-col gap-2 text-xs opacity-60 leading-5">
                  <p>▶ <strong className="opacity-100">Clusters blancos</strong> — empresas con múltiples conexiones sospechosas entre sí. Ej: CORPRODI + HEVIMO comparten domicilio fiscal.</p>
                  <p>▶ <strong className="opacity-100">Nodos centrales</strong> — una persona o domicilio que conecta muchas empresas. Un representante compartido entre 4+ proveedores del Estado es señal crítica.</p>
                  <p>▶ <strong className="opacity-100">Líneas sólidas</strong> — relaciones con alerta activa. Las punteadas son vínculos normales sin flag.</p>
                </div>
              </div>

              <div className="border border-white border-opacity-20 p-3">
                <p className="text-xs opacity-30 mb-2 tracking-widest">CONTROLES</p>
                <div className="flex flex-col gap-1.5 text-xs opacity-50 leading-5">
                  <p>Scroll → Zoom · Drag nodo → Mover</p>
                  <p>Drag fondo → Pan · Click → Inspeccionar</p>
                </div>
              </div>

              <div className="border border-white border-opacity-20 p-3">
                <p className="text-xs opacity-20 leading-5">
                  Muestra activa: subgrafo top-25 empresas por score. Base completa: 107,195 nodos · 116,509 relaciones en Neo4j AuraDB.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

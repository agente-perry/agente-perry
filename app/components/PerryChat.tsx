"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GraphPanel, { buildGraphFromResults, type GNode, type GEdge } from "./GraphPanel";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type LineType = "dim" | "input" | "step" | "result" | "narrative" | "error" | "graph_toggle";
type Line = {
  type: LineType;
  text: string;
  graph?: { nodes: GNode[]; edges: GEdge[] };
};

const INIT_LINES: Line[] = [
  { type: "dim", text: "> INICIALIZANDO SISTEMA..." },
  { type: "dim", text: "> CONECTANDO A NEO4J AURADB..." },
  { type: "dim", text: "> 107,195 NODOS CARGADOS" },
];

export default function PerryChat() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>(INIT_LINES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeGraph, setActiveGraph] = useState<{ nodes: GNode[]; edges: GEdge[] } | null>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onQuery(e: Event) {
      const query = (e as CustomEvent<{ query: string }>).detail?.query;
      if (!query) return;
      setOpen(true);
      setTimeout(() => submit(query), 80);
    }
    function onPrefill(e: Event) {
      const query = (e as CustomEvent<{ query: string }>).detail?.query;
      if (!query) return;
      setOpen(true);
      setInput(query);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(query.length, query.length);
      }, 80);
    }
    window.addEventListener("perry:query", onQuery);
    window.addEventListener("perry:prefill", onPrefill);
    return () => {
      window.removeEventListener("perry:query", onQuery);
      window.removeEventListener("perry:prefill", onPrefill);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [open, lines]);

  async function submit(query: string) {
    const q = query.trim();
    if (!q || loading) return;
    setInput("");
    setLines((prev) => [
      ...prev,
      { type: "input", text: q },
      { type: "step", text: "  → GENERANDO CYPHER..." },
    ]);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history: historyRef.current.slice(-8) }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const data = await res.json();

      const next: Line[] = [{ type: "step", text: "  → EJECUTANDO EN GRAFO..." }];
      if (data.cypher) {
        next.push({ type: "dim", text: `  CYPHER: ${data.cypher.split("\n")[0]}...` });
      }
      if (data.success && data.results?.length > 0) {
        next.push({ type: "result", text: `RESULTADO: ${data.results.length} REGISTRO${data.results.length !== 1 ? "S" : ""}` });
        data.results.slice(0, 5).forEach((r: Record<string, unknown>) => {
          const preview = Object.entries(r).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ");
          next.push({ type: "result", text: `  ▶ ${preview}` });
        });
        if (data.results.length > 5) {
          next.push({ type: "dim", text: `  ... y ${data.results.length - 5} más` });
        }
      } else if (data.success) {
        next.push({ type: "result", text: "RESULTADO: 0 REGISTROS" });
      }
      if (data.narrative) {
        next.push({ type: "narrative", text: data.narrative });
      }
      if (!data.success) {
        next.push({ type: "error", text: `  ERROR: ${data.narrative}` });
      }

      // Update conversation memory (max 5 turns = 10 messages)
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: q },
        { role: "assistant", content: data.narrative || "" },
      ].slice(-10);

      // Build graph for this turn
      if (data.success && data.results?.length >= 1) {
        const graph = buildGraphFromResults(data.results);
        if (graph.nodes.length >= 1) {
          next.push({ type: "graph_toggle", text: "", graph });
        }
      }

      setLines((prev) => [...prev, ...next]);
    } catch (e) {
      setLines((prev) => [
        ...prev,
        { type: "error", text: `  ERROR: ${e instanceof Error ? e.message : "sin conexión"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleGraph(graph: { nodes: GNode[]; edges: GEdge[] }) {
    setActiveGraph((prev) =>
      prev?.nodes === graph.nodes ? null : graph
    );
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 border-2 font-black text-xs tracking-widest transition-all shadow-lg
          ${open ? "bg-black text-white border-white" : "bg-white text-black border-white hover:bg-black hover:text-white"}`}
      >
        <span className="text-base leading-none">◈</span>
        {open ? "CERRAR PERRY ✕" : "HAZ TU CONSULTA →"}
      </button>

      {/* Graph panel — per-turn, shows whichever is active */}
      {open && activeGraph && (
        <GraphPanel
          nodes={activeGraph.nodes}
          edges={activeGraph.edges}
          onClose={() => setActiveGraph(null)}
        />
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-[480px] max-w-[calc(100vw-2rem)] bg-white text-black border-2 border-black shadow-2xl flex flex-col font-mono"
          style={{ height: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-black bg-black text-white shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 bg-white inline-block" />
              <span className="font-black tracking-widest">PERRY — CONSULTA AL GRAFO</span>
            </div>
            <button
              onClick={() => { setLines(INIT_LINES); setActiveGraph(null); historyRef.current = []; }}
              className="text-xs opacity-40 hover:opacity-100 transition-opacity"
            >
              LIMPIAR
            </button>
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto p-4 text-xs leading-6 min-h-0">
            {lines.map((line, i) => {
              if (line.type === "narrative") return (
                <div key={i} className="mt-3 mb-1 border-l-2 border-black pl-3 overflow-x-auto prose prose-xs max-w-none
                  [&_h2]:text-xs [&_h2]:font-black [&_h2]:tracking-wider [&_h2]:uppercase [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:border-none
                  [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1
                  [&_strong]:font-black [&_p]:mb-2 [&_p]:leading-5 [&_p]:text-xs
                  [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:text-xs [&_li]:mb-0.5
                  [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse
                  [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1
                  [&_th]:border [&_th]:border-black [&_th]:px-2 [&_th]:py-1 [&_th]:font-black [&_th]:bg-black [&_th]:text-white
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{line.text}</ReactMarkdown>
                </div>
              );

              if (line.type === "input") return (
                <div key={i} className="mt-3 mb-2 bg-black text-white px-3 py-2">
                  <p className="text-xs opacity-50 mb-0.5 tracking-widest">▶ CONSULTA</p>
                  <p className="font-black leading-5 break-words whitespace-pre-wrap">{line.text}</p>
                </div>
              );

              if (line.type === "graph_toggle" && line.graph) {
                const isActive = activeGraph?.nodes === line.graph.nodes;
                return (
                  <button
                    key={i}
                    onClick={() => toggleGraph(line.graph!)}
                    className={`mt-2 mb-1 w-full text-left text-xs font-black tracking-wider px-3 py-2 border-2 transition-all
                      ${isActive
                        ? "bg-black text-white border-black"
                        : "border-black border-opacity-30 hover:border-opacity-100 hover:bg-black hover:text-white"
                      }`}
                  >
                    ◈ {isActive ? "OCULTAR GRAFO" : "VER GRAFO DE ESTA CONSULTA"}
                    <span className="ml-2 font-normal opacity-60">
                      {line.graph.nodes.length} nodos · {line.graph.edges.length} relaciones
                    </span>
                  </button>
                );
              }

              return (
                <p key={i} className={
                  line.type === "dim" ? "opacity-40" :
                  line.type === "step" ? "opacity-60" :
                  line.type === "result" ? "font-black" :
                  line.type === "error" ? "text-red-600" :
                  "font-bold"
                }>
                  {line.text}
                </p>
              );
            })}
            {loading && <p className="opacity-40 animate-pulse">  → PROCESANDO...</p>}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t-2 border-black px-4 py-3 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="flex items-center gap-2 text-xs">
              <span className="opacity-50 shrink-0">▶</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ESCRIBE TU PREGUNTA AL GRAFO..."
                disabled={loading}
                className="flex-1 bg-transparent outline-none font-mono text-xs placeholder:opacity-30 disabled:opacity-30"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="border border-black px-3 py-1 font-black text-xs disabled:opacity-20 hover:bg-black hover:text-white transition-colors shrink-0"
              >
                ↵ ENVIAR
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

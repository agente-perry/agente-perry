"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

type Vendor = { ruc: string; name: string; total: number; contracts: number; share_pct: number; score: number; workers: number };

type Entity = {
  ruc: string;
  name: string;
  region: string;
  total_awarded: number;
  unique_vendors: number;
  total_contracts: number;
  concentration_pct: number;
  top_vendors: Vendor[];
  flags: string[];
};

const FLAG_META: Record<string, { label: string; desc: string; color: string }> = {
  "CAPTURADA":       { label: "ENTIDAD CAPTURADA",    desc: "MÃ¡s del 80% del gasto registrado en SEACE concentrado en â‰¤3 proveedores. Dentro del perÃ­odo analizado, no se identificÃ³ competencia efectiva en las adjudicaciones.",         color: "bg-white text-black" },
  "OLIGOPOLIO":      { label: "OLIGOPOLIO DE COMPRA", desc: "MÃ¡s del 60% del gasto registrado en SEACE concentrado en pocos proveedores. Competencia limitada en los contratos del perÃ­odo analizado.",                    color: "bg-white text-black border-opacity-60" },
  "PROVEEDOR_ÃšNICO": { label: "PROVEEDOR ÃšNICO",      desc: "Todos los contratos registrados en SEACE para el perÃ­odo analizado fueron adjudicados a un Ãºnico proveedor. No se encontrÃ³ diversificaciÃ³n en la muestra disponible.",                       color: "bg-white text-black" },
};

const NAMED_REGIONS = ["LIMA", "LORETO", "CUSCO", "JUNÃN", "AREQUIPA", "PIURA", "LA LIBERTAD"];
const REGIONS = ["TODAS", ...NAMED_REGIONS, "OTRAS"];

const FALLBACK: Entity[] = [
  { ruc: "20131380951", name: "HOSPITAL NACIONAL ARZOBISPO LOAYZA", region: "LIMA", total_awarded: 12400000, unique_vendors: 2, total_contracts: 18, concentration_pct: 94, flags: ["CAPTURADA"], top_vendors: [{ ruc: "20523689879", name: "CORPRODI S.A.C.", total: 8700000, contracts: 12, share_pct: 70, score: 65, workers: 1 }, { ruc: "20601638658", name: "GRUPO HEVIMO S.A.C.", total: 2900000, contracts: 6, share_pct: 24, score: 65, workers: 0 }] },
  { ruc: "20131380952", name: "GOBIERNO REGIONAL LORETO", region: "LORETO", total_awarded: 31000000, unique_vendors: 3, total_contracts: 24, concentration_pct: 88, flags: ["CAPTURADA"], top_vendors: [{ ruc: "20590123456", name: "CONSORCIO VERDE AMAZÃ“NICO", total: 18000000, contracts: 10, share_pct: 58, score: 80, workers: 0 }, { ruc: "20476543210", name: "CONSORCIO ENERGÃ‰TICO AMAZÃ“NICO", total: 7500000, contracts: 8, share_pct: 24, score: 95, workers: 0 }, { ruc: "20589012345", name: "TRANSPORTES AMAZÃ“NICOS S.A.C.", total: 2000000, contracts: 6, share_pct: 6, score: 64, workers: 1 }] },
  { ruc: "20131380953", name: "DIRECCIÃ“N REGIONAL DE SALUD CUSCO", region: "CUSCO", total_awarded: 9800000, unique_vendors: 4, total_contracts: 15, concentration_pct: 76, flags: ["OLIGOPOLIO"], top_vendors: [{ ruc: "20432109876", name: "HIDROELÃ‰CTRICA SIERRA S.A.C.", total: 4500000, contracts: 6, share_pct: 46, score: 82, workers: 2 }, { ruc: "20555123456", name: "CONSTRUMAX PERU S.A.C.", total: 2800000, contracts: 5, share_pct: 29, score: 72, workers: 3 }] },
  { ruc: "20131380954", name: "MUNICIPALIDAD DISTRITAL DE MAYNAS", region: "LORETO", total_awarded: 4200000, unique_vendors: 1, total_contracts: 8, concentration_pct: 100, flags: ["PROVEEDOR_ÃšNICO"], top_vendors: [{ ruc: "20604035873", name: "SERVICIOS DACHI E.I.R.L.", total: 4200000, contracts: 8, share_pct: 100, score: 65, workers: 2 }] },
  { ruc: "20131380955", name: "MUNICIPALIDAD PROVINCIAL DE HUANCAYO", region: "JUNÃN", total_awarded: 7600000, unique_vendors: 5, total_contracts: 22, concentration_pct: 68, flags: ["OLIGOPOLIO"], top_vendors: [{ ruc: "20587654321", name: "INFRAESTRUCTURA NATIVA E.I.R.L.", total: 3200000, contracts: 9, share_pct: 42, score: 77, workers: 0 }, { ruc: "20498765432", name: "OBRAS CIVILES INTEGRALES E.I.R.L.", total: 1800000, contracts: 7, share_pct: 24, score: 76, workers: 1 }] },
];

function fmtMonto(n: number) {
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`;
  return `S/ ${(n / 1_000).toFixed(0)}K`;
}

function generateEntityNarrative(e: Entity): string {
  const top1 = e.top_vendors[0];
  const top3share = e.top_vendors.slice(0, 3).reduce((s, v) => s + v.share_pct, 0);

  let text = `${e.name} adjudicÃ³ ${fmtMonto(e.total_awarded)} en ${e.total_contracts} contrato${e.total_contracts !== 1 ? "s" : ""} registrados en SEACE â€” el ${e.concentration_pct}% de ese gasto se concentrÃ³ en solo ${Math.min(e.unique_vendors, 3)} proveedor${e.unique_vendors !== 1 ? "es" : ""}.`;

  if (top1) {
    text += ` El proveedor con mayor participaciÃ³n en el perÃ­odo analizado, ${top1.name}, concentrÃ³ el ${top1.share_pct}% del gasto registrado: ${fmtMonto(top1.total)}`;
    if (top1.workers !== undefined && top1.workers <= 2) {
      text += `, que registra un mÃ¡ximo de ${top1.workers} trabajador${top1.workers !== 1 ? "es" : ""} en SUNAT`;
    }
    text += ".";
  }

  if (e.concentration_pct >= 80) {
    text += ` En los contratos analizados, este nivel de concentraciÃ³n activa la seÃ±al de CAPTURA INSTITUCIONAL: sin evidencia de competencia real en las adjudicaciones registradas en SEACE para el perÃ­odo cubierto.`;
  } else if (e.concentration_pct >= 60) {
    text += ` En los contratos analizados, este nivel activa la seÃ±al de OLIGOPOLIO: competencia limitada en las adjudicaciones registradas en SEACE para el perÃ­odo cubierto.`;
  }

  // suppress unused variable warning
  void top3share;

  return text;
}

function ConcentrationBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white bg-opacity-10 relative">
        {/* 80% threshold marker */}
        <div className="absolute top-0 bottom-0 w-px bg-white opacity-30" style={{ left: "80%" }} />
        <div
          className={`h-full transition-all ${pct >= 80 ? "bg-white" : pct >= 60 ? "bg-white opacity-60" : "bg-white opacity-30"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-black w-10 text-right ${pct >= 80 ? "" : "opacity-60"}`}>{pct}%</span>
    </div>
  );
}

export default function EntidadesPage() {
  const [entities, setEntities]   = useState<Entity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const [region, setRegion]         = useState("TODAS");
  const [minConc, setMinConc]       = useState(0);
  const [flagFilter, setFlagFilter] = useState<string>("TODAS");
  const [sortBy, setSortBy]         = useState<"concentration_pct" | "total_awarded" | "unique_vendors">("concentration_pct");
  const [sortDir, setSortDir]       = useState<"desc" | "asc">("desc");

  useEffect(() => {
    fetch("/api/entidades")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: Entity[]) => { setEntities(d.length > 0 ? d : FALLBACK); setLoading(false); })
      .catch((err) => { console.error(err); setEntities(FALLBACK); setError(String(err)); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return entities
      .filter((e) => {
        if (region !== "TODAS") {
          if (region === "OTRAS") { if (NAMED_REGIONS.includes(e.region)) return false; }
          else { if (e.region !== region) return false; }
        }
        if (e.concentration_pct < minConc) return false;
        if (flagFilter !== "TODAS" && !e.flags.includes(flagFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        const mul = sortDir === "desc" ? -1 : 1;
        return (a[sortBy] - b[sortBy]) * mul;
      });
  }, [entities, region, minConc, flagFilter, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const stats = useMemo(() => ({
    capturadas:  entities.filter((e) => e.flags.includes("CAPTURADA")).length,
    oligopolios: entities.filter((e) => e.flags.includes("OLIGOPOLIO")).length,
    unico:       entities.filter((e) => e.flags.includes("PROVEEDOR_ÃšNICO")).length,
    total:       entities.length,
  }), [entities]);

  return (
    <main className="min-h-screen bg-black text-white font-mono">

      {/* Header */}
      <section className="border-b border-white px-6 py-10 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-3">
            {loading ? "CARGANDO..." : `ENTIDADES PÃšBLICAS â€” ${filtered.length} ORGANISMOS`}
          </p>
          <h1 className="text-5xl font-black tracking-tighter leading-none flicker mb-4">
            ANÃLISIS DEL COMPRADOR
          </h1>
          <p className="text-xs opacity-40 max-w-xl leading-5">
            El Ã¡ngulo que falta: quiÃ©n compra, no solo quiÃ©n vende. Organismos pÃºblicos con
            patrones anÃ³malos de concentraciÃ³n, proveedor Ãºnico o adjudicaciones recurrentes.
            No constituye acusaciÃ³n.
          </p>

          {/* Summary stats */}
          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-white mt-8">
              {[
                { label: "ENTIDADES ANALIZADAS", value: stats.total },
                { label: "ENTIDADES CAPTURADAS", value: stats.capturadas, alert: stats.capturadas > 0 },
                { label: "CON OLIGOPOLIO", value: stats.oligopolios, alert: stats.oligopolios > 0 },
                { label: "PROVEEDOR ÃšNICO", value: stats.unico, alert: stats.unico > 0 },
              ].map((s, i) => (
                <div key={i} className={`p-6 border-r border-white last:border-r-0 ${s.alert ? "bg-white text-black" : ""}`}>
                  <p className="text-4xl font-black">{s.value}</p>
                  <p className={`text-xs tracking-wider mt-1 ${s.alert ? "opacity-60" : "opacity-40"}`}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Caso mÃ¡s crÃ­tico */}
      {!loading && entities.length > 0 && (() => {
        const worstCase = entities[0];
        return (
          <section className="border-b border-white px-6 py-8 md:px-16 bg-white text-black">
            <div className="max-w-7xl mx-auto">
              <p className="text-xs tracking-[0.4em] opacity-50 mb-4">CASO MÃS CRÃTICO DETECTADO</p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <h2 className="text-2xl font-black leading-tight mb-3">{worstCase.name}</h2>
                  <p className="text-sm leading-7 opacity-80">
                    {generateEntityNarrative(worstCase)}
                  </p>
                </div>
                <div className="border border-black p-4 text-xs">
                  <p className="font-black tracking-widest mb-3 opacity-50">MÃ‰TRICAS CLAVE</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="opacity-60">ConcentraciÃ³n top-3</span>
                      <span className="font-black">{worstCase.concentration_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">Total adjudicado</span>
                      <span className="font-black">{fmtMonto(worstCase.total_awarded)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">Proveedores distintos</span>
                      <span className="font-black">{worstCase.unique_vendors}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">Total contratos</span>
                      <span className="font-black">{worstCase.total_contracts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">RegiÃ³n</span>
                      <span className="font-black">{worstCase.region}</span>
                    </div>
                    {worstCase.flags.length > 0 && (
                      <div className="border-t border-black border-opacity-20 pt-2 mt-1 flex flex-wrap gap-1">
                        {worstCase.flags.map((f) => (
                          <span key={f} className="border border-black px-2 py-0.5 font-black text-xs">
                            {f.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Filters */}
      <section className="border-b border-white px-6 py-5 md:px-16">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 items-end">

          {/* Flag filter */}
          <div>
            <p className="text-xs opacity-40 mb-2 tracking-widest">PATRÃ“N</p>
            <div className="flex gap-1">
              {["TODAS", "CAPTURADA", "OLIGOPOLIO", "PROVEEDOR_ÃšNICO"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFlagFilter(f)}
                  className={`text-xs px-3 py-1 border transition-colors ${
                    flagFilter === f ? "bg-white text-black border-white" : "border-white border-opacity-30 opacity-50 hover:opacity-100"
                  }`}
                >
                  {f === "TODAS" ? "TODOS" : f.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Region */}
          <div>
            <p className="text-xs opacity-40 mb-2 tracking-widest">REGIÃ“N</p>
            <div className="flex flex-wrap gap-1">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`text-xs px-3 py-1 border transition-colors ${
                    region === r ? "bg-white text-black border-white" : "border-white border-opacity-30 opacity-50 hover:opacity-100"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Min concentration */}
          <div>
            <p className="text-xs opacity-40 mb-2 tracking-widest">CONCENTRACIÃ“N MÃNIMA: {minConc}%</p>
            <input
              type="range" min={0} max={100} step={10}
              value={minConc}
              onChange={(e) => setMinConc(Number(e.target.value))}
              className="w-36 accent-white"
            />
          </div>

          {error && <p className="text-xs opacity-30 ml-auto self-end">DB offline â€” muestra estÃ¡tica</p>}
        </div>
      </section>

      {/* Table */}
      <section className="px-6 py-8 md:px-16">
        <div className="max-w-7xl mx-auto">

          {/* Desktop */}
          <div className="hidden md:block border border-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white bg-white text-black">
                  <th className="text-left p-4 font-black tracking-widest">ENTIDAD PÃšBLICA</th>
                  <th className="text-center p-4 font-black tracking-widest">REGIÃ“N</th>
                  <th
                    className="text-right p-4 font-black tracking-widest cursor-pointer hover:opacity-70"
                    onClick={() => toggleSort("total_awarded")}
                  >
                    ADJUDICADO {sortBy === "total_awarded" ? (sortDir === "desc" ? "â†“" : "â†‘") : "Â·"}
                  </th>
                  <th
                    className="text-right p-4 font-black tracking-widest cursor-pointer hover:opacity-70"
                    onClick={() => toggleSort("unique_vendors")}
                  >
                    PROVEEDORES {sortBy === "unique_vendors" ? (sortDir === "desc" ? "â†“" : "â†‘") : "Â·"}
                  </th>
                  <th
                    className="p-4 font-black tracking-widest cursor-pointer hover:opacity-70 w-48"
                    onClick={() => toggleSort("concentration_pct")}
                  >
                    CONCENTRACIÃ“N TOP-3 {sortBy === "concentration_pct" ? (sortDir === "desc" ? "â†“" : "â†‘") : "Â·"}
                  </th>
                  <th className="p-4 font-black tracking-widest">PATRÃ“N</th>
                  <th className="p-4 w-8" />
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(8)].map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-white border-opacity-20">
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-64 mb-1.5" /><div className="h-3 bg-white opacity-5 animate-pulse w-32" /></td>
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-16 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-20 ml-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-8 ml-auto" /></td>
                    <td className="p-4"><div className="h-2 bg-white opacity-10 animate-pulse w-full" /></td>
                    <td className="p-4"><div className="h-5 bg-white opacity-10 animate-pulse w-24" /></td>
                    <td className="p-4" />
                  </tr>
                ))}
                {!loading && filtered.map((e) => (
                  <>
                    <tr
                      key={e.ruc || e.name}
                      className="risk-row border-b border-white border-opacity-20 cursor-pointer"
                      onClick={() => setExpanded(expanded === (e.ruc || e.name) ? null : (e.ruc || e.name))}
                    >
                      <td className="p-4">
                        <p className="font-bold leading-snug">{e.name}</p>
                        {e.ruc && <p className="opacity-40 mt-0.5">RUC {e.ruc}</p>}
                      </td>
                      <td className="p-4 text-center opacity-60">{e.region}</td>
                      <td className="p-4 text-right font-bold">{fmtMonto(e.total_awarded)}</td>
                      <td className="p-4 text-right font-black text-lg">{e.unique_vendors}</td>
                      <td className="p-4">
                        <ConcentrationBar pct={e.concentration_pct} />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {e.flags.map((f) => (
                            <span key={f} className={`text-xs px-2 py-0.5 font-black border border-white ${e.flags.includes("CAPTURADA") || e.flags.includes("PROVEEDOR_ÃšNICO") ? "bg-white text-black" : "opacity-60"}`}>
                              {f.replace("_", " ")}
                            </span>
                          ))}
                          {e.flags.length === 0 && <span className="opacity-20 text-xs">â€”</span>}
                        </div>
                      </td>
                      <td className="p-4 text-right opacity-30 text-lg">{expanded === (e.ruc || e.name) ? "â–²" : "â–¼"}</td>
                    </tr>

                    {expanded === (e.ruc || e.name) && (
                      <tr key={`${e.ruc}-exp`} className="border-b border-white">
                        <td colSpan={7} className="p-6 bg-white text-black">
                          <div className="grid md:grid-cols-3 gap-6 text-xs">

                            {/* Top vendors */}
                            <div className="md:col-span-2">
                              <p className="opacity-50 mb-3 font-black tracking-widest">DISTRIBUCIÃ“N DEL GASTO POR PROVEEDOR</p>
                              <div className="flex flex-col gap-2">
                                {e.top_vendors.map((v, i) => (
                                  <div key={v.ruc || i} className="flex items-center gap-3">
                                    <span className="opacity-40 w-4 shrink-0">{i + 1}</span>
                                    <div className="flex-1">
                                      <div className="flex justify-between mb-0.5">
                                        <span className="flex items-center gap-1">
                                          <Link
                                            href={`/empresa/${v.ruc}`}
                                            onClick={(ev) => ev.stopPropagation()}
                                            className="font-bold underline decoration-dotted hover:opacity-70"
                                          >
                                            {v.name}
                                          </Link>
                                          {v.score > 50 && (
                                            <span className="text-xs border border-black px-1 ml-1 opacity-70 font-black">âš  {v.score}</span>
                                          )}
                                        </span>
                                        <span className="font-black ml-2 shrink-0">{v.share_pct}%</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1 bg-black bg-opacity-10">
                                          <div className="h-full bg-black" style={{ width: `${v.share_pct}%` }} />
                                        </div>
                                        <span className="opacity-50 shrink-0">{fmtMonto(v.total)} Â· {v.contracts} contratos</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Flag detail + stats */}
                            <div className="flex flex-col gap-4">
                              {e.flags.map((f) => {
                                const meta = FLAG_META[f];
                                return meta ? (
                                  <div key={f} className="border border-black p-3">
                                    <p className="font-black tracking-wider mb-1">âš  {meta.label}</p>
                                    <p className="opacity-60 leading-5">{meta.desc}</p>
                                  </div>
                                ) : null;
                              })}
                              <div className="border border-black border-opacity-20 p-3 opacity-60">
                                <p className="font-black mb-2 tracking-wider">ESTADÃSTICAS</p>
                                <p>Total adjudicado: <strong>{fmtMonto(e.total_awarded)}</strong></p>
                                <p>Contratos totales: <strong>{e.total_contracts}</strong></p>
                                <p>Proveedores distintos: <strong>{e.unique_vendors}</strong></p>
                                <p>ConcentraciÃ³n top 3: <strong>{e.concentration_pct}%</strong></p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden flex flex-col gap-3">
            {loading && [...Array(5)].map((_, i) => (
              <div key={`msk-${i}`} className="border border-white border-opacity-20 p-4">
                <div className="h-4 bg-white opacity-10 animate-pulse w-3/4 mb-2" />
                <div className="h-3 bg-white opacity-5 animate-pulse w-1/2 mb-4" />
                <div className="h-2 bg-white opacity-10 animate-pulse w-full" />
              </div>
            ))}
            {!loading && filtered.map((e) => (
              <div
                key={e.ruc || e.name}
                className="border border-white p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === (e.ruc || e.name) ? null : (e.ruc || e.name))}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-sm leading-snug flex-1 pr-2">{e.name}</p>
                  {e.flags.length > 0 && (
                    <span className="text-xs border border-white px-2 py-0.5 font-black shrink-0 bg-white text-black">
                      {e.flags[0].replace("_", " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-40 mb-3">{e.region} Â· {e.total_contracts} contratos</p>
                <div className="mb-3">
                  <p className="text-xs opacity-40 mb-1">CONCENTRACIÃ“N TOP-3</p>
                  <ConcentrationBar pct={e.concentration_pct} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="opacity-40">ADJUDICADO</p><p className="font-bold">{fmtMonto(e.total_awarded)}</p></div>
                  <div><p className="opacity-40">PROVEEDORES</p><p className="font-black text-xl">{e.unique_vendors}</p></div>
                </div>

                {expanded === (e.ruc || e.name) && (
                  <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                    <p className="text-xs opacity-40 mb-2 tracking-widest">TOP PROVEEDORES</p>
                    {e.top_vendors.map((v, i) => (
                      <div key={v.ruc || i} className="flex justify-between text-xs py-1 border-b border-white border-opacity-10">
                        <Link href={`/empresa/${v.ruc}`} onClick={(ev) => ev.stopPropagation()} className="font-bold opacity-80 underline decoration-dotted">
                          {v.name.slice(0, 28)}{v.name.length > 28 ? "â€¦" : ""}
                        </Link>
                        <span className="font-black opacity-60">{v.share_pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="border border-white p-12 text-center">
              <p className="text-xs opacity-40 tracking-widest">SIN RESULTADOS PARA LOS FILTROS SELECCIONADOS</p>
            </div>
          )}

          <p className="text-xs opacity-20 mt-6">
            {filtered.length} de {entities.length} entidades Â· Ãndice de concentraciÃ³n sobre contratos registrados en SEACE
            {error && <span className="ml-3"> Â· DB offline â€” muestra estÃ¡tica</span>}
          </p>
        </div>
      </section>

      {/* Methodology note */}
      <section className="border-t border-white border-opacity-20 px-6 py-6 md:px-16">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6 text-xs opacity-30">
          <div>
            <p className="font-black tracking-widest mb-1">ÃNDICE DE CONCENTRACIÃ“N</p>
            <p className="leading-5">% del gasto total de la entidad que va a los 3 mayores proveedores. Inspirado en el Ã­ndice Herfindahl-Hirschman (HHI) adaptado a contrataciÃ³n pÃºblica.</p>
          </div>
          <div>
            <p className="font-black tracking-widest mb-1">UMBRALES</p>
            <p className="leading-5">â‰¥80% = CAPTURADA Â· â‰¥60% = OLIGOPOLIO Â· 1 proveedor con â‰¥3 contratos = PROVEEDOR ÃšNICO. Umbrales de referencia â€” no normativos.</p>
          </div>
          <div>
            <p className="font-black tracking-widest mb-1">FUENTE</p>
            <p className="leading-5">Contratos adjudicados SEACE 2021â€“2026 ingresados en grafo Neo4j. No incluye contrataciones menores a S/ 8 UIT ni compras corporativas.</p>
          </div>
        </div>
      </section>
    </main>
  );
}


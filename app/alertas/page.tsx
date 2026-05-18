"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

type Flag = {
  code: string;
  label: string;
  group: "A" | "B" | "C" | "D";
};

const FLAG_CATALOG: Flag[] = [
  { code: "F1", label: "EMPRESA FANTASMA", group: "A" },
  { code: "F2", label: "DOMICILIO COMPARTIDO", group: "A" },
  { code: "F3", label: "SIN TRABAJADORES", group: "A" },
  { code: "F4", label: "GEO-MISMATCH", group: "A" },
  { code: "F5", label: "CLIENTE CAUTIVO", group: "B" },
  { code: "F6", label: "ENTIDAD CAPTURADA", group: "B" },
  { code: "F7", label: "FRACCIONAMIENTO", group: "B" },
  { code: "F8", label: "RÁFAGA FIN DE AÑO", group: "B" },
  { code: "F9", label: "CONCENTRACIÓN EXTREMA", group: "B" },
  { code: "F10", label: "PROVEEDOR MONÓGAMO", group: "B" },
  { code: "F11", label: "RUC INCOMPLETO", group: "B" },
  { code: "F12", label: "MONTO OUTLIER", group: "B" },
  { code: "F13", label: "DOSSIER HIGH-RISK", group: "C" },
  { code: "F14", label: "FLAGS TDR", group: "C" },
  { code: "F15", label: "CAPACIDAD CERO", group: "D" },
  { code: "F16", label: "REPR. COMPARTIDO", group: "D" },
  { code: "F17", label: "DEUDA FISCAL", group: "D" },
  { code: "F18", label: "CIIU MISMATCH", group: "D" },
  { code: "F19", label: "EMPRESA RECIENTE", group: "D" },
];

const NAMED_REGIONS = ["LIMA", "LORETO", "CUSCO", "JUNÍN", "AREQUIPA", "PIURA", "LA LIBERTAD"];
const REGIONS = ["TODAS", ...NAMED_REGIONS, "OTRAS"];

type Case = {
  name: string;
  ruc: string;
  workers: number;
  total: number;
  contracts: number;
  score: number;
  region: string;
  sector: string;
  flags: string[];
  entities: string[];
};

const EMPTY: Case[] = [];

// kept only as offline fallback — real data comes from /api/alertas
const ALL_CASES_FALLBACK: Case[] = [
  {
    name: "CORPRODI S.A.C.",
    ruc: "20523689879",
    workers: 1,
    total: 10083803,
    contracts: 6,
    score: 75,
    region: "LORETO",
    sector: "SALUD",
    flags: ["F3", "F17", "F19"],
    entities: ["GOBIERNO REGIONAL LORETO", "ESSALUD", "MUNICIPALIDAD IQUITOS"],
  },
  {
    name: "GRUPO HEVIMO S.A.C.",
    ruc: "20601638658",
    workers: 0,
    total: 9902548,
    contracts: 24,
    score: 85,
    region: "LIMA",
    sector: "OBRAS",
    flags: ["F3", "F17", "F6", "F10"],
    entities: ["MUNIC. PACHACAMAC", "MUNIC. CHOTA", "MUNIC. RIOJA", "+14 más"],
  },
  {
    name: "SERVICIOS DACHI E.I.R.L.",
    ruc: "20604035873",
    workers: 2,
    total: 3194779,
    contracts: 15,
    score: 70,
    region: "LORETO",
    sector: "DEFENSA",
    flags: ["F3", "F17", "F8"],
    entities: ["FUERZA AÉREA DEL PERÚ", "GOBIERNO REGIONAL LORETO", "MUNIC. MAYNAS"],
  },
  {
    name: "DAFA MEDIC E.I.R.L.",
    ruc: "20606381264",
    workers: 0,
    total: 886600,
    contracts: 2,
    score: 65,
    region: "LIMA",
    sector: "SALUD",
    flags: ["F3", "F17", "F18"],
    entities: ["ESSALUD", "MINSA"],
  },
  {
    name: "GRIFO SAN JUAN S.R.L.",
    ruc: "20531570929",
    workers: 1,
    total: 759418,
    contracts: 4,
    score: 60,
    region: "OTRAS",
    sector: "COMBUSTIBLES",
    flags: ["F3", "F17", "F4"],
    entities: ["MUNICIPALIDADES DIVERSAS"],
  },
  {
    name: "CONSTRUMAX PERU S.A.C.",
    ruc: "20555123456",
    workers: 3,
    total: 4200000,
    contracts: 8,
    score: 72,
    region: "CUSCO",
    sector: "OBRAS",
    flags: ["F2", "F16", "F9"],
    entities: ["MUNICIPALIDAD CUSCO", "GOBIERNO REGIONAL CUSCO"],
  },
  {
    name: "INVERSIONES NOVA E.I.R.L.",
    ruc: "20578901234",
    workers: 0,
    total: 1850000,
    contracts: 3,
    score: 68,
    region: "JUNÍN",
    sector: "SERVICIOS",
    flags: ["F3", "F1", "F19"],
    entities: ["MUNICIPALIDAD HUANCAYO"],
  },
  {
    name: "TECH SOLUTIONS ANDINAS S.A.C.",
    ruc: "20534567890",
    workers: 2,
    total: 6750000,
    contracts: 11,
    score: 78,
    region: "LIMA",
    sector: "TIC",
    flags: ["F3", "F5", "F7", "F17"],
    entities: ["MINEDU", "PCM", "MINSA"],
  },
  {
    name: "DISTRIBUIDORA CENTRAL S.R.L.",
    ruc: "20512345678",
    workers: 1,
    total: 2300000,
    contracts: 6,
    score: 62,
    region: "PIURA",
    sector: "SUMINISTROS",
    flags: ["F3", "F17", "F11"],
    entities: ["GOBIERNO REGIONAL PIURA", "MUNICIPALIDADES"],
  },
  {
    name: "CONSORCIO VERDE AMAZÓNICO",
    ruc: "20589012345",
    workers: 0,
    total: 3900000,
    contracts: 5,
    score: 80,
    region: "LORETO",
    sector: "AMBIENTE",
    flags: ["F3", "F1", "F18", "F19"],
    entities: ["MINAM", "GOBIERNO REGIONAL LORETO"],
  },
  {
    name: "SERVICIOS INTEGRALES NORTE S.A.C.",
    ruc: "20567890123",
    workers: 4,
    total: 8100000,
    contracts: 18,
    score: 73,
    region: "LA LIBERTAD",
    sector: "OBRAS",
    flags: ["F2", "F9", "F8"],
    entities: ["MUNICIPALIDAD TRUJILLO", "GOBIERNO REGIONAL LA LIBERTAD"],
  },
  {
    name: "PROVEEDOR MÉDICO SELVA E.I.R.L.",
    ruc: "20590123456",
    workers: 0,
    total: 1200000,
    contracts: 4,
    score: 70,
    region: "LORETO",
    sector: "SALUD",
    flags: ["F3", "F18", "F17"],
    entities: ["DIRESA LORETO", "ESSALUD"],
  },
  {
    name: "SOLUCIONES VIALES S.A.C.",
    ruc: "20601234987",
    workers: 0,
    total: 14500000,
    contracts: 9,
    score: 92,
    region: "LIMA",
    sector: "OBRAS",
    flags: ["F3", "F1", "F17", "F9"],
    entities: ["MTC", "PROVÍAS NACIONAL", "MUNICIPALIDAD LIMA"],
  },
  {
    name: "ECORECURSOS ANDINOS E.I.R.L.",
    ruc: "20612345089",
    workers: 1,
    total: 2100000,
    contracts: 7,
    score: 66,
    region: "AREQUIPA",
    sector: "AMBIENTE",
    flags: ["F3", "F19", "F4"],
    entities: ["OEFA", "GOBIERNO REGIONAL AREQUIPA"],
  },
  {
    name: "MULTISERVICIOS PALOMINO S.R.L.",
    ruc: "20503214789",
    workers: 2,
    total: 980000,
    contracts: 12,
    score: 61,
    region: "CUSCO",
    sector: "SERVICIOS",
    flags: ["F7", "F8", "F3"],
    entities: ["MUNICIPALIDAD CUSCO", "MINCULTURA"],
  },
  {
    name: "FARMA RURAL DEL PERÚ S.A.C.",
    ruc: "20598765432",
    workers: 0,
    total: 5400000,
    contracts: 6,
    score: 83,
    region: "LIMA",
    sector: "SALUD",
    flags: ["F3", "F17", "F18", "F5"],
    entities: ["DIGEMID", "ESSALUD", "MINSA"],
  },
  {
    name: "INFRAESTRUCTURA NATIVA E.I.R.L.",
    ruc: "20587654321",
    workers: 0,
    total: 3250000,
    contracts: 5,
    score: 77,
    region: "JUNÍN",
    sector: "OBRAS",
    flags: ["F3", "F1", "F19", "F2"],
    entities: ["GOBIERNO REGIONAL JUNÍN", "MUNICIPALIDAD HUANCAYO"],
  },
  {
    name: "GLOBAL TECH PERUANA S.A.",
    ruc: "20499876543",
    workers: 3,
    total: 18700000,
    contracts: 14,
    score: 88,
    region: "LIMA",
    sector: "TIC",
    flags: ["F9", "F6", "F16", "F7"],
    entities: ["PCM", "MINEDU", "RENIEC", "SUNARP"],
  },
  {
    name: "TRANSPORTES AMAZÓNICOS S.A.C.",
    ruc: "20576543210",
    workers: 1,
    total: 1670000,
    contracts: 8,
    score: 64,
    region: "LORETO",
    sector: "TRANSPORTE",
    flags: ["F3", "F4", "F17"],
    entities: ["GOREL", "MUNICIPALIDAD IQUITOS"],
  },
  {
    name: "CONSTRUCCIONES DEL SUR E.I.R.L.",
    ruc: "20565432109",
    workers: 2,
    total: 4800000,
    contracts: 10,
    score: 74,
    region: "AREQUIPA",
    sector: "OBRAS",
    flags: ["F2", "F16", "F8", "F3"],
    entities: ["GOBIERNO REGIONAL AREQUIPA", "MUNICIPALIDAD AREQUIPA"],
  },
  {
    name: "SUMINISTROS HOSPITALARIOS DEL NORTE S.A.C.",
    ruc: "20554321098",
    workers: 0,
    total: 7300000,
    contracts: 11,
    score: 87,
    region: "LA LIBERTAD",
    sector: "SALUD",
    flags: ["F3", "F17", "F9", "F18"],
    entities: ["HOSPITAL VÍCTOR LAZARTE", "DIRESA LA LIBERTAD", "ESSALUD"],
  },
  {
    name: "CONSULTORES ESTRATÉGICOS E.I.R.L.",
    ruc: "20543210987",
    workers: 1,
    total: 2890000,
    contracts: 6,
    score: 69,
    region: "LIMA",
    sector: "CONSULTORÍA",
    flags: ["F5", "F10", "F19"],
    entities: ["MINISTERIO DE ECONOMÍA Y FINANZAS"],
  },
  {
    name: "AGROPECUARIA SIERRA VERDE S.A.C.",
    ruc: "20532109876",
    workers: 0,
    total: 1340000,
    contracts: 3,
    score: 63,
    region: "CUSCO",
    sector: "AGRO",
    flags: ["F3", "F18", "F11"],
    entities: ["AGRORURAL", "GOBIERNO REGIONAL CUSCO"],
  },
  {
    name: "SEGURIDAD PRIVADA ANDINA S.A.",
    ruc: "20521098765",
    workers: 5,
    total: 6100000,
    contracts: 13,
    score: 71,
    region: "LIMA",
    sector: "SEGURIDAD",
    flags: ["F9", "F6", "F8"],
    entities: ["SUNAFIL", "SUNAT", "INDECOPI", "+3 más"],
  },
  {
    name: "LABORATORIO DIAGNÓSTICO RÁPIDO E.I.R.L.",
    ruc: "20510987654",
    workers: 0,
    total: 890000,
    contracts: 3,
    score: 67,
    region: "PIURA",
    sector: "SALUD",
    flags: ["F3", "F1", "F17"],
    entities: ["DIRESA PIURA", "HOSPITAL SANTA ROSA"],
  },
  {
    name: "EQUIPOS MÉDICOS DEL PACÍFICO S.A.C.",
    ruc: "20509876543",
    workers: 2,
    total: 9100000,
    contracts: 7,
    score: 81,
    region: "LIMA",
    sector: "SALUD",
    flags: ["F3", "F17", "F12", "F18"],
    entities: ["ESSALUD", "MINSA", "INSTITUTO NACIONAL DE SALUD"],
  },
  {
    name: "OBRAS CIVILES INTEGRALES E.I.R.L.",
    ruc: "20498765432",
    workers: 1,
    total: 3600000,
    contracts: 9,
    score: 76,
    region: "JUNÍN",
    sector: "OBRAS",
    flags: ["F3", "F2", "F16", "F19"],
    entities: ["MUNICIPALIDAD CHANCHAMAYO", "GOBIERNO REGIONAL JUNÍN"],
  },
  {
    name: "IMPRESIONES Y PUBLICACIONES DEL ESTADO S.A.C.",
    ruc: "20487654321",
    workers: 0,
    total: 550000,
    contracts: 8,
    score: 60,
    region: "LIMA",
    sector: "SERVICIOS",
    flags: ["F3", "F7", "F11"],
    entities: ["MINEDU", "MUNICIPALIDAD LIMA"],
  },
  {
    name: "CONSORCIO ENERGÉTICO AMAZÓNICO",
    ruc: "20476543210",
    workers: 0,
    total: 22400000,
    contracts: 4,
    score: 95,
    region: "LORETO",
    sector: "ENERGÍA",
    flags: ["F3", "F1", "F12", "F9", "F19"],
    entities: ["MINEM", "ELECTRO ORIENTE", "GOBIERNO REGIONAL LORETO"],
  },
  {
    name: "PROVEEDORA EDUCATIVA DEL SUR S.R.L.",
    ruc: "20465432109",
    workers: 1,
    total: 1780000,
    contracts: 11,
    score: 63,
    region: "AREQUIPA",
    sector: "EDUCACIÓN",
    flags: ["F3", "F8", "F4"],
    entities: ["UGEL AREQUIPA", "GOBIERNO REGIONAL AREQUIPA"],
  },
  {
    name: "BIENES Y SERVICIOS NACIONALES S.A.",
    ruc: "20454321098",
    workers: 3,
    total: 11200000,
    contracts: 16,
    score: 79,
    region: "LIMA",
    sector: "SUMINISTROS",
    flags: ["F16", "F9", "F6", "F17"],
    entities: ["MIDIS", "PRONABEC", "QALI WARMA", "+4 más"],
  },
  {
    name: "VIGILANCIA ANDINA E.I.R.L.",
    ruc: "20443210987",
    workers: 0,
    total: 430000,
    contracts: 2,
    score: 58,
    region: "OTRAS",
    sector: "SEGURIDAD",
    flags: ["F3", "F1", "F19"],
    entities: ["MUNICIPALIDAD PROVINCIAL PUNO"],
  },
  {
    name: "HIDROELÉCTRICA SIERRA S.A.C.",
    ruc: "20432109876",
    workers: 2,
    total: 8750000,
    contracts: 5,
    score: 82,
    region: "CUSCO",
    sector: "ENERGÍA",
    flags: ["F3", "F12", "F18", "F17"],
    entities: ["ELECTRO SUR ESTE", "MINEM", "GOBIERNO REGIONAL CUSCO"],
  },
];

function fmtMonto(n: number) {
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`;
  return `S/ ${(n / 1_000).toFixed(0)}K`;
}

export default function AlertasPage() {
  const [cases, setCases] = useState<Case[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [region, setRegion] = useState("TODAS");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "total" | "contracts">("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/alertas")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Case[]) => {
        console.log("[alertas] API returned", data.length, "rows");
        setCases(data.length > 0 ? data : ALL_CASES_FALLBACK);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setCases(ALL_CASES_FALLBACK);
        setError(String(err));
        setLoading(false);
      });
  }, []);

  const toggleFlag = (code: string) => {
    setSelectedFlags((prev) =>
      prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code]
    );
  };

  const headerStats = useMemo(() => {
    const totalMonto = cases.reduce((sum, c) => sum + c.total, 0);
    const highRisk = cases.filter((c) => c.score >= 80).length;
    const flagCount: Record<string, number> = {};
    cases.forEach((c) => c.flags.forEach((f) => { flagCount[f] = (flagCount[f] ?? 0) + 1; }));
    let topFlag = "";
    let topFlagCount = 0;
    Object.entries(flagCount).forEach(([f, n]) => {
      if (n > topFlagCount) { topFlag = f; topFlagCount = n; }
    });
    const topFlagLabel = FLAG_CATALOG.find((f) => f.code === topFlag)?.label ?? topFlag;
    return { totalMonto, highRisk, topFlag, topFlagCount, topFlagLabel };
  }, [cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (region !== "TODAS") {
        if (region === "OTRAS") {
          if (NAMED_REGIONS.includes(c.region)) return false;
        } else {
          if (c.region !== region) return false;
        }
      }
      if (c.score < minScore) return false;
      if (selectedFlags.length > 0 && !selectedFlags.some((f) => c.flags.includes(f))) return false;
      return true;
    }).sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * mul;
    });
  }, [cases, selectedFlags, region, minScore, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  return (
    <main className="min-h-screen">

      {/* Header */}
      <section className="border-b border-white px-6 py-10 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-3">
            {loading ? "CARGANDO..." : `SEÑALES DE ALERTA — ${filtered.length} REGISTROS`}
          </p>
          <h1 className="text-5xl font-black tracking-tighter leading-none flicker">
            ALERTAS DETECTADAS
          </h1>
          {!loading && cases.length > 0 ? (
            <p className="text-sm opacity-60 mt-4 leading-7 max-w-2xl">
              {cases.length} proveedores presentan patrones estadísticos inusuales,
              acumulando {fmtMonto(headerStats.totalMonto)} en contratos públicos.{" "}
              {headerStats.highRisk} superan riesgo crítico (score ≥80).{" "}
              Patrón más frecuente: {headerStats.topFlag} ({headerStats.topFlagLabel}) — presente en {headerStats.topFlagCount} empresas.
            </p>
          ) : (
            <p className="text-xs opacity-40 mt-3 max-w-xl leading-5">
              Proveedores con combinaciones estadísticas inusuales. Datos públicos SEACE + SUNAT.
              No constituye acusación.
            </p>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-white px-6 py-6 md:px-16">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">

          {/* Flag filters */}
          <div>
            <p className="text-xs opacity-40 mb-3 tracking-widest">FILTRAR POR SEÑAL</p>
            <div className="flex flex-wrap gap-2">
              {FLAG_CATALOG.map((f) => (
                <button
                  key={f.code}
                  onClick={() => toggleFlag(f.code)}
                  className={`text-xs px-2 py-1 border transition-colors ${
                    selectedFlags.includes(f.code)
                      ? "bg-white text-black border-white"
                      : "border-white border-opacity-30 opacity-50 hover:opacity-100"
                  }`}
                >
                  {f.code} · {f.label}
                </button>
              ))}
              {selectedFlags.length > 0 && (
                <button
                  onClick={() => setSelectedFlags([])}
                  className="text-xs px-2 py-1 border border-white opacity-40 hover:opacity-100"
                >
                  LIMPIAR ×
                </button>
              )}
            </div>
          </div>

          {/* Region + score filters */}
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <p className="text-xs opacity-40 mb-2 tracking-widest">REGIÓN</p>
              <div className="flex flex-wrap gap-1">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(r)}
                    className={`text-xs px-3 py-1 border transition-colors ${
                      region === r
                        ? "bg-white text-black border-white"
                        : "border-white border-opacity-30 opacity-50 hover:opacity-100"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs opacity-40 mb-2 tracking-widest">SCORE MÍNIMO: {minScore}</p>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-40 accent-white"
              />
            </div>
          </div>
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
                  <th className="text-left p-4 font-black tracking-widest">PROVEEDOR</th>
                  <th className="text-center p-4 font-black tracking-widest">REGIÓN</th>
                  <th
                    className="text-right p-4 font-black tracking-widest cursor-pointer hover:opacity-70"
                    onClick={() => toggleSort("total")}
                  >
                    MONTO {sortBy === "total" ? (sortDir === "desc" ? "↓" : "↑") : "·"}
                  </th>
                  <th
                    className="text-right p-4 font-black tracking-widest cursor-pointer hover:opacity-70"
                    onClick={() => toggleSort("contracts")}
                  >
                    CONTRATOS {sortBy === "contracts" ? (sortDir === "desc" ? "↓" : "↑") : "·"}
                  </th>
                  <th className="text-right p-4 font-black tracking-widest">TRABAJ.</th>
                  <th
                    className="text-right p-4 font-black tracking-widest cursor-pointer hover:opacity-70"
                    onClick={() => toggleSort("score")}
                  >
                    SCORE {sortBy === "score" ? (sortDir === "desc" ? "↓" : "↑") : "·"}
                  </th>
                  <th className="p-4 font-black tracking-widest">SEÑALES</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(8)].map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-white border-opacity-20">
                    <td className="p-4">
                      <div className="h-4 bg-white opacity-10 animate-pulse w-48 mb-1.5" />
                      <div className="h-3 bg-white opacity-5 animate-pulse w-32" />
                    </td>
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-16 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-20 ml-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-white opacity-10 animate-pulse w-8 ml-auto" /></td>
                    <td className="p-4"><div className="h-6 bg-white opacity-10 animate-pulse w-6 ml-auto" /></td>
                    <td className="p-4"><div className="h-6 bg-white opacity-10 animate-pulse w-12 ml-auto" /></td>
                    <td className="p-4"><div className="flex gap-1"><div className="h-5 bg-white opacity-10 animate-pulse w-8" /><div className="h-5 bg-white opacity-10 animate-pulse w-8" /></div></td>
                    <td className="p-4" />
                  </tr>
                ))}
                {!loading && filtered.map((c) => (
                  <>
                    <tr
                      key={c.ruc}
                      className="risk-row border-b border-white border-opacity-20"
                      onClick={() => setExpanded(expanded === c.ruc ? null : c.ruc)}
                    >
                      <td className="p-4">
                        <p className="font-bold">{c.name}</p>
                        <p className="opacity-40 mt-0.5">RUC {c.ruc} · {c.sector}</p>
                      </td>
                      <td className="p-4 text-center opacity-60">{c.region}</td>
                      <td className="p-4 text-right font-bold">{fmtMonto(c.total)}</td>
                      <td className="p-4 text-right">{c.contracts}</td>
                      <td className="p-4 text-right font-black text-lg">{c.workers}</td>
                      <td className="p-4 text-right">
                        <span className="inline-block border border-current px-2 py-1 font-black">
                          {c.score}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {c.flags.map((f) => (
                            <span key={f} className="text-xs border border-current px-1 opacity-60">
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/empresa/${c.ruc}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs border border-white px-2 py-1 hover:bg-white hover:text-black transition-colors opacity-50 hover:opacity-100"
                        >
                          VER →
                        </Link>
                      </td>
                    </tr>
                    {expanded === c.ruc && (
                      <tr key={`${c.ruc}-exp`} className="border-b border-white">
                        <td colSpan={8} className="p-6 bg-white text-black">
                          <p className="text-sm leading-6 mb-5 max-w-3xl opacity-80">
                            Empresa con <strong>{c.workers} trabajador{c.workers !== 1 ? "es" : ""}</strong> registrado{c.workers !== 1 ? "s" : ""} en SUNAT
                            que acumuló <strong>{fmtMonto(c.total)}</strong> en <strong>{c.contracts}</strong> contratos con {c.entities.length} entidad{c.entities.length !== 1 ? "es" : ""} pública{c.entities.length !== 1 ? "s" : ""} distintas
                            — incluyendo {c.entities[0]}. {c.flags.length} señal{c.flags.length !== 1 ? "es" : ""} activa{c.flags.length !== 1 ? "s" : ""} detectadas.
                          </p>
                          <div className="grid grid-cols-3 gap-6 text-xs">
                            <div>
                              <p className="opacity-50 mb-2 font-black tracking-widest">ENTIDADES CONTRATANTES</p>
                              {c.entities.map((e, i) => (
                                <p key={i} className="py-1 border-b border-black border-opacity-10 font-bold">▶ {e}</p>
                              ))}
                            </div>
                            <div>
                              <p className="opacity-50 mb-2 font-black tracking-widest">SEÑALES ACTIVAS</p>
                              {c.flags.map((f) => {
                                const meta = FLAG_CATALOG.find((fc) => fc.code === f);
                                const flagDescs: Record<string, string> = {
                                  F1:  `Estado irregular (${c.sector ?? "BAJA"}) con contratos activos registrados`,
                                  F2:  `Domicilio fiscal compartido con otras empresas proveedoras del Estado`,
                                  F3:  `Máximo ${c.workers} trabajador(es) con ${fmtMonto(c.total)} en contratos`,
                                  F5:  `${c.contracts} contratos adjudicados por una única entidad`,
                                  F11: `RUC con formato incorrecto — empresa no verificable`,
                                  F16: `Representante legal en común con otras empresas del Estado`,
                                  F17: `Deuda fiscal registrada en SUNAT al momento del análisis`,
                                  F19: `Empresa de reciente constitución con contratos inmediatos`,
                                };
                                const desc = flagDescs[f];
                                return (
                                  <div key={f} className="py-1.5 border-b border-black border-opacity-10">
                                    <p className="font-bold">⚠ {f} — {meta?.label}</p>
                                    {desc && (
                                      <p className="text-xs opacity-50 mt-0.5 leading-4">{desc}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="border border-black p-4">
                              <p className="opacity-50 mb-2 font-black tracking-widest">ACCIONES</p>
                              <Link
                                href={`/empresa/${c.ruc}`}
                                className="block w-full text-center border border-black py-2 mb-2 hover:bg-black hover:text-white transition-colors font-bold"
                              >
                                VER PERFIL COMPLETO →
                              </Link>
                              <p className="text-xs opacity-40 leading-5 mt-3">
                                Indicadores estadísticos automatizados. No conclusión jurídica.
                              </p>
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
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="h-4 bg-white opacity-10 animate-pulse w-40 mb-1.5" />
                    <div className="h-3 bg-white opacity-5 animate-pulse w-28" />
                  </div>
                  <div className="h-7 bg-white opacity-10 animate-pulse w-12" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j}><div className="h-3 bg-white opacity-5 animate-pulse w-16 mb-1" /><div className="h-6 bg-white opacity-10 animate-pulse w-10" /></div>
                  ))}
                </div>
                <div className="flex gap-1"><div className="h-5 bg-white opacity-10 animate-pulse w-10" /><div className="h-5 bg-white opacity-10 animate-pulse w-10" /></div>
              </div>
            ))}
            {!loading && filtered.map((c) => (
              <div key={c.ruc} className="border border-white p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-xs opacity-40">RUC {c.ruc} · {c.region}</p>
                  </div>
                  <span className="border border-white px-2 py-1 text-xs font-black">{c.score}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div><p className="opacity-40">TRABAJADORES</p><p className="font-black text-xl">{c.workers}</p></div>
                  <div><p className="opacity-40">CONTRATOS</p><p className="font-black text-xl">{c.contracts}</p></div>
                  <div><p className="opacity-40">MONTO</p><p className="font-bold">{fmtMonto(c.total)}</p></div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.flags.map((f) => (
                    <span key={f} className="text-xs border border-white px-1 opacity-60">{f}</span>
                  ))}
                </div>
                <Link href={`/empresa/${c.ruc}`} className="text-xs border border-white px-3 py-1 hover:bg-white hover:text-black transition-colors">
                  VER PERFIL →
                </Link>
              </div>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="border border-white p-12 text-center">
              <p className="text-xs opacity-40 tracking-widest">SIN RESULTADOS PARA LOS FILTROS SELECCIONADOS</p>
            </div>
          )}

          <p className="text-xs opacity-20 mt-6">
            {filtered.length} de {cases.length} registros · Señales estadísticas · Datos públicos SEACE/SUNAT
            {error && <span className="ml-3 text-white opacity-40"> · DB offline — mostrando muestra</span>}
          </p>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

const CASES = [
  {
    name: "CORPRODI S.A.C.",
    ruc: "20523689879",
    workers: 1,
    total: "S/ 10,083,803",
    contracts: 6,
    score: 65,
    flags: ["≤2 TRABAJADORES", "DEUDA COACTIVA", "EMPRESA RECIENTE"],
    entities: ["GOBIERNO REGIONAL LORETO", "ESSALUD", "MUNICIPALIDAD IQUITOS"],
  },
  {
    name: "GRUPO HEVIMO S.A.C.",
    ruc: "20601638658",
    workers: 0,
    total: "S/ 9,902,548",
    contracts: 24,
    score: 65,
    flags: ["0 TRABAJADORES", "DEUDA COACTIVA", "17 ENTIDADES DISTINTAS"],
    entities: ["MUNIC. PACHACAMAC", "MUNIC. CHOTA", "MUNIC. RIOJA", "+14 más"],
  },
  {
    name: "SERVICIOS DACHI E.I.R.L.",
    ruc: "20604035873",
    workers: 2,
    total: "S/ 3,194,779",
    contracts: 15,
    score: 65,
    flags: ["≤2 TRABAJADORES", "DEUDA COACTIVA", "FUERZA AÉREA ×5 EN 90 DÍAS"],
    entities: ["FUERZA AÉREA DEL PERÚ", "GOBIERNO REGIONAL LORETO", "MUNIC. MAYNAS"],
  },
  {
    name: "DAFA MEDIC E.I.R.L.",
    ruc: "20606381264",
    workers: 0,
    total: "S/ 886,600",
    contracts: 2,
    score: 65,
    flags: ["0 TRABAJADORES", "DEUDA COACTIVA", "SECTOR SALUD"],
    entities: ["ESSALUD", "MINSA"],
  },
  {
    name: "GRIFO SAN JUAN S.R.L.",
    ruc: "20531570929",
    workers: 1,
    total: "S/ 759,418",
    contracts: 4,
    score: 65,
    flags: ["≤2 TRABAJADORES", "DEUDA COACTIVA", "MÚLTIPLES REGIONES"],
    entities: ["MUNICIPALIDADES DIVERSAS"],
  },
];

const STATS = [
  { label: "EN SEÑALES DE ALERTA", value: "S/23M+", highlight: true },
  { label: "CONTRATOS ANALIZADOS", value: "55,457" },
  { label: "PROVEEDORES MAPEADOS", value: "30,578" },
  { label: "ENTIDADES PÚBLICAS", value: "2,789" },
  { label: "CONEXIONES SOSPECHOSAS DE DOMICILIO", value: "1,083" },
  { label: "REDES POR REPR. LEGAL COMPARTIDO", value: "35" },
];


const HERO_DEFAULT = "¿Qué empresas tienen 0 trabajadores y más de S/1 millón en contratos públicos?";

export default function Home() {
  const [selected, setSelected] = useState<number | null>(null);
  const [heroQuery, setHeroQuery] = useState(HERO_DEFAULT);

  return (
    <main className="min-h-screen bg-black text-white font-mono">

      {/* ── MARQUEE TICKER ── */}
      <div className="border-b border-white overflow-hidden py-2">
        <div className="marquee-inner inline-flex gap-16 text-xs tracking-widest">
          {Array(4).fill(null).map((_, i) => (
            <span key={i} className="inline-flex gap-16 shrink-0">
              <span>▶ DATOS: SEACE · SUNAT (FUENTES PÚBLICAS)</span>
              <span>▶ SEÑALES ESTADÍSTICAS — NO CONCLUSIONES JURÍDICAS</span>
              <span>▶ KNOWLEDGE GRAPH ANTICORRUPCIÓN · PERÚ 2024-2026</span>
              <span>▶ 55,457 CONTRATOS ANALIZADOS</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO — pantalla completa ── */}
      <section className="border-b border-white px-6 md:px-16 flex flex-col" style={{ minHeight: "calc(100vh - 37px)" }}>
        <div className="max-w-4xl mx-auto w-full flex flex-col flex-1">

          {/* Tercio superior — logo + headline + tagline */}
          <div className="flex flex-col items-center justify-start flex-1 pt-8 pb-4 text-center gap-6">
            <div className="relative w-40 h-40 md:w-56 md:h-56">
              <Image src="/perry.png" alt="Perry" fill className="object-contain flicker" priority sizes="224px" />
            </div>

            <div>
              <p className="text-xs tracking-[0.3em] opacity-40 uppercase mb-3">
                P.E.R.R.Y · Procurement Evidence &amp; Risk Recognition System
              </p>
              <h1
                className="glitch text-6xl md:text-8xl font-black tracking-tighter leading-none uppercase flicker mb-4"
                data-text="AGENTE PERRY"
              >
                AGENTE PERRY
              </h1>
              <p className="text-sm md:text-base opacity-60 max-w-xl mx-auto leading-relaxed">
                ¿A quién le dan los contratos del Estado peruano — y deberían dárselos?
              </p>
            </div>
          </div>

          {/* Tercio inferior — query box con espacio antes del fold */}
          <div className="mt-auto pb-14">
            <div className="border-2 border-white">
              <div className="flex items-center gap-3 px-4 pt-4 pb-2 border-b border-white border-opacity-20">
                <span className="text-lg leading-none opacity-60">◈</span>
                <p className="text-xs font-black tracking-widest">PREGÚNTALE AL KNOWLEDGE GRAPH</p>
                <span className="ml-auto text-xs opacity-30 hidden md:block">Enter para consultar</span>
              </div>
              <textarea
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                rows={3}
                autoFocus
                className="w-full bg-transparent text-white font-mono text-base md:text-lg font-black px-4 py-4 outline-none resize-none leading-7 placeholder:opacity-20"
                placeholder="¿Qué quieres investigar?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (heroQuery.trim())
                      window.dispatchEvent(new CustomEvent("perry:query", { detail: { query: heroQuery.trim() } }));
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white border-opacity-20">
                <div className="flex flex-wrap gap-2">
                  {["Empresas con deuda coactiva", "Domicilios compartidos", "0 trabajadores con millones"].map((q) => (
                    <button
                      key={q}
                      onClick={() => setHeroQuery(q)}
                      className="text-xs border border-white border-opacity-30 px-2 py-1 opacity-50 hover:opacity-100 hover:border-opacity-100 transition-opacity"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (heroQuery.trim())
                      window.dispatchEvent(new CustomEvent("perry:query", { detail: { query: heroQuery.trim() } }));
                  }}
                  disabled={!heroQuery.trim()}
                  className="shrink-0 bg-white text-black font-black text-sm px-6 py-2.5 hover:bg-black hover:text-white border-2 border-white transition-all disabled:opacity-20"
                >
                  CONSULTAR →
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── STATS GRID ── */}
      <section className="border-b border-white">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {STATS.map((s, i) => (
            <div
              key={i}
              className={`border-r border-white last:border-r-0 p-6 md:p-8 ${s.highlight ? "bg-white text-black" : ""}`}
            >
              <p className="text-3xl md:text-4xl font-black mb-2">{s.value}</p>
              <p className={`text-xs leading-tight tracking-wider uppercase ${s.highlight ? "opacity-60" : "opacity-50"}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY KNOWLEDGE GRAPH ── */}
      <section className="border-b border-white px-6 py-16 md:px-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-8">
            [01] — ¿POR QUÉ KNOWLEDGE GRAPH?
          </p>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-black mb-6 leading-tight">
                LOS SISTEMAS TRADICIONALES
                <br />
                <span className="opacity-40 line-through">VEN FILAS.</span>
                <br />
                NOSOTROS VEMOS REDES.
              </h2>
              <p className="text-sm opacity-60 leading-7">
                Una tabla nunca revelaría que dos empresas sin relación aparente
                comparten domicilio fiscal y representante legal, y que ambas
                ganaron contratos de la misma municipalidad en el mismo mes.
                Un grafo sí.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-px border border-white">
              {[
                { step: "01", title: "OCDS + SUNAT", desc: "55K contratos + 971 empresas enriquecidas desde fuentes públicas" },
                { step: "02", title: "KNOWLEDGE GRAPH", desc: "Neo4j mapea relaciones: domicilios, representantes, contratos, entidades" },
                { step: "03", title: "2 ÁNGULOS", desc: "924 proveedores + 200 entidades públicas analizadas. Quién vende Y quién compra con patrones inusuales." },
              ].map((item) => (
                <div key={item.step} className="p-4 border-r border-white last:border-r-0">
                  <p className="text-4xl font-black opacity-20 mb-4">{item.step}</p>
                  <p className="text-xs font-bold mb-2">{item.title}</p>
                  <p className="text-xs opacity-50 leading-5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CASES TABLE ── */}
      <section className="border-b border-white px-6 py-16 md:px-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-2">
            [02] — SEÑALES DE ALERTA DETECTADAS
          </p>
          <p className="text-lg font-black mb-2 leading-snug max-w-2xl">
            Estas 5 empresas suman más de S/24M en contratos públicos. Ninguna supera 2 trabajadores registrados en planilla.
          </p>
          <p className="text-xs opacity-30 mb-8 max-w-2xl leading-5">
            Indicadores estadísticos automáticos — fuentes públicas SEACE + SUNAT. No constituye acusación.
          </p>

          {/* Desktop table */}
          <div className="hidden md:block border border-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white bg-white text-black">
                  <th className="text-left p-4 font-black tracking-widest">PROVEEDOR</th>
                  <th className="text-right p-4 font-black tracking-widest">TRABAJADORES</th>
                  <th className="text-right p-4 font-black tracking-widest">MONTO TOTAL</th>
                  <th className="text-right p-4 font-black tracking-widest">CONTRATOS</th>
                  <th className="text-right p-4 font-black tracking-widest">SCORE</th>
                  <th className="p-4 font-black tracking-widest">SEÑALES</th>
                </tr>
              </thead>
              <tbody>
                {CASES.map((c, i) => (
                  <tr
                    key={i}
                    className="risk-row border-b border-white border-opacity-20"
                    onClick={() => setSelected(selected === i ? null : i)}
                  >
                    <td className="p-4">
                      <p className="font-bold">{c.name}</p>
                      <p className="opacity-40 text-xs mt-1">RUC {c.ruc}</p>
                    </td>
                    <td className="p-4 text-right font-black text-xl">
                      {c.workers}
                    </td>
                    <td className="p-4 text-right font-bold">{c.total}</td>
                    <td className="p-4 text-right">{c.contracts}</td>
                    <td className="p-4 text-right">
                      <span className="inline-block border border-current px-2 py-1 font-black">
                        {c.score}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {c.flags.map((f, j) => (
                          <span key={j} className="text-xs border border-current px-1 opacity-70">
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded detail */}
          {selected !== null && (
            <div className="border border-white border-t-0 p-6 bg-white text-black">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-black text-lg">{CASES[selected].name}</p>
                  <p className="text-xs opacity-50">RUC {CASES[selected].ruc}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs border border-black px-3 py-1 hover:bg-black hover:text-white"
                >
                  CERRAR ×
                </button>
              </div>
              <p className="text-sm leading-6 mb-5 max-w-2xl opacity-80">
                Empresa con <strong>{CASES[selected].workers} trabajador{CASES[selected].workers !== 1 ? "es" : ""}</strong> registrado{CASES[selected].workers !== 1 ? "s" : ""} en SUNAT
                que acumuló <strong>{CASES[selected].total}</strong> en <strong>{CASES[selected].contracts}</strong> contratos
                con {CASES[selected].entities.length} entidades del Estado — incluyendo {CASES[selected].entities[0]}.
              </p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="opacity-50 mb-1">ENTIDADES CONTRATANTES</p>
                  {CASES[selected].entities.map((e, i) => (
                    <p key={i} className="font-bold py-1 border-b border-black border-opacity-10">
                      ▶ {e}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="opacity-50 mb-1">SEÑALES ACTIVAS</p>
                  {CASES[selected].flags.map((f, i) => (
                    <p key={i} className="font-bold py-1 border-b border-black border-opacity-10">
                      ⚠ {f}
                    </p>
                  ))}
                </div>
                <div className="border border-black p-4">
                  <p className="opacity-50 mb-2 text-xs">AVISO LEGAL</p>
                  <p className="text-xs leading-5 opacity-70">
                    Los patrones mostrados son indicadores estadísticos automatizados
                    basados en datos públicos. No constituyen conclusión jurídica.
                    Toda investigación formal corresponde a autoridades competentes.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <a href="/alertas" className="border border-white px-6 py-3 text-xs font-black tracking-widest hover:bg-white hover:text-black transition-colors">
              VER TODAS LAS ALERTAS →
            </a>
            <a href="/entidades" className="border border-white border-opacity-30 px-6 py-3 text-xs tracking-widest opacity-60 hover:opacity-100 hover:bg-white hover:text-black transition-colors">
              ANÁLISIS DE ENTIDADES →
            </a>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-4 mt-4">
            {CASES.map((c, i) => (
              <div key={i} className="border border-white p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-xs opacity-40">RUC {c.ruc}</p>
                  </div>
                  <span className="border border-white px-2 py-1 text-xs font-black">
                    {c.score}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p className="opacity-40">TRABAJADORES</p>
                    <p className="font-black text-2xl">{c.workers}</p>
                  </div>
                  <div>
                    <p className="opacity-40">CONTRATOS</p>
                    <p className="font-black text-2xl">{c.contracts}</p>
                  </div>
                  <div>
                    <p className="opacity-40">MONTO</p>
                    <p className="font-bold text-xs">{c.total}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.flags.map((f, j) => (
                    <span key={j} className="text-xs border border-white px-1 opacity-60">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── DISCLAIMER ── */}
      <section className="px-6 py-12 md:px-16">
        <div className="max-w-6xl mx-auto border border-white border-opacity-20 p-6">
          <p className="text-xs font-black tracking-widest mb-3 opacity-40">
            AVISO LEGAL — LEER ANTES DE USAR
          </p>
          <p className="text-xs opacity-40 leading-6">
            Toda la información presentada en esta plataforma proviene de fuentes públicas:
            Sistema Electrónico de Contrataciones del Estado (SEACE) y Superintendencia
            Nacional de Aduanas y Administración Tributaria (SUNAT). Las señales de alerta
            son indicadores estadísticos automatizados generados por algoritmos de análisis
            de grafos. <strong className="opacity-80">No constituyen acusaciones, conclusiones jurídicas ni
            afirmaciones de conducta ilícita.</strong> Toda investigación formal es competencia
            exclusiva de las autoridades peruanas correspondientes (Contraloría General,
            Ministerio Público, PNP). El uso de esta herramienta es de carácter informativo.
          </p>
        </div>

        <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-4 text-xs opacity-30">
          <p>P.E.R.R.Y · PROCUREMENT EVIDENCE &amp; RISK RECOGNITION SYSTEM</p>
          <p>DATOS: SEACE · SUNAT · OCDS PERÚ · 2024-2026</p>
          <p>HACKLATAM 2026</p>
        </div>
      </section>

    </main>
  );
}

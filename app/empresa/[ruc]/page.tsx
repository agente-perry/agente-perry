"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type Contract = { id: string; entity: string; monto: number; fecha: string; tipo: string; region: string };
type Person   = { name: string; doc_id: string; doc_type: string };
type TdrFlag  = { code: string; flag_code: string; flag_name: string; severity: string; evidence_quote: string };

type Company = {
  ruc: string;
  name: string;
  nombre_comercial: string | null;
  tipo_contribuyente: string;
  estado: string | null;
  condicion: string | null;
  domicilio_fiscal: string | null;
  fecha_inscripcion: string | null;
  fecha_inicio_actividades: string | null;
  ciiu_principal: string | null;
  actividad_principal: string | null;
  max_trabajadores: number;
  min_trabajadores: number;
  deuda_coactiva: boolean | null;
  omisiones_tributarias: boolean | null;
  tiene_actas_probatorias: boolean | null;
  total_won_pen: number;
  total_contracts: number;
  diversity_clients: number;
  geographic_coverage: number;
  days_to_first_contract: number;
  risk_score_v2: number;
  persons: Person[];
  addresses: string[];
  same_addr_companies: { ruc: string; name: string }[];
  same_repr_companies: { ruc: string; name: string }[];
};

type Periodo = { desde: string; hasta: string } | null;
type ApiResponse = { company: Company; contracts: Contract[]; tdrFlags: TdrFlag[]; periodo: Periodo };

const FLAG_META: Record<string, { label: string; desc: (c: Company) => string; temporal?: string }> = {
  F1:  { label: "EMPRESA INACTIVA O NO HABIDA", desc: (c) => `Estado registrado: ${c.estado ?? "N/D"} · Condición: ${c.condicion ?? "N/D"}. La empresa figura con situación irregular en el padrón SUNAT.`, temporal: "Estado según SUNAT al momento del análisis. Si la irregularidad es posterior a los contratos, el patrón puede ser igualmente indicativo: empresa que contrató con el Estado y luego desapareció." },
  F2:  { label: "DOMICILIO COMPARTIDO",   desc: () => "Comparte domicilio fiscal registrado con otras empresas proveedoras del Estado. Patrón asociado a redes de empresas vinculadas." },
  F3:  { label: "SIN CAPACIDAD OPERATIVA REGISTRADA", desc: (c) => `Máximo ${c.max_trabajadores} trabajador(es) en planillas SUNAT. La empresa acumuló S/${(c.total_won_pen/1e6).toFixed(1)}M en contratos públicos sin evidencia de personal suficiente para ejecutarlos.`, temporal: "Se usa el máximo histórico de trabajadores registrados en planillas, no solo el valor actual." },
  F5:  { label: "CONCENTRACIÓN EN UN SOLO CLIENTE", desc: (c) => `${c.total_contracts} contratos adjudicados por una única entidad compradora. Dependencia total de un solo cliente público.` },
  F11: { label: "RUC NO VÁLIDO",          desc: () => "RUC con formato incorrecto (menos de 11 dígitos). Empresa no verificable en SUNAT." },
  F16: { label: "REPRESENTANTE COMPARTIDO", desc: () => "Comparte representante legal con otras empresas que también son proveedoras del Estado. Indicador de posible red coordinada.", temporal: "Representantes según SUNAT al momento del análisis. Pueden haber cambiado desde el período de los contratos." },
  F17: { label: "DEUDA COACTIVA REGISTRADA", desc: (c) => `${c.deuda_coactiva ? "Deuda en cobranza coactiva" : ""}${c.omisiones_tributarias ? `${c.deuda_coactiva ? " y" : ""} omisiones tributarias` : ""} registradas en SUNAT al momento del análisis.`, temporal: "Dato de SUNAT a fecha del scraping — puede no coincidir con el período de los contratos. Verificar fecha de inicio de cobranza antes de concluir simultaneidad." },
  F19: { label: "EMPRESA DE RECIENTE CREACIÓN", desc: (c) => `Primer contrato público a los ${c.days_to_first_contract} días de iniciadas actividades. Tiempo inusualmente corto para desarrollar capacidad y cartera de clientes públicos.` },
};

function generateNarrative(c: Company, flags: string[]): string {
  const parts: string[] = [];

  if (c.max_trabajadores <= 2 && c.total_won_pen > 100_000) {
    const ratio = c.total_won_pen / Math.max(c.max_trabajadores, 1);
    parts.push(
      `Con un máximo de ${c.max_trabajadores} trabajador(es) en planilla, la empresa acumuló ${fmtMonto(c.total_won_pen)} en contratos públicos — equivalente a ${fmtMonto(ratio)} por trabajador registrado.`
    );
  }

  if (c.days_to_first_contract > 0 && c.days_to_first_contract < 365) {
    parts.push(
      `Obtuvo su primer contrato con el Estado a los ${c.days_to_first_contract} días de iniciar actividades, un plazo inusualmente corto para desarrollar capacidad operativa y cartera pública.`
    );
  }

  const networkCount = (c.same_addr_companies?.length ?? 0) + (c.same_repr_companies?.length ?? 0);
  if (networkCount > 0) {
    const addrPart = c.same_addr_companies?.length > 0
      ? `${c.same_addr_companies.length} empresa(s) con domicilio fiscal compartido`
      : null;
    const reprPart = c.same_repr_companies?.length > 0
      ? `${c.same_repr_companies.length} empresa(s) con representante legal en común`
      : null;
    const networkDesc = [addrPart, reprPart].filter(Boolean).join(" y ");
    parts.push(
      `Se identificaron conexiones con ${networkDesc}, configurando una red de proveedores del Estado con vínculos directos.`
    );
  }

  if (c.deuda_coactiva || c.omisiones_tributarias) {
    const fiscal: string[] = [];
    if (c.deuda_coactiva) fiscal.push("deuda en cobranza coactiva");
    if (c.omisiones_tributarias) fiscal.push("omisiones tributarias");
    parts.push(
      `La empresa registra ${fiscal.join(" y ")} ante SUNAT, lo que evidencia incumplimientos fiscales en paralelo a su actividad como proveedor del Estado.`
    );
  }

  if (c.diversity_clients === 1 && c.total_contracts >= 5) {
    parts.push(
      `Los ${c.total_contracts} contratos registrados fueron adjudicados por una única entidad compradora, sugiriendo una relación de cliente cautivo sin diversificación competitiva.`
    );
  }

  if (parts.length === 0 && flags.length > 0) {
    parts.push(
      `El análisis estadístico detectó ${flags.length} señal(es) de alerta en los datos públicos de esta empresa — se recomienda revisión detallada de los contratos y vínculos registrados.`
    );
  }

  return parts.join(" ");
}

function deriveFlags(c: Company): string[] {
  const flags: string[] = [];
  if (c.estado === "BAJA" || c.condicion === "NO HABIDO") flags.push("F1");
  if (c.same_addr_companies?.length > 0) flags.push("F2");
  if (c.max_trabajadores <= 2 && c.total_won_pen > 100_000) flags.push("F3");
  if (c.diversity_clients === 1 && c.total_contracts >= 5) flags.push("F5");
  if (c.ruc?.startsWith("hash_")) flags.push("F11");
  if (c.same_repr_companies?.length > 0) flags.push("F16");
  if (c.deuda_coactiva || c.omisiones_tributarias || c.tiene_actas_probatorias) flags.push("F17");
  if (c.days_to_first_contract > 0 && c.days_to_first_contract < 365) flags.push("F19");
  return flags;
}

function fmtMonto(n: number) {
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(2)}M`;
  return `S/ ${n.toLocaleString("es-PE")}`;
}

function ScoreBar({ score }: { score: number }) {
  const segments = 20;
  const filled = Math.round((score / 140) * segments);
  return (
    <div className="flex gap-0.5">
      {[...Array(segments)].map((_, i) => (
        <div key={i} className={`h-3 flex-1 ${i < filled ? "bg-white" : "bg-white opacity-10"}`} />
      ))}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-white opacity-10 animate-pulse ${className}`} />;
}

export default function EmpresaPage({ params }: { params: Promise<{ ruc: string }> }) {
  const { ruc } = use(params);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/empresa/${ruc}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, [ruc]);

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-16">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-4 w-32 mb-6" />
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-64 mb-12" />
          <div className="grid md:grid-cols-5 gap-px border border-white mb-8">
            {[...Array(5)].map((_, i) => <div key={i} className="p-8"><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-3 w-24" /></div>)}
          </div>
        </div>
      </main>
    );
  }

  if (error === "Error: not_found" || !data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6">
        <p className="text-xs opacity-40 tracking-widest">RUC {ruc} — NO ENCONTRADO EN BASE DE DATOS</p>
        <Link href="/alertas" className="text-xs border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors">
          ← VOLVER A ALERTAS
        </Link>
      </main>
    );
  }

  const { company: c, contracts, tdrFlags, periodo } = data;
  const flags = deriveFlags(c);

  const connections = [
    ...c.same_addr_companies.map((x) => ({ type: "MISMO DOMICILIO", name: x.name, detail: c.domicilio_fiscal ?? "Domicilio fiscal compartido", flagged: true, ruc: x.ruc })),
    ...c.same_repr_companies.map((x) => ({ type: "REPR. COMPARTIDO", name: x.name, detail: "Comparte representante legal con esta empresa", flagged: true, ruc: x.ruc })),
    ...c.persons.map((p) => ({ type: "REPRESENTANTE LEGAL", name: p.name, detail: `${p.doc_type ?? "DOC"} ${p.doc_id}`, flagged: false, ruc: null })),
  ];

  return (
    <main className="min-h-screen">

      {/* Header */}
      <section className="border-b border-white px-6 py-10 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/alertas" className="text-xs opacity-40 hover:opacity-100 transition-opacity">← ALERTAS</Link>
            <span className="opacity-20">/</span>
            <span className="text-xs opacity-40">RUC {c.ruc}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-3 flicker">
                {c.name}
              </h1>
              {c.nombre_comercial && c.nombre_comercial !== c.name && (
                <p className="text-sm opacity-40 mb-2">{c.nombre_comercial}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border border-white px-2 py-1">{c.tipo_contribuyente}</span>
                {c.condicion && (
                  <span className={`border px-2 py-1 ${c.condicion === "NO HABIDO" ? "border-white bg-white text-black" : "border-white border-opacity-30 opacity-60"}`}>
                    {c.condicion}
                  </span>
                )}
                {c.estado && (
                  <span className={`border px-2 py-1 ${c.estado === "BAJA" ? "border-white bg-white text-black" : "border-white border-opacity-30 opacity-60"}`}>
                    {c.estado}
                  </span>
                )}
                {(c.deuda_coactiva || c.omisiones_tributarias) && (
                  <span className="border border-white bg-white text-black px-2 py-1">DEUDA COACTIVA (verificar)</span>
                )}
                {c.actividad_principal && (
                  <span className="border border-white border-opacity-30 opacity-50 px-2 py-1">{c.ciiu_principal} · {c.actividad_principal.slice(0, 30)}</span>
                )}
              </div>
            </div>
            <div className="border border-white p-5 min-w-60 shrink-0">
              <p className="text-xs opacity-40 tracking-widest mb-2">RISK SCORE</p>
              <p className="text-5xl font-black leading-none mb-3">{c.risk_score_v2}</p>
              <ScoreBar score={c.risk_score_v2} />
              <p className="text-xs opacity-30 mt-2">MÁX 140 · {flags.length} SEÑALES ACTIVAS</p>
            </div>
          </div>
        </div>
      </section>

      {/* Resumen Ejecutivo */}
      {flags.length > 0 && (
        <section className="border-b border-white px-6 py-5 md:px-16 bg-white text-black">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs tracking-[0.4em] opacity-50 mb-2">RESUMEN EJECUTIVO</p>
            <p className="text-sm leading-7 max-w-4xl">{generateNarrative(c, flags)}</p>
          </div>
        </section>
      )}

      {/* Temporal context banner */}
      <section className="border-b border-white border-opacity-30 px-6 py-3 md:px-16">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white opacity-80 inline-block" />
            <span className="opacity-40 tracking-widest">CONTRATOS SEACE</span>
            <span className="font-bold">
              {periodo
                ? `${periodo.desde} → ${periodo.hasta}`
                : "PERÍODO DESCONOCIDO"}
            </span>
            <span className="opacity-30">(datos históricos)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 border border-white opacity-60 inline-block" />
            <span className="opacity-40 tracking-widest">SUNAT PADRÓN</span>
            <span className="font-bold">HOY</span>
            <span className="opacity-30">(snapshot actual — sin histórico)</span>
          </div>
          <div className="opacity-20 hidden lg:block">
            F3 · F16 · F17 usan snapshot actual cruzado con contratos históricos
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-b border-white">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5">
          {[
            { label: "TRABAJADORES (MAX)", value: c.max_trabajadores.toString(), alert: c.max_trabajadores <= 2 && c.total_won_pen > 100_000 },
            { label: "MONTO TOTAL", value: fmtMonto(c.total_won_pen), alert: false },
            { label: "CONTRATOS", value: c.total_contracts.toString(), alert: false },
            { label: "ENTIDADES DISTINTAS", value: c.diversity_clients.toString(), alert: c.diversity_clients === 1 && c.total_contracts >= 5 },
            { label: "DÍAS HASTA 1ER CONTRATO", value: c.days_to_first_contract > 0 ? c.days_to_first_contract.toString() : "N/D", alert: c.days_to_first_contract > 0 && c.days_to_first_contract < 365 },
          ].map((m, i) => (
            <div key={i} className={`border-r border-white last:border-r-0 p-6 md:p-8 ${m.alert ? "bg-white text-black" : ""}`}>
              <p className="text-3xl font-black mb-1">{m.value}</p>
              <p className={`text-xs leading-tight tracking-wider uppercase ${m.alert ? "opacity-60" : "opacity-40"}`}>{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-8 md:px-16">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left: flags + contracts */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Active flags */}
            {flags.length > 0 && (
              <div>
                <p className="text-xs tracking-[0.4em] opacity-50 mb-4">SEÑALES ACTIVAS ({flags.length})</p>
                <div className="flex flex-col gap-3">
                  {flags.map((code) => {
                    const meta = FLAG_META[code];
                    return (
                      <div key={code} className="border border-white p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs border border-white px-2 py-1 font-black">{code}</span>
                          <p className="font-black text-sm tracking-wider">⚠ {meta?.label ?? code}</p>
                        </div>
                        <p className="text-xs opacity-60 leading-5">{meta?.desc(c)}</p>
                        {meta?.temporal && (
                          <p className="text-xs opacity-30 leading-5 mt-2 border-t border-white border-opacity-10 pt-2">
                            ⏱ {meta.temporal}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {tdrFlags.map((f, i) => (
                    <div key={i} className="border border-white border-opacity-50 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs border border-white border-opacity-50 px-2 py-1 font-black opacity-70">TDR</span>
                        <p className="font-black text-sm tracking-wider opacity-80">⚠ {f.flag_name}</p>
                        <span className="text-xs opacity-40">{f.severity}</span>
                      </div>
                      {f.evidence_quote && (
                        <p className="text-xs opacity-50 leading-5 italic">&ldquo;{f.evidence_quote.slice(0, 200)}&rdquo;</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contracts table */}
            <div>
              <p className="text-xs tracking-[0.4em] opacity-50 mb-4">CONTRATOS ({contracts.length})</p>
              <div className="border border-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white bg-white text-black">
                      <th className="text-left p-3 font-black tracking-wider">ENTIDAD</th>
                      <th className="text-left p-3 font-black tracking-wider hidden md:table-cell">TIPO</th>
                      <th className="text-right p-3 font-black tracking-wider">MONTO</th>
                      <th className="text-right p-3 font-black tracking-wider hidden md:table-cell">FECHA</th>
                      <th className="text-center p-3 font-black tracking-wider hidden lg:table-cell">REGIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((ct) => (
                      <tr key={ct.id} className="risk-row border-b border-white border-opacity-20">
                        <td className="p-3 font-bold">{ct.entity}</td>
                        <td className="p-3 opacity-50 hidden md:table-cell">{ct.tipo}</td>
                        <td className="p-3 text-right font-bold">{fmtMonto(ct.monto)}</td>
                        <td className="p-3 text-right opacity-50 hidden md:table-cell">{ct.fecha?.slice(0, 10)}</td>
                        <td className="p-3 text-center opacity-50 hidden lg:table-cell">{ct.region}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white">
                      <td className="p-3 font-black" colSpan={2}>TOTAL</td>
                      <td className="p-3 text-right font-black">{fmtMonto(c.total_won_pen)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Right: connections + info */}
          <div className="flex flex-col gap-5">

            {/* Connections */}
            {connections.length > 0 && (
              <div>
                <p className="text-xs tracking-[0.4em] opacity-50 mb-3">CONEXIONES EN EL GRAFO</p>
                <div className="flex flex-col gap-2">
                  {connections.map((conn, i) => (
                    <div key={i} className={`border p-3 text-xs ${conn.flagged ? "border-white bg-white text-black" : "border-white border-opacity-20"}`}>
                      <p className={`text-xs tracking-widest mb-1.5 font-black ${conn.flagged ? "opacity-50" : "opacity-30"}`}>
                        {conn.flagged && "⚠ "}{conn.type}
                      </p>
                      {conn.ruc ? (
                        <Link href={`/empresa/${conn.ruc}`} className={`block font-bold leading-snug ${conn.flagged ? "underline decoration-dotted" : "opacity-70"}`}>
                          {conn.name}
                        </Link>
                      ) : (
                        <p className={`font-bold leading-snug ${conn.flagged ? "" : "opacity-80"}`}>{conn.name}</p>
                      )}
                      <p className={`mt-1 leading-4 ${conn.flagged ? "opacity-50" : "opacity-40"}`}>{conn.detail}</p>
                    </div>
                  ))}
                </div>
                <Link href={`/grafo?ruc=${c.ruc}`} className="block mt-3 text-center text-xs border border-white px-3 py-2 hover:bg-white hover:text-black transition-colors opacity-50 hover:opacity-100">
                  VER EN GRAFO INTERACTIVO →
                </Link>
              </div>
            )}

            {/* SUNAT data */}
            <div className="border border-white border-opacity-20 p-4 text-xs">
              <p className="opacity-30 tracking-widest mb-3">DATOS SUNAT</p>
              <div className="flex flex-col gap-1.5 opacity-60">
                {c.domicilio_fiscal && <p><span className="opacity-50">DOMICILIO:</span> {c.domicilio_fiscal}</p>}
                {c.fecha_inscripcion && <p><span className="opacity-50">INSCRIPCIÓN:</span> {String(c.fecha_inscripcion).slice(0, 10)}</p>}
                {c.fecha_inicio_actividades && <p><span className="opacity-50">INICIO ACT.:</span> {String(c.fecha_inicio_actividades).slice(0, 10)}</p>}
                {c.geographic_coverage > 0 && <p><span className="opacity-50">REGIONES:</span> {c.geographic_coverage}</p>}
              </div>
            </div>

            {/* Legal */}
            <div className="border border-white border-opacity-20 p-4">
              <p className="text-xs font-black tracking-widest mb-2 opacity-40">AVISO LEGAL</p>
              <p className="text-xs opacity-40 leading-5">
                Datos de fuentes públicas (SEACE, SUNAT). Señales estadísticas automatizadas.{" "}
                <strong className="opacity-70">No constituyen acusación ni conclusión jurídica.</strong>{" "}
                Investigación formal: Contraloría General, Ministerio Público, PNP.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <a href={`https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${c.ruc}`}
                target="_blank" rel="noopener noreferrer"
                className="block text-center text-xs border border-white px-3 py-2 hover:bg-white hover:text-black transition-colors">
                VER EN SUNAT →
              </a>
              <a href="https://prodapp2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml"
                target="_blank" rel="noopener noreferrer"
                className="block text-center text-xs border border-white border-opacity-30 px-3 py-2 hover:bg-white hover:text-black transition-colors opacity-50 hover:opacity-100">
                BUSCAR EN SEACE →
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

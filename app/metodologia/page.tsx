import Link from "next/link";

const FLAGS = [
  {
    group: "A",
    title: "OCDS × SUNAT",
    subtitle: "Cruce de contratos con estado fiscal de la empresa",
    color: "bg-white text-black",
    items: [
      { code: "F1", name: "EMPRESA FANTASMA", cypher: "WHERE c.estado = 'BAJA' OR c.condicion = 'NO HABIDO'", desc: "Empresa con baja SUNAT o condición NO HABIDO que continúa ganando contratos activos." },
      { code: "F2", name: "DOMICILIO COMPARTIDO", cypher: "MATCH (c1)-[:LOCATED_AT]->(a)<-[:LOCATED_AT]-(c2)", desc: "≥2 empresas con el mismo domicilio fiscal no genérico ganando del mismo comprador." },
      { code: "F3", name: "SIN TRABAJADORES", cypher: "WHERE c.max_trabajadores <= 2 AND c.total_won_pen > 100000", desc: "0-2 trabajadores máximo + más de S/100K en contratos del Estado." },
      { code: "F4", name: "GEO-MISMATCH", cypher: "WHERE c.region <> k.region AND c.total_won_pen > 500000", desc: "Domicilio fiscal en región diferente a la mayoría de contratos ganados." },
    ],
  },
  {
    group: "B",
    title: "SOLO OCDS",
    subtitle: "Patrones detectables desde los contratos (72k records)",
    color: "bg-white text-black",
    items: [
      { code: "F5", name: "CLIENTE CAUTIVO", cypher: "WHERE c.diversity_clients = 1 AND c.total_contracts >= 5", desc: "Proveedor con ≥5 contratos pero solo 1 entidad compradora." },
      { code: "F6", name: "ENTIDAD CAPTURADA", cypher: "WHERE e.avg_supplier_concentration > 0.8", desc: "Una entidad concentra >80% de su gasto en un único proveedor en un año." },
      { code: "F7", name: "FRACCIONAMIENTO", cypher: "WITH count(k) AS n_contratos WHERE n_contratos >= 3", desc: "≥3 contratos de la misma entidad al mismo proveedor en el mismo mes." },
      { code: "F8", name: "RÁFAGA FIN DE AÑO", cypher: "WHERE k.fecha.month IN [11, 12] AND count(k) >= 3", desc: "≥3 contratos en noviembre-diciembre de la misma entidad (patrón de ejecución presupuestaria forzada)." },
      { code: "F9", name: "CONCENTRACIÓN EXTREMA", cypher: "WHERE pct_gasto > 0.80", desc: "Un proveedor lleva >80% del gasto total de una entidad en un año fiscal." },
      { code: "F10", name: "PROVEEDOR MONÓGAMO", cypher: "WHERE c.diversity_clients = 1", desc: "Todo el historial de contratos de la empresa es con una sola entidad." },
      { code: "F11", name: "RUC INCOMPLETO", cypher: "WHERE c.ruc STARTS WITH 'hash_'", desc: "RUC no tiene 11 dígitos válidos — empresa no trazable en SUNAT." },
      { code: "F12", name: "MONTO OUTLIER", cypher: "WHERE k.monto > avg_monto * 5", desc: "Contrato con monto >5× la media de su procedimiento_type y región." },
    ],
  },
  {
    group: "C",
    title: "DOSSIERS TDR",
    subtitle: "Análisis de PDFs de términos de referencia",
    color: "bg-white text-black",
    items: [
      { code: "F13", name: "DOSSIER HIGH-RISK", cypher: "WHERE d.risk_level = 'ALTO' AND d.total_score >= 50", desc: "TDR con score ≥50/100 en análisis automático de PDF (reglas + AI)." },
      { code: "F14", name: "FLAGS TDR ESPECÍFICOS", cypher: "MATCH (d)-[:HAS_FLAG]->(f:RiskFlag)", desc: "Flags individuales: LOW_TRACEABILITY_OUTPUT, OBSOLETE_PHYSICAL_FORMAT, OVERLY_SPECIFIC_REQUIREMENTS." },
    ],
  },
  {
    group: "D",
    title: "SUNAT RICO (e-consultaruc)",
    subtitle: "Representantes legales, trabajadores, CIIU, deuda",
    color: "bg-white text-black",
    items: [
      { code: "F15", name: "CAPACIDAD CERO", cypher: "WHERE c.max_trabajadores = 0 AND c.total_won_pen > 50000", desc: "Cero trabajadores en todos los meses registrados. Imposible ejecutar contratos." },
      { code: "F16", name: "REPRESENTANTE COMPARTIDO", cypher: "MATCH (p:Person)-[:REPRESENTS]->(c1) AND (p)-[:REPRESENTS]->(c2)", desc: "Mismo representante legal en ≥2 empresas que ganaron contratos de la misma entidad." },
      { code: "F17", name: "DEUDA FISCAL ACTIVA", cypher: "WHERE c.deuda_coactiva = true OR c.omisiones_tributarias = true", desc: "Empresa con deuda coactiva o actas probatorias en SUNAT sigue recibiendo contratos." },
      { code: "F18", name: "CIIU MISMATCH", cypher: "WHERE c.ciiu_principal <> sector_expected", desc: "Actividad económica CIIU declarada no corresponde al sector de los contratos ganados." },
      { code: "F19", name: "EMPRESA RECIENTE", cypher: "WHERE c.days_to_first_contract < 365", desc: "Primer contrato en menos de 1 año desde inicio de actividades. Monetización anómalmente rápida." },
    ],
  },
];

const PIPELINE = [
  { step: "01", title: "INGEST OCDS", desc: "72,399 contratos SEACE via OCDS Perú. Genera nodos Company, PublicEntity, Contract, Tender y relaciones WON, AWARDED_BY, UNDER_TENDER." },
  { step: "02", title: "ENRICH SUNAT", desc: "e-consultaruc por cada RUC: representantes legales, trabajadores, CIIU, estado, condición, deuda coactiva. Genera Person, Address, REPRESENTS, LOCATED_AT." },
  { step: "03", title: "ANÁLISIS TDR", desc: "PDFs de términos de referencia: extracción de texto + reglas Cypher + LLM. Genera Dossier, RiskFlag, ANALYZED_BY, HAS_FLAG." },
  { step: "04", title: "RELACIONES DERIVADAS", desc: "Post-carga: SAME_ADDRESS_AS (domicilios compartidos), SAME_REPR_AS (representantes compartidos)." },
  { step: "05", title: "MÉTRICAS M1-M6", desc: "diversity_clients, avg_supplier_concentration, geographic_coverage, days_to_first_contract, risk_score_v2. Persistidas en nodos." },
  { step: "06", title: "19 FLAGS CYPHER", desc: "Una query Cypher por flag. Se ejecutan sobre el grafo Neo4j AuraDB. Resultados rankeados por risk_score_v2." },
];

const SOURCES = [
  { name: "SEACE / OCDS PERÚ", records: "72,399 contratos", period: "2024-2026", path: "gs://agente-perry-data-prod/scraped/ocds/records.jsonl", fields: "external_id, supplier_ruc, entity_ruc, monto, fecha, procedure_type, region" },
  { name: "SUNAT e-consultaruc", records: "Variable (por RUC)", period: "Actual", path: "gs://agente-perry-data-prod/scraped/collectors/sunat_enriched.jsonl", fields: "razon_social, estado, condicion, representantes_legales, cantidad_trabajadores, deuda_coactiva, actividades_economicas" },
  { name: "TDRs / Dossiers", records: "20 índice / 3 piloto", period: "2024-2025", path: "gs://agente-perry-data-prod/scraped/results/*/", fields: "ocid, risk_summary, flags, evidence_quotes" },
  { name: "Downloads MINAM", records: "37 procedimientos", period: "2024-2025", path: "gs://agente-perry-data-prod/downloads/2024/ + 2025/", fields: "uuid, nomenclatura, cuantia, completed_targets, entidad" },
];

export default function MetodologiaPage() {
  return (
    <main className="min-h-screen bg-black text-white font-mono">

      {/* Header */}
      <section className="border-b border-white px-6 py-10 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-3">DOCUMENTACIÓN TÉCNICA</p>
          <h1 className="text-5xl font-black tracking-tighter leading-none flicker">
            METODOLOGÍA
          </h1>
          <p className="text-xs opacity-40 mt-3 max-w-xl leading-5">
            Cómo el Knowledge Graph detecta patrones de corrupción. Ontología, pipeline y 19 señales de alerta.
          </p>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-b border-white px-6 py-12 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-8">[01] — PIPELINE GCS → NEO4J AURADB</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px border border-white">
            {PIPELINE.map((p) => (
              <div key={p.step} className="border-r border-white last:border-r-0 p-5">
                <p className="text-4xl font-black opacity-20 mb-3">{p.step}</p>
                <p className="text-xs font-black mb-2 tracking-wider">{p.title}</p>
                <p className="text-xs opacity-40 leading-5">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ontology schema */}
      <section className="border-b border-white px-6 py-12 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-8">[02] — ONTOLOGÍA NEO4J (v2.0)</p>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Nodes */}
            <div>
              <p className="text-xs opacity-40 tracking-widest mb-4">NODOS</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Company", detail: "~30,578 · RUC + estado SUNAT + workers + CIIU + deuda" },
                  { label: "PublicEntity", detail: "~2,731 · RUC + name + region" },
                  { label: "Contract", detail: "~55,457 · external_id + monto + fecha + procedure_type" },
                  { label: "Tender", detail: "~16,942 · tender_id + monto presupuesto" },
                  { label: "Address", detail: "variable · md5(domicilio_fiscal) como PK" },
                  { label: "Person", detail: "variable · DNI/CE representantes legales" },
                  { label: "Dossier", detail: "3-20 · risk_score + risk_level + coverage_pct" },
                  { label: "RiskFlag", detail: "12+ · flag_code + severity + evidence_quote" },
                  { label: "ProcedureSeace", detail: "37 · uuid + nomenclatura + completed_targets" },
                ].map((n) => (
                  <div key={n.label} className="flex items-baseline gap-3 text-xs border-b border-white border-opacity-10 pb-2">
                    <span className="font-black min-w-32 font-mono">:{n.label}</span>
                    <span className="opacity-40 leading-4">{n.detail}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Relations + Mermaid */}
            <div>
              <p className="text-xs opacity-40 tracking-widest mb-4">RELACIONES</p>
              <div className="flex flex-col gap-2 mb-6">
                {[
                  { rel: "WON", desc: "Company → Contract" },
                  { rel: "AWARDED_BY", desc: "Contract → PublicEntity" },
                  { rel: "UNDER_TENDER", desc: "Contract → Tender" },
                  { rel: "LOCATED_AT", desc: "Company → Address" },
                  { rel: "SAME_ADDRESS_AS", desc: "Company ↔ Company · derivada" },
                  { rel: "REPRESENTS", desc: "Person → Company · cargo + fecha_desde" },
                  { rel: "SAME_REPR_AS", desc: "Company ↔ Company · derivada" },
                  { rel: "ANALYZED_BY", desc: "Contract → Dossier" },
                  { rel: "HAS_FLAG", desc: "Dossier → RiskFlag" },
                ].map((r) => (
                  <div key={r.rel} className="flex items-center gap-3 text-xs border-b border-white border-opacity-10 pb-2">
                    <span className="font-black min-w-32 font-mono opacity-80">{r.rel}</span>
                    <span className="opacity-40">{r.desc}</span>
                  </div>
                ))}
              </div>
              {/* ASCII diagram */}
              <div className="border border-white border-opacity-20 p-4">
                <p className="text-xs opacity-30 mb-2 tracking-widest">DIAGRAMA</p>
                <pre className="text-xs opacity-60 leading-5 font-mono">
{`Person ──REPRESENTS──▶ Company
                           │
                    WON ──▶│──▶ Contract
                           │         │
               LOCATED_AT ▼         ▼ AWARDED_BY
                       Address   PublicEntity
                                     │
                               ANALYZED_BY ▼
                                      Dossier
                                          │
                                  HAS_FLAG ▼
                                       RiskFlag`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 19 Flags */}
      <section className="border-b border-white px-6 py-12 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-8">[03] — 19 SEÑALES DE ALERTA</p>
          <div className="flex flex-col gap-8">
            {FLAGS.map((group) => (
              <div key={group.group}>
                <div className={`inline-flex items-center gap-3 px-4 py-2 mb-4 border border-white ${group.color}`}>
                  <span className="font-black text-sm">GRUPO {group.group}</span>
                  <span className="font-black">·</span>
                  <span className="font-black text-sm">{group.title}</span>
                  <span className="opacity-50 text-xs hidden md:inline">· {group.subtitle}</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {group.items.map((f) => (
                    <div key={f.code} className="border border-white border-opacity-30 p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-xs border border-white px-2 py-1 font-black shrink-0">{f.code}</span>
                        <p className="font-black text-sm">{f.name}</p>
                      </div>
                      <p className="text-xs opacity-50 leading-5 mb-3">{f.desc}</p>
                      <div className="border border-white/20 p-2 bg-white/5">
                        <p className="text-xs opacity-30 mb-1 tracking-widest">CYPHER DETECTION</p>
                        <code className="text-xs opacity-60 font-mono leading-5 break-all">{f.cypher}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="border-b border-white px-6 py-12 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-8">[04] — FUENTES DE DATOS</p>
          <div className="border border-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white bg-white text-black">
                  <th className="text-left p-4 font-black tracking-widest">FUENTE</th>
                  <th className="text-left p-4 font-black tracking-widest hidden md:table-cell">REGISTROS</th>
                  <th className="text-left p-4 font-black tracking-widest hidden lg:table-cell">PERIODO</th>
                  <th className="text-left p-4 font-black tracking-widest hidden xl:table-cell">CAMPOS CLAVE</th>
                </tr>
              </thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.name} className="risk-row border-b border-white border-opacity-20">
                    <td className="p-4">
                      <p className="font-bold">{s.name}</p>
                      <p className="opacity-30 mt-1 font-mono break-all">{s.path}</p>
                    </td>
                    <td className="p-4 hidden md:table-cell opacity-60">{s.records}</td>
                    <td className="p-4 hidden lg:table-cell opacity-60">{s.period}</td>
                    <td className="p-4 hidden xl:table-cell opacity-40 font-mono text-xs leading-5">{s.fields}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Risk score */}
      <section className="border-b border-white px-6 py-12 md:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.4em] opacity-50 mb-8">[05] — RISK SCORE V2</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm opacity-60 leading-7 mb-6">
                El <strong>risk_score_v2</strong> se calcula sobre cada nodo Company post-carga.
                Máximo teórico: <strong>140 puntos</strong>. Umbrales operacionales:
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { range: "0 — 29", label: "BAJO RIESGO", desc: "Sin patrones significativos" },
                  { range: "30 — 59", label: "RIESGO MEDIO", desc: "1-2 señales combinadas" },
                  { range: "60 — 89", label: "ALTO RIESGO", desc: "Múltiples señales · requiere revisión" },
                  { range: "90 — 140", label: "CRÍTICO", desc: "Combinación severa · prioridad máxima" },
                ].map((t) => (
                  <div key={t.range} className="flex items-center gap-4 text-xs border-b border-white border-opacity-10 pb-2">
                    <span className="font-black min-w-24 font-mono">{t.range}</span>
                    <span className="font-bold min-w-28">{t.label}</span>
                    <span className="opacity-40">{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-white border-opacity-20 p-5">
              <p className="text-xs opacity-30 mb-3 tracking-widest">COMPOSICIÓN DEL SCORE</p>
              <div className="flex flex-col gap-2 text-xs font-mono">
                {[
                  { factor: "Estado BAJA / NO HABIDO", pts: "+30" },
                  { factor: "RUC hash (no identificable)", pts: "+20" },
                  { factor: "0-2 trabajadores + >S/100K", pts: "+25" },
                  { factor: "Deuda coactiva / omisiones", pts: "+20" },
                  { factor: "1er contrato < 365 días", pts: "+20" },
                  { factor: "Cliente único + ≥3 contratos", pts: "+15" },
                  { factor: "Actas probatorias SUNAT", pts: "+10" },
                ].map((f) => (
                  <div key={f.factor} className="flex justify-between gap-4 border-b border-white border-opacity-10 pb-1.5">
                    <span className="opacity-60">{f.factor}</span>
                    <span className="font-black opacity-80">{f.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="px-6 py-10 md:px-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6 text-xs opacity-20">
          <p>AGENTE P.E.R.R.Y · HACKLATAM 2026</p>
          <div className="flex gap-6">
            <Link href="/alertas" className="hover:opacity-100 transition-opacity">ALERTAS</Link>
            <Link href="/grafo" className="hover:opacity-100 transition-opacity">GRAFO</Link>
            <Link href="/" className="hover:opacity-100 transition-opacity">INICIO</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

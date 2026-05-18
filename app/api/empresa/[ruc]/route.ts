import { NextResponse } from "next/server";
import { runQuery, toInt, toFloat } from "@/lib/neo4j";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ruc: string }> },
) {
  const { ruc } = await params;

  try {
    // Company + contracts + entities
    const [companyRows, contractRows, connectionRows] = await Promise.all([
      runQuery<Record<string, unknown>>(`
        MATCH (c:Company {ruc: $ruc})
        OPTIONAL MATCH (p:Person)-[:REPRESENTS]->(c)
        OPTIONAL MATCH (c)-[:LOCATED_AT]->(a:Address)
        OPTIONAL MATCH (c)-[:SAME_ADDRESS_AS]-(c2:Company)
        OPTIONAL MATCH (c)-[:SAME_REPR_AS]-(c3:Company)
        WITH c,
          collect(DISTINCT {name: p.name, doc_id: p.doc_id, doc_type: p.doc_type})[0..10] AS persons,
          collect(DISTINCT a.domicilio_fiscal)[0..3]  AS addresses,
          collect(DISTINCT {ruc: c2.ruc, name: c2.name})[0..5]  AS same_addr,
          collect(DISTINCT {ruc: c3.ruc, name: c3.name})[0..5]  AS same_repr
        RETURN c, persons, addresses, same_addr, same_repr
      `, { ruc }),

      runQuery<Record<string, unknown>>(`
        MATCH (c:Company {ruc: $ruc})-[w:WON]->(k:Contract)-[:AWARDED_BY]->(e:PublicEntity)
        RETURN
          k.external_id   AS id,
          e.name          AS entity,
          k.monto         AS monto,
          toString(k.fecha) AS fecha,
          k.procedure_type AS tipo,
          k.region        AS region
        ORDER BY k.fecha DESC
        LIMIT 50
      `, { ruc }),

      // Dossier flags if any
      runQuery<Record<string, unknown>>(`
        MATCH (c:Company {ruc: $ruc})-[:WON]->(k:Contract)-[:ANALYZED_BY]->(d:Dossier)-[:HAS_FLAG]->(f:RiskFlag)
        RETURN DISTINCT
          f.flag_code       AS flag_code,
          f.flag_name       AS flag_name,
          f.severity        AS severity,
          f.evidence_quote  AS evidence_quote
        LIMIT 20
      `, { ruc }),
    ]);

    if (companyRows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const row = companyRows[0];
    // neo4j-driver returns Node objects; properties live under .properties
    const rawNode = row.c as { properties?: Record<string, unknown> } & Record<string, unknown>;
    const c = rawNode.properties ?? rawNode;

    const company = {
      ruc: c.ruc as string,
      name: (c.name as string) || "SIN RAZÓN SOCIAL",
      nombre_comercial: c.nombre_comercial as string | null,
      tipo_contribuyente: (c.tipo_contribuyente as string) || "N/D",
      estado: (c.estado as string) || null,
      condicion: (c.condicion as string) || null,
      domicilio_fiscal: c.domicilio_fiscal as string | null,
      fecha_inscripcion: c.fecha_inscripcion ? String(c.fecha_inscripcion) : null,
      fecha_inicio_actividades: c.fecha_inicio_actividades ? String(c.fecha_inicio_actividades) : null,
      ciiu_principal: c.ciiu_principal as string | null,
      actividad_principal: c.actividad_principal as string | null,
      max_trabajadores: toInt(c.max_trabajadores),
      min_trabajadores: toInt(c.min_trabajadores),
      deuda_coactiva: c.deuda_coactiva as boolean | null,
      omisiones_tributarias: c.omisiones_tributarias as boolean | null,
      tiene_actas_probatorias: c.tiene_actas_probatorias as boolean | null,
      total_won_pen: toFloat(c.total_won_pen),
      total_contracts: toInt(c.total_contracts),
      diversity_clients: toInt(c.diversity_clients),
      geographic_coverage: toInt(c.geographic_coverage),
      days_to_first_contract: toInt(c.days_to_first_contract),
      risk_score_v2: toInt(c.risk_score_v2),
      persons: row.persons as {name: string; doc_id: string; doc_type: string}[],
      addresses: row.addresses as string[],
      same_addr_companies: row.same_addr as {ruc: string; name: string}[],
      same_repr_companies: row.same_repr as {ruc: string; name: string}[],
    };

    const contracts = contractRows.map((r) => ({
      id: r.id as string,
      entity: (r.entity as string) || "N/D",
      monto: toFloat(r.monto),
      fecha: (r.fecha as string) || "",
      tipo: (r.tipo as string) || "N/D",
      region: (r.region as string) || "N/D",
    }));

    const tdrFlags = connectionRows.map((r) => ({
      code: "F13",
      flag_code: r.flag_code as string,
      flag_name: r.flag_name as string,
      severity: r.severity as string,
      evidence_quote: r.evidence_quote as string,
    }));

    // Derive contract date range from returned rows
    const fechas = contracts
      .map((ct) => ct.fecha)
      .filter(Boolean)
      .sort();
    const periodo = fechas.length > 0
      ? { desde: fechas[fechas.length - 1].slice(0, 7), hasta: fechas[0].slice(0, 7) }
      : null;

    return NextResponse.json({ company, contracts, tdrFlags, periodo });
  } catch (err) {
    console.error("[api/empresa]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

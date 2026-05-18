import { NextResponse } from "next/server";
import { runQuery, toInt, toFloat } from "@/lib/neo4j";

// Derive active flag codes from company properties
function deriveFlags(c: Record<string, unknown>): string[] {
  const flags: string[] = [];
  const estado = c.estado as string | null;
  const condicion = c.condicion as string | null;
  const workers = toInt(c.max_trabajadores);
  const total = toFloat(c.total_won_pen);
  const daysFirst = toInt(c.days_to_first_contract);
  const deuda = c.deuda_coactiva as boolean | null;
  const omisiones = c.omisiones_tributarias as boolean | null;
  const actas = c.tiene_actas_probatorias as boolean | null;
  const diversityClients = toInt(c.diversity_clients);
  const totalContracts = toInt(c.total_contracts);
  const geoC = toInt(c.geographic_coverage);
  const ruc = c.ruc as string;
  const sameAddrCount = toInt(c.same_addr_count);
  const sameReprCount = toInt(c.same_repr_count);

  if (estado === "BAJA" || condicion === "NO HABIDO") flags.push("F1");
  if (sameAddrCount > 0) flags.push("F2");
  if (workers != null && workers <= 2 && total > 100_000) flags.push("F3");
  if (geoC > 3 && workers != null && workers <= 2) flags.push("F4");
  if (diversityClients === 1 && totalContracts >= 5) flags.push("F5");
  if (ruc && ruc.startsWith("hash_")) flags.push("F11");
  if (deuda || omisiones) flags.push("F17");
  if (actas) flags.push("F17");
  if (sameReprCount > 0) flags.push("F16");
  if (daysFirst > 0 && daysFirst < 365) flags.push("F19");

  return flags;
}

export async function GET() {
  try {
    // Debug: log node counts to terminal
    const counts = await runQuery<Record<string, unknown>>(
      "MATCH (c:Company) RETURN count(c) AS total, count(c.risk_score_v2) AS with_score, count(c.total_won_pen) AS with_won"
    );
    console.log("[api/alertas] DB counts:", JSON.stringify(counts[0]));

    const rows = await runQuery<Record<string, unknown>>(`
      MATCH (c:Company)
      WHERE c.total_won_pen IS NOT NULL AND c.total_won_pen > 0
      OPTIONAL MATCH (c)-[:WON]->(:Contract)-[:AWARDED_BY]->(e:PublicEntity)
      WITH c, collect(DISTINCT e.name)[0..6] AS entity_names
      OPTIONAL MATCH (c)-[:SAME_ADDRESS_AS]-(c2:Company)
      WITH c, entity_names, count(DISTINCT c2) AS same_addr_count
      OPTIONAL MATCH (c)-[:SAME_REPR_AS]-(c3:Company)
      WITH c, entity_names, same_addr_count, count(DISTINCT c3) AS same_repr_count
      OPTIONAL MATCH (c)-[:WON]->(k:Contract)
      WHERE k.region IS NOT NULL AND k.region <> ''
      WITH c, entity_names, same_addr_count, same_repr_count,
           k.region AS r, count(k) AS rcnt
      ORDER BY rcnt DESC
      WITH c, entity_names, same_addr_count, same_repr_count,
           collect(r)[0] AS top_region
      RETURN
        c.ruc                    AS ruc,
        c.name                   AS name,
        c.max_trabajadores       AS max_trabajadores,
        c.total_won_pen          AS total_won_pen,
        c.total_contracts        AS total_contracts,
        coalesce(c.risk_score_v2, 0) AS score,
        c.geographic_coverage    AS geographic_coverage,
        c.diversity_clients      AS diversity_clients,
        c.estado                 AS estado,
        c.condicion              AS condicion,
        c.deuda_coactiva         AS deuda_coactiva,
        c.omisiones_tributarias  AS omisiones_tributarias,
        c.tiene_actas_probatorias AS tiene_actas_probatorias,
        c.days_to_first_contract AS days_to_first_contract,
        c.ciiu_principal         AS ciiu_principal,
        c.actividad_principal    AS actividad_principal,
        coalesce(top_region, 'N/D') AS region,
        entity_names             AS entities,
        same_addr_count          AS same_addr_count,
        same_repr_count          AS same_repr_count
      ORDER BY score DESC, c.total_won_pen DESC
      LIMIT 300
    `);

    console.log("[api/alertas] rows returned:", rows.length);

    const data = rows.map((r) => ({
      ruc: r.ruc as string,
      name: (r.name as string) || "SIN RAZÓN SOCIAL",
      workers: toInt(r.max_trabajadores),
      total: toFloat(r.total_won_pen),
      contracts: toInt(r.total_contracts),
      score: toInt(r.score),
      region: (r.region as string) || "N/D",
      sector: (r.actividad_principal as string) || "N/D",
      estado: (r.estado as string) || null,
      condicion: (r.condicion as string) || null,
      entities: (r.entities as string[]) || [],
      flags: deriveFlags(r),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/alertas]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

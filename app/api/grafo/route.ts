import { NextResponse } from "next/server";
import { runQuery, toInt, toFloat } from "@/lib/neo4j";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const focusRuc = searchParams.get("ruc");

  try {
    // If RUC provided: ego-graph for that company
    // Otherwise: top-25 by risk score
    const companyRows = await runQuery<Record<string, unknown>>(
      focusRuc
        ? `
          MATCH (c:Company)
          WHERE c.ruc = $ruc
          OPTIONAL MATCH (c)-[:SAME_ADDRESS_AS]-(neighbor:Company)
          OPTIONAL MATCH (c)-[:SAME_REPR_AS]-(neighbor2:Company)
          WITH collect(DISTINCT c) + collect(DISTINCT neighbor) + collect(DISTINCT neighbor2) AS all_c
          UNWIND all_c AS c2
          WITH DISTINCT c2 WHERE c2 IS NOT NULL
          RETURN
            c2.ruc              AS id,
            c2.name             AS label,
            c2.max_trabajadores AS workers,
            c2.total_won_pen    AS total,
            coalesce(c2.risk_score_v2, 0) AS score
          LIMIT 30
        `
        : `
          MATCH (c:Company)
          WHERE c.risk_score_v2 IS NOT NULL AND c.risk_score_v2 >= 50
          RETURN
            c.ruc               AS id,
            c.name              AS label,
            c.max_trabajadores  AS workers,
            c.total_won_pen     AS total,
            c.risk_score_v2     AS score,
            c.condicion         AS condicion,
            c.estado            AS estado
          ORDER BY c.risk_score_v2 DESC
          LIMIT 25
        `,
      focusRuc ? { ruc: focusRuc } : {}
    );

    const companyIds = companyRows.map((r) => r.id as string);

    const [entityRows, addressRows, personRows, wonEdges, addrEdges, reprEdges, sameAddrEdges, sameReprEdges] =
      await Promise.all([
        // Entities connected to flagged companies
        runQuery<Record<string, unknown>>(`
          MATCH (c:Company)-[:WON]->(:Contract)-[:AWARDED_BY]->(e:PublicEntity)
          WHERE c.ruc IN $ids
          RETURN DISTINCT e.ruc AS id, e.name AS label, e.region AS region
          LIMIT 20
        `, { ids: companyIds }),

        // Addresses of flagged companies
        runQuery<Record<string, unknown>>(`
          MATCH (c:Company)-[:LOCATED_AT]->(a:Address)
          WHERE c.ruc IN $ids
          RETURN DISTINCT a.address_hash AS id, a.domicilio_fiscal AS label
          LIMIT 15
        `, { ids: companyIds }),

        // Shared representatives
        runQuery<Record<string, unknown>>(`
          MATCH (p:Person)-[:REPRESENTS]->(c:Company)
          WHERE c.ruc IN $ids
          WITH p, count(DISTINCT c) AS n WHERE n >= 2
          RETURN p.doc_id AS id, p.name AS label, n AS companies
          LIMIT 10
        `, { ids: companyIds }),

        // WON edges
        runQuery<Record<string, unknown>>(`
          MATCH (c:Company)-[:WON]->(:Contract)-[:AWARDED_BY]->(e:PublicEntity)
          WHERE c.ruc IN $ids
          RETURN DISTINCT c.ruc AS source, e.ruc AS target
        `, { ids: companyIds }),

        // LOCATED_AT edges
        runQuery<Record<string, unknown>>(`
          MATCH (c:Company)-[:LOCATED_AT]->(a:Address)
          WHERE c.ruc IN $ids
          RETURN c.ruc AS source, a.address_hash AS target
        `, { ids: companyIds }),

        // REPRESENTS edges (shared only)
        runQuery<Record<string, unknown>>(`
          MATCH (p:Person)-[:REPRESENTS]->(c:Company)
          WHERE c.ruc IN $ids
          WITH p, count(DISTINCT c) AS n WHERE n >= 2
          MATCH (p)-[:REPRESENTS]->(c2:Company)
          WHERE c2.ruc IN $ids
          RETURN p.doc_id AS source, c2.ruc AS target
        `, { ids: companyIds }),

        // SAME_ADDRESS_AS
        runQuery<Record<string, unknown>>(`
          MATCH (c1:Company)-[:SAME_ADDRESS_AS]-(c2:Company)
          WHERE c1.ruc IN $ids AND c2.ruc IN $ids AND c1.ruc < c2.ruc
          RETURN c1.ruc AS source, c2.ruc AS target
        `, { ids: companyIds }),

        // SAME_REPR_AS
        runQuery<Record<string, unknown>>(`
          MATCH (c1:Company)-[:SAME_REPR_AS]-(c2:Company)
          WHERE c1.ruc IN $ids AND c2.ruc IN $ids AND c1.ruc < c2.ruc
          RETURN c1.ruc AS source, c2.ruc AS target
        `, { ids: companyIds }),
      ]);

    const nodes = [
      ...companyRows.map((r) => ({
        id: r.id as string,
        label: ((r.label as string) || "").slice(0, 20),
        sub: `${toInt(r.workers)} trab. · S/${(toFloat(r.total) / 1_000_000).toFixed(1)}M`,
        type: "company",
        flagged: true,
        ruc: r.id as string,
        score: toInt(r.score),
      })),
      ...entityRows.map((r) => ({
        id: r.id as string,
        label: ((r.label as string) || "").slice(0, 20),
        sub: (r.region as string) || "Entidad pública",
        type: "entity",
        flagged: false,
      })),
      ...addressRows.map((r) => ({
        id: r.id as string,
        label: ((r.label as string) || "DOMICILIO").slice(0, 20),
        sub: "Domicilio fiscal",
        type: "address",
        flagged: true,
      })),
      ...personRows.map((r) => ({
        id: r.id as string,
        label: ((r.label as string) || "REPRESENTANTE").slice(0, 20),
        sub: `${toInt(r.companies)} empresas`,
        type: "person",
        flagged: true,
      })),
    ];

    const edges = [
      ...wonEdges.map((r) => ({ source: r.source as string, target: r.target as string, label: "WON", flagged: false })),
      ...addrEdges.map((r) => ({ source: r.source as string, target: r.target as string, label: "LOCATED_AT", flagged: false })),
      ...reprEdges.map((r) => ({ source: r.source as string, target: r.target as string, label: "REPRESENTS", flagged: true })),
      ...sameAddrEdges.map((r) => ({ source: r.source as string, target: r.target as string, label: "SAME_ADDR", flagged: true })),
      ...sameReprEdges.map((r) => ({ source: r.source as string, target: r.target as string, label: "SAME_REPR", flagged: true })),
    ];

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error("[api/grafo]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

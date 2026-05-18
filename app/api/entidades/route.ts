import { NextResponse } from "next/server";
import { runQuery, toInt, toFloat } from "@/lib/neo4j";

function deriveEntityFlags(concentrationPct: number, uniqueVendors: number, totalContracts: number): string[] {
  const flags: string[] = [];
  if (uniqueVendors === 1 && totalContracts >= 3) flags.push("PROVEEDOR_ÚNICO");
  else if (concentrationPct >= 80 && uniqueVendors <= 3) flags.push("CAPTURADA");
  else if (concentrationPct >= 60) flags.push("OLIGOPOLIO");
  return flags;
}

export async function GET() {
  try {
    const rows = await runQuery<Record<string, unknown>>(`
      MATCH (e:PublicEntity)<-[:AWARDED_BY]-(k:Contract)<-[:WON]-(c:Company)
      WITH e, c, sum(k.monto) AS vendor_total, count(k) AS vendor_contracts
      ORDER BY vendor_total DESC
      WITH e,
        collect({ruc: c.ruc, name: c.name, total: vendor_total, contracts: vendor_contracts, score: coalesce(c.risk_score_v2, 0), workers: c.max_trabajadores}) AS all_vendors,
        sum(vendor_total) AS entity_total,
        sum(vendor_contracts) AS total_contracts,
        count(c) AS unique_vendors
      WHERE entity_total > 0
      WITH e, entity_total, total_contracts, unique_vendors, all_vendors,
        all_vendors[0..5] AS top_vendors,
        CASE WHEN size(all_vendors) >= 3
          THEN reduce(s = 0.0, v IN all_vendors[0..3] | s + v.total)
          ELSE reduce(s = 0.0, v IN all_vendors | s + v.total)
        END AS top3_sum
      RETURN
        e.ruc        AS ruc,
        e.name       AS name,
        coalesce(e.region, 'N/D') AS region,
        entity_total AS total_awarded,
        unique_vendors AS unique_vendors,
        total_contracts AS total_contracts,
        top_vendors  AS top_vendors,
        toInteger(round(100.0 * top3_sum / entity_total)) AS concentration_pct
      ORDER BY concentration_pct DESC, entity_total DESC
      LIMIT 200
    `);

    const data = rows.map((r) => {
      const rawVendors = (r.top_vendors as Record<string, unknown>[]) ?? [];
      const concentrationPct = toInt(r.concentration_pct);
      const uniqueVendors   = toInt(r.unique_vendors);
      const totalContracts  = toInt(r.total_contracts);
      const totalAwarded    = toFloat(r.total_awarded);

      const topVendors = rawVendors.map((v) => ({
        ruc:       v.ruc as string,
        name:      (v.name as string) || "N/D",
        total:     toFloat(v.total),
        contracts: toInt(v.contracts),
        share_pct: totalAwarded > 0
          ? Math.round((toFloat(v.total) / totalAwarded) * 100)
          : 0,
        score: toInt(v.score),
        workers: toInt(v.workers),
      }));

      return {
        ruc:              (r.ruc as string) || "",
        name:             (r.name as string) || "SIN NOMBRE",
        region:           (r.region as string) || "N/D",
        total_awarded:    totalAwarded,
        unique_vendors:   uniqueVendors,
        total_contracts:  totalContracts,
        concentration_pct: concentrationPct,
        top_vendors:      topVendors,
        flags:            deriveEntityFlags(concentrationPct, uniqueVendors, totalContracts),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/entidades]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

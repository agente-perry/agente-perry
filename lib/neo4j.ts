import neo4j, { Driver, Integer } from "neo4j-driver";

let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (!_driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER ?? "neo4j";
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !password) {
      throw new Error("NEO4J_URI and NEO4J_PASSWORD must be set in .env.local");
    }

    _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 10,
      connectionAcquisitionTimeout: 10000,
    });
  }
  return _driver;
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const db = process.env.NEO4J_DATABASE ?? "neo4j";
  const session = getDriver().session({ database: db });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

/** neo4j-driver returns Integer objects for integers — convert to plain JS numbers */
export function toInt(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (neo4j.isInt(v as Integer)) return (v as Integer).toNumber();
  return Number(v);
}

export function toFloat(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v));
}

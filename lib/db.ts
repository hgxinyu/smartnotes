import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __smartNotesPool__: Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }

  if (!global.__smartNotesPool__) {
    global.__smartNotesPool__ = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return global.__smartNotesPool__;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}


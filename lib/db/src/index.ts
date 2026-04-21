import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getRuntimeDatabaseUrl } from "./connection";
import * as schema from "./schema";

const { Pool } = pg;
export const pool = new Pool({ connectionString: getRuntimeDatabaseUrl() });
export const db = drizzle(pool, { schema });

export * from "./schema";

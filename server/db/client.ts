/**
 * Drizzle client over libsql (local SQLite file, or a remote libsql/Turso URL).
 *
 * DATABASE_URL examples:
 *   file:./server/db/ailympics.db   (local dev — default)
 *   libsql://your-db.turso.io       (+ DATABASE_AUTH_TOKEN)
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'file:./server/db/ailympics.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

export const db = drizzle(client, { schema });
export { schema };

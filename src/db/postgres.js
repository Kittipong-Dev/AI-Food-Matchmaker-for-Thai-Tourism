import pg from 'pg';
import { env, requireEnv } from '../config/env.js';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: requireEnv('DATABASE_URL', env.databaseUrl),
      ssl: env.databaseUrl.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : undefined
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

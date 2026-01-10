import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/* ======================================================
 * ENV VALIDATION
 * ====================================================== */
const requiredEnv = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
] as const;

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`❌ ${key} is not defined`);
    }
}

/* ======================================================
 * POOL CONFIG
 * ====================================================== */
export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,

    application_name: 'gmail-worker',

    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
});

/* ======================================================
 * POOL EVENTS
 * ====================================================== */
let connected = false;

pool.on('connect', (client) => {
    if (!connected) {
        console.log('✅ PostgreSQL pool connected');
        connected = true;
    }
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
    // ❗ jangan exit → biarkan pool reconnect
});

/* ======================================================
 * OPTIONAL: INITIAL PING
 * ====================================================== */
export async function verifyDbConnection(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('✅ PostgreSQL connection verified');
    } finally {
        client.release();
    }
}

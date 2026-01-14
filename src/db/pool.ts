import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/* ======================================================
 * ENV VALIDATION
 * ====================================================== */
if (!process.env.DATABASE_URL) {
    throw new Error('❌ DATABASE_URL is not defined');
}

/* ======================================================
 * POOL CONFIG
 * ====================================================== */
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,

    application_name: 'gmail-worker',

    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

/* ======================================================
 * POOL EVENTS
 * ====================================================== */
let connected = false;

pool.on('connect', async (client) => {
    if (!connected) {
        const res = await client.query('SELECT current_database()');
        console.log('✅ PostgreSQL pool connected');
        console.log('📦 Connected database:', res.rows[0].current_database);
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

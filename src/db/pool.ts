import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DB_HOST) {
    throw new Error('❌ DB_HOST is not defined');
}
if (!process.env.DB_USER) {
    throw new Error('❌ DB_USER is not defined');
}
if (!process.env.DB_PASSWORD) {
    throw new Error('❌ DB_PASSWORD is not defined');
}
if (!process.env.DB_NAME) {
    throw new Error('❌ DB_NAME is not defined');
}

export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,

    // 🔒 connection safety
    max: 10,                     // max concurrent connections
    idleTimeoutMillis: 30000,    // close idle clients
    connectionTimeoutMillis: 5000
});

pool.on('connect', () => {
    console.log('✅ PostgreSQL pool connected');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
    process.exit(1); // hard fail → restart worker
});

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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

export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,

    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
});

let connected = false;

pool.on('connect', () => {
    if (!connected) {
        console.log('✅ PostgreSQL pool connected');
        connected = true;
    }
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
    process.exit(1);
});

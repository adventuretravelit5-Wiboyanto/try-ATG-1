/* ======================================================
 * ENV LOADER & VALIDATOR
 * ====================================================== */

import 'dotenv/config';

/* ======================================================
 * TYPES
 * ====================================================== */

export type NodeEnv = 'development' | 'test' | 'production';
export type WorkerMode = 'PDF' | 'GMAIL';

export interface AppEnv {
    NODE_ENV: NodeEnv;
    WORKER_MODE: WorkerMode;

    /* ================= IMAP (OPTIONAL) ================= */
    IMAP_HOST?: string;
    IMAP_PORT?: number;
    IMAP_USER?: string;
    IMAP_PASS?: string;
    IMAP_TLS?: boolean;

    /* ================= DATABASE ================= */
    DATABASE_URL: string;

    /* ================= THIRD PARTY ================= */
    THIRD_PARTY_BASE_URL: string;
    THIRD_PARTY_API_KEY: string;

    /* ================= STORAGE ================= */
    PDF_OUTPUT_DIR: string;
}

/* ======================================================
 * HELPERS
 * ====================================================== */

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(`❌ Missing required env: ${key}`);
    }
    return value;
}

function optionalEnv(key: string): string | undefined {
    const value = process.env[key];
    return value && value.trim() !== '' ? value : undefined;
}

function parseNumber(value?: string, fallback?: number): number | undefined {
    if (!value) return fallback;
    const num = Number(value);
    if (Number.isNaN(num)) {
        throw new Error(`❌ Invalid number env value: ${value}`);
    }
    return num;
}

function parseBoolean(value?: string, fallback = false): boolean {
    if (!value) return fallback;
    return value === 'true' || value === '1';
}

/* ======================================================
 * LOAD ENV
 * ====================================================== */

const WORKER_MODE =
    (process.env.WORKER_MODE as WorkerMode) ?? 'PDF';

export const env: AppEnv = {
    NODE_ENV:
        (process.env.NODE_ENV as NodeEnv) ??
        'development',

    WORKER_MODE,

    /* ================= DATABASE ================= */
    DATABASE_URL: requireEnv('DATABASE_URL'),

    /* ================= THIRD PARTY ================= */
    THIRD_PARTY_BASE_URL: requireEnv('THIRD_PARTY_BASE_URL'),
    THIRD_PARTY_API_KEY: requireEnv('THIRD_PARTY_API_KEY'),

    /* ================= STORAGE ================= */
    PDF_OUTPUT_DIR:
        optionalEnv('PDF_OUTPUT_DIR') ?? 'data/pdf'
};

/* ======================================================
 * CONDITIONAL IMAP (ONLY IF GMAIL MODE)
 * ====================================================== */

if (WORKER_MODE === 'GMAIL') {
    env.IMAP_HOST = requireEnv('IMAP_HOST');
    env.IMAP_PORT = parseNumber(process.env.IMAP_PORT, 993);
    env.IMAP_USER = requireEnv('IMAP_USER');
    env.IMAP_PASS = requireEnv('IMAP_PASS');
    env.IMAP_TLS = parseBoolean(process.env.IMAP_TLS, true);
}

/* ======================================================
 * VALIDATION
 * ====================================================== */

export function verifyEnv(): void {
    if (!['development', 'test', 'production'].includes(env.NODE_ENV)) {
        throw new Error(`❌ Invalid NODE_ENV: ${env.NODE_ENV}`);
    }

    if (!['PDF', 'GMAIL'].includes(env.WORKER_MODE)) {
        throw new Error(`❌ Invalid WORKER_MODE: ${env.WORKER_MODE}`);
    }
}

/* ======================================================
 * LOG SUMMARY
 * ====================================================== */

export function logEnvSummary(): void {
    console.log('✓ Configuration loaded');
    console.log(`• NODE_ENV = ${env.NODE_ENV}`);
    console.log(`• WORKER_MODE = ${env.WORKER_MODE}`);
    console.log(`• DATABASE_URL = [HIDDEN]`);
    console.log(`• THIRD_PARTY_BASE_URL = ${env.THIRD_PARTY_BASE_URL}`);
    console.log(`• PDF_OUTPUT_DIR = ${env.PDF_OUTPUT_DIR}`);

    if (env.WORKER_MODE === 'GMAIL') {
        console.log(`• IMAP_HOST = ${env.IMAP_HOST}`);
        console.log(`• IMAP_PORT = ${env.IMAP_PORT}`);
    }
}

/* ======================================================
 * ENV LOADER & VALIDATOR
 * ====================================================== */

import 'dotenv/config';

/* ======================================================
 * TYPES
 * ====================================================== */

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
    NODE_ENV: NodeEnv;

    /* ================= IMAP ================= */
    IMAP_HOST: string;
    IMAP_PORT: number;
    IMAP_USER: string;
    IMAP_PASS: string;
    IMAP_TLS: boolean;

    /* ================= DATABASE ================= */
    DATABASE_URL: string;

    /* ================= THIRD PARTY ================= */
    THIRD_PARTY_BASE_URL: string;
    THIRD_PARTY_API_KEY: string;

    /* ================= SMTP (OPTIONAL) ================= */
    SMTP_HOST?: string;
    SMTP_PORT?: number;
    SMTP_USER?: string;
    SMTP_PASS?: string;

    /* ================= STORAGE ================= */
    PDF_OUTPUT_DIR: string;
}

/* ======================================================
 * INTERNAL HELPERS
 * ====================================================== */

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`❌ Missing required env: ${key}`);
    }
    return value;
}

function optionalEnv(key: string): string | undefined {
    return process.env[key];
}

function parseNumber(
    value: string | undefined,
    fallback?: number
): number | undefined {
    if (!value) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
}

function parseBoolean(
    value: string | undefined,
    fallback = false
): boolean {
    if (!value) return fallback;
    return value === 'true' || value === '1';
}

/* ======================================================
 * LOAD & VALIDATE ENV
 * ====================================================== */

export const env: AppEnv = {
    NODE_ENV:
        (process.env.NODE_ENV as NodeEnv) ??
        'development',

    /* ================= IMAP ================= */
    IMAP_HOST: requireEnv('IMAP_HOST'),
    IMAP_PORT: parseNumber(
        requireEnv('IMAP_PORT'),
        993
    )!,
    IMAP_USER: requireEnv('IMAP_USER'),
    IMAP_PASS: requireEnv('IMAP_PASS'),
    IMAP_TLS: parseBoolean(
        process.env.IMAP_TLS,
        true
    ),

    /* ================= DATABASE ================= */
    DATABASE_URL: requireEnv('DATABASE_URL'),

    /* ================= THIRD PARTY ================= */
    THIRD_PARTY_BASE_URL: requireEnv('THIRD_PARTY_BASE_URL'),
    THIRD_PARTY_API_KEY: requireEnv('THIRD_PARTY_API_KEY'),

    /* ================= SMTP (OPTIONAL) ================= */
    SMTP_HOST: optionalEnv('SMTP_HOST'),
    SMTP_PORT: parseNumber(optionalEnv('SMTP_PORT')),
    SMTP_USER: optionalEnv('SMTP_USER'),
    SMTP_PASS: optionalEnv('SMTP_PASS'),

    /* ================= STORAGE ================= */
    PDF_OUTPUT_DIR:
        optionalEnv('PDF_OUTPUT_DIR') ??
        'data/pdf'
};

/* ======================================================
 * LOG ON BOOT
 * ====================================================== */

export function logEnvSummary(): void {
    console.log('✓ Configuration valid');
    console.log(`• NODE_ENV = ${env.NODE_ENV}`);
    console.log(`• IMAP_HOST = ${env.IMAP_HOST}`);
    console.log(`• DATABASE_URL = [HIDDEN]`);
    console.log(`• THIRD_PARTY_BASE_URL = ${env.THIRD_PARTY_BASE_URL}`);
}

import dotenv from 'dotenv';
import { ImapConfig, SmtpConfig, EmailFilter, WorkerConfig } from '../types';

dotenv.config();

export const imapConfig: ImapConfig = {
    user: process.env.IMAP_USER || '',
    password: process.env.IMAP_PASSWORD || '',
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: process.env.IMAP_TLS === 'true',
    tlsOptions: {
        rejectUnauthorized: false
    }
};

export const smtpConfig: SmtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || ''
    },
    from: {
        name: process.env.SMTP_FROM_NAME || 'Global Komunika',
        email: process.env.SMTP_FROM_EMAIL || ''
    }
};

export const emailFilter: EmailFilter = {
    from: process.env.FILTER_FROM || 'ticket@globaltix.com',
    subject: process.env.FILTER_SUBJECT || 'New Purchased Tickets'
};

export const workerConfig: WorkerConfig = {
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '30000'),
    markAsRead: process.env.MARK_AS_READ === 'true'
};

export const esimConfig = {
    provider: (process.env.ESIM_PROVIDER || 'mock') as 'mock' | 'airalo' | 'dataplans' | 'esim-sm' | 'esimfree',
    apiKey: process.env.ESIM_API_KEY,
    apiUrl: process.env.ESIM_API_URL,
    sandbox: process.env.ESIM_SANDBOX === 'true'
};

// Validate required configuration
export function validateConfig(): void {
    const required = [
        'IMAP_USER',
        'IMAP_PASSWORD',
        'SMTP_USER',
        'SMTP_PASSWORD'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

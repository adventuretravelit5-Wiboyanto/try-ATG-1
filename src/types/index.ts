/* ======================================================
 * GLOBALTIX DOMAIN (EMAIL → DOMAIN)
 * ====================================================== */

export interface GlobalTixItem {
    /** UNIQUE business key */
    confirmationCode: string;

    productName: string;
    productVariant?: string;
    sku: string;

    /**
     * Parsed from email
     * Stored as DATE in PostgreSQL
     */
    visitDate?: Date;

    quantity: number;

    /**
     * Unit price per item (optional)
     * Stored as NUMERIC(12,2)
     */
    unitPrice?: number;
}

export interface GlobalTixOrder {
    /**
     * Internal DB UUID
     * Filled AFTER persist
     */
    id?: string;

    /**
     * UNIQUE per email / order
     */
    referenceNumber: string;

    /**
     * Parsed from email
     * Stored as TIMESTAMP
     */
    purchaseDate?: Date;

    resellerName?: string;

    customerName: string;
    customerEmail: string;
    alternativeEmail?: string;
    mobileNumber?: string;

    /**
     * Free text from email / payment info
     * Stored as VARCHAR
     */
    paymentStatus?: string;

    remarks?: string;

    /**
     * 1 order → N items
     */
    items: GlobalTixItem[];
}

/* ======================================================
 * DATABASE LAYER (INTERNAL)
 * ====================================================== */

/**
 * Mirrors table: orders
 */
export interface OrderRow {
    id: string;
    referenceNumber: string;
    purchaseDate?: Date;

    resellerName?: string;

    customerName: string;
    customerEmail: string;
    alternativeEmail?: string;
    mobileNumber?: string;

    paymentStatus?: string;
    remarks?: string;

    status: string;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Mirrors table: order_items
 */
export interface OrderItemRow {
    id: string;
    orderId: string;

    confirmationCode: string;

    productName: string;
    productVariant?: string;
    sku: string;

    visitDate?: Date;

    quantity: number;
    unitPrice?: number;

    createdAt: Date;
}

/* ======================================================
 * THIRD-PARTY PAYLOAD
 * ====================================================== */

export interface ThirdPartyOrderPayload {
    order: OrderRow;
    items: OrderItemRow[];
}

/* ======================================================
 * IMAP / SMTP
 * ====================================================== */

export interface ImapConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    tlsOptions?: {
        rejectUnauthorized: boolean;
    };
}

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: {
        name: string;
        email: string;
    };
}

/* ======================================================
 * WORKER
 * ====================================================== */

export interface EmailFilter {
    from?: string;
    subject?: string;
}

export interface WorkerConfig {
    /**
     * Mark email as read only AFTER:
     * - DB commit
     * - Third-party success
     */
    markAsRead: boolean;

    checkInterval?: number;
}

/* ======================================================
 * eSIM
 * ====================================================== */

export interface EsimIssueRequest {
    sku: string;
    quantity: number;

    customerName: string;
    customerEmail: string;
    referenceNumber: string;
}

export interface EsimIssueResponse {
    success: boolean;

    esimCodes?: string[];
    qrCodes?: string[];

    error?: string;
}

export type EsimProviderType =
    | 'mock'
    | 'airalo'
    | 'dataplans'
    | 'esim-sm'
    | 'esimfree';

export interface EsimProviderConfig {
    provider: EsimProviderType;

    apiKey?: string;
    apiUrl?: string;
    sandbox?: boolean;
}

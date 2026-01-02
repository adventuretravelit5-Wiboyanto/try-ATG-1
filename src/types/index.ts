export interface GlobalTixItem {
    confirmationCode: string;
    productName: string;
    variant: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    dateTime?: string;
    visitDate?: string;
}

export interface GlobalTixOrder {
    referenceNumber: string;
    purchaseDate: string;
    resellerName: string;
    customerName: string;
    customerEmail: string;
    alternateEmail: string;
    mobileNumber: string;
    nric?: string;
    remarks: string;
    items: GlobalTixItem[];
    paymentStatus: string;
}

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

export interface EmailFilter {
    from: string;
    subject: string;
}

export interface WorkerConfig {
    checkInterval: number;
    markAsRead: boolean;
}

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

export interface EsimProviderConfig {
    provider: 'mock' | 'airalo' | 'dataplans' | 'esim-sm' | 'esimfree';
    apiKey?: string;
    apiUrl?: string;
    sandbox?: boolean;
}

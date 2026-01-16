/* ======================================================
 * THIRD PARTY CONFIG
 * ====================================================== */

export interface ThirdPartyConfig {
    baseUrl: string;
    apiKey: string;
    timeoutMs?: number;
}

/* ======================================================
 * REQUEST PAYLOAD
 * (LOCKED CONTRACT WITH THIRD PARTY)
 * ====================================================== */

export interface ThirdPartyOrderPayload {

    confirmationCode: string;
    referenceNumber: string;
    purchaseDate: string | null;

    customer: {
        name: string;
        email: string;
        alternativeEmail?: string | null;
        mobileNumber?: string | null;
    };

    product: {
        name: string;
        variant?: string | null;
        sku: string;
        visitDate?: string | null;
        quantity: number;
        unitPrice?: number | null;
    };

    paymentStatus?: string | null;
    remarks?: string | null;
}

/* ======================================================
 * THIRD PARTY RESPONSE
 * (PROVISIONING RESULT)
 * ====================================================== */

export interface ThirdPartyEsimResponse {

    success: boolean;

    message?: string;

    data?: {
        productName: string;

        iccid: string;
        qrCode: string;

        smdpAddress: string;
        activationCode: string;
        combinedActivation?: string;

        apn?: {
            name?: string;
            username?: string;
            password?: string;
        };

        validFrom?: string;
        validUntil?: string;
    };
}

/* ======================================================
 * WEBHOOK / CALLBACK (OPTIONAL)
 * ====================================================== */

export interface ThirdPartyWebhookPayload {

    confirmationCode: string;
    status: 'READY' | 'FAILED';

    esim?: {
        iccid: string;
        activatedAt?: string;
    };

    errorMessage?: string;
}

/* ======================================================
 * SYNC LOG VIEW
 * ====================================================== */

export interface ThirdPartySyncLog {

    confirmationCode: string;
    referenceNumber: string;

    targetService: string;

    requestPayload: ThirdPartyOrderPayload;
    responsePayload?: ThirdPartyEsimResponse;

    status: 'SUCCESS' | 'FAILED';

    errorMessage?: string;

    attemptCount: number;

    createdAt: string;
    updatedAt: string;
}

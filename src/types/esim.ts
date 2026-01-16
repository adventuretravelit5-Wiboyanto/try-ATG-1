/* ======================================================
 * eSIM STATUS ENUM
 * ====================================================== */

export type EsimStatus =
    | 'PENDING'     // Data belum diproses
    | 'PROCESS'     // Sedang provisioning / menunggu callback
    | 'READY'       // Siap dibuat PDF
    | 'DONE'        // PDF sudah dikirim & disimpan
    | 'FAILED';     // Gagal provisioning / PDF / upload

/* ======================================================
 * DATABASE ENTITY
 * (represents esim_details table)
 * ====================================================== */

export interface EsimDetail {
    id: string;

    order_item_id: string;

    product_name: string;

    valid_from: string | null;
    valid_until: string | null;

    qr_code: string | null;

    iccid: string | null;

    smdp_address: string | null;

    activation_code: string | null;

    combined_activation: string | null;

    apn_name: string | null;
    apn_username: string | null;
    apn_password: string | null;

    status: EsimStatus;

    provisioned_at: string | null;
    activated_at: string | null;

    created_at: string;
    updated_at: string;
}

/* ======================================================
 * INSERT PARAMS
 * (used by EsimRepository.insertProvisioning)
 * ====================================================== */

export interface CreateEsimDetailParams {
    orderItemId: string;

    productName: string;

    validFrom?: string | null;
    validUntil?: string | null;

    qrCode?: string | null;

    iccid?: string | null;

    smdpAddress?: string | null;

    activationCode?: string | null;

    combinedActivation?: string | null;

    apnName?: string | null;
    apnUsername?: string | null;
    apnPassword?: string | null;

    status?: EsimStatus;
}

/* ======================================================
 * UPDATE PARAMS
 * ====================================================== */

export interface UpdateEsimStatusParams {
    orderItemId: string;
    status: EsimStatus;
}

/* ======================================================
 * PDF GENERATION PAYLOAD
 * (used by PdfService)
 * ====================================================== */

export interface EsimPdfPayload {
    productName: string;

    validFrom: string | null;
    validUntil: string | null;

    qrCode: string | null;

    iccid: string | null;

    smdpAddress: string | null;

    activationCode: string | null;

    combinedActivation: string | null;

    apnName: string | null;
    apnUsername: string | null;
    apnPassword: string | null;
}

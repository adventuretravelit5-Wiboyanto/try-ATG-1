import axios, { AxiosInstance } from 'axios';
import { OrderReader, OrderItemDetailRow } from '../db/order.reader';
import { SyncLogRepository } from '../db/sync-log.repository';
import { EsimRepository } from '../db/esim.repository';

/* ======================================================
 * CONFIG TYPES
 * ====================================================== */

export type ThirdPartyConfig = {
    baseUrl: string;
    apiKey: string;
    timeoutMs?: number;
};

/* ======================================================
 * PAYLOAD CONTRACT (LOCKED)
 * ====================================================== */

export type ThirdPartyOrderPayload = {
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
};

/* ======================================================
 * RESPONSE CONTRACT (PROVISIONING)
 * ====================================================== */

export type ThirdPartyProvisioningResponse = {
    iccid: string;
    qr_code: string;
    smdp_address: string;
    activation_code: string;
    combined_activation: string;

    apn?: {
        name?: string;
        username?: string;
        password?: string;
    };
};

/* ======================================================
 * CONSTANT
 * ====================================================== */

const TARGET_SERVICE = 'THIRD_PARTY';

/* ======================================================
 * SERVICE
 * ====================================================== */

export class ThirdPartyService {

    private readonly http: AxiosInstance;
    private readonly orderReader: OrderReader;
    private readonly syncLogRepo: SyncLogRepository;
    private readonly esimRepo: EsimRepository;

    constructor(
        config: ThirdPartyConfig,
        orderReader = new OrderReader(),
        syncLogRepo = new SyncLogRepository(),
        esimRepo = new EsimRepository()
    ) {
        if (!config?.baseUrl || !config?.apiKey) {
            throw new Error(
                'ThirdPartyService config invalid (baseUrl / apiKey required)'
            );
        }

        this.orderReader = orderReader;
        this.syncLogRepo = syncLogRepo;
        this.esimRepo = esimRepo;

        this.http = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeoutMs ?? 15_000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            }
        });
    }

    /* ======================================================
     * PUBLIC API
     * ====================================================== */

    /**
     * 🔥 CRITICAL PATH
     * - Idempotent
     * - Logged
     * - Persist provisioning result
     */
    async sendOrderByConfirmationCode(
        confirmationCode: string
    ): Promise<void> {

        /* ========== IDEMPOTENCY CHECK ========== */

        const alreadySynced =
            await this.syncLogRepo.isAlreadySynced(
                confirmationCode,
                TARGET_SERVICE
            );

        if (alreadySynced) {
            return;
        }

        /* ========== FETCH ORDER ITEM ========== */

        const orderItem =
            await this.orderReader.getOrderByConfirmationCode(
                confirmationCode
            );

        if (!orderItem) {
            throw new Error(
                `Order item not found: ${confirmationCode}`
            );
        }

        const payload =
            this.buildPayloadFromOrderItem(orderItem);

        /* ========== SEND TO THIRD PARTY ========== */

        try {
            const response =
                await this.postOrder(payload);

            /* ===== SAVE eSIM PROVISIONING RESULT ===== */

            await this.esimRepo.insertProvisioning({
                orderItemId: orderItem.order_item_id,
                productName: orderItem.product_name,

                iccid: response.iccid,
                qrCode: response.qr_code,
                smdpAddress: response.smdp_address,
                activationCode: response.activation_code,
                combinedActivation: response.combined_activation,

                apnName: response.apn?.name,
                apnUsername: response.apn?.username,
                apnPassword: response.apn?.password,

                status: 'PROCESS'
            });

            /* ===== SYNC LOG SUCCESS ===== */

            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: payload.referenceNumber,
                targetService: TARGET_SERVICE,
                requestPayload: payload,
                responsePayload: response,
                status: 'SUCCESS'
            });

        } catch (error: any) {

            /* ===== SYNC LOG FAILED ===== */

            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: payload.referenceNumber,
                targetService: TARGET_SERVICE,
                requestPayload: payload,
                responsePayload: error?.response?.data ?? null,
                status: 'FAILED',
                errorMessage:
                    error?.response?.data
                        ? JSON.stringify(error.response.data)
                        : error?.message
            });

            throw error;
        }
    }

    /**
     * 🔁 Sequential batch send
     */
    async sendMultipleByConfirmationCodes(
        confirmationCodes: string[]
    ): Promise<void> {

        for (const code of confirmationCodes) {
            await this.sendOrderByConfirmationCode(code);
        }
    }

    /* ======================================================
     * INTERNAL HELPERS
     * ====================================================== */

    private buildPayloadFromOrderItem(
        row: OrderItemDetailRow
    ): ThirdPartyOrderPayload {

        return {
            confirmationCode: row.confirmation_code,
            referenceNumber: row.reference_number,
            purchaseDate: row.purchase_date
                ? row.purchase_date.toISOString()
                : null,

            customer: {
                name: row.customer_name,
                email: row.customer_email,
                alternativeEmail: row.alternative_email,
                mobileNumber: row.mobile_number
            },

            product: {
                name: row.product_name,
                variant: row.product_variant,
                sku: row.sku,
                visitDate: row.visit_date
                    ? row.visit_date.toISOString()
                    : null,
                quantity: row.quantity,
                unitPrice: row.unit_price
            },

            paymentStatus: row.payment_status,
            remarks: row.remarks
        };
    }

    /**
     * 🚨 ACTUAL DELIVERY
     */
    private async postOrder(
        payload: ThirdPartyOrderPayload
    ): Promise<ThirdPartyProvisioningResponse> {

        try {
            const response = await this.http.post(
                '/orders',
                payload
            );

            if (response.status < 200 || response.status >= 300) {
                throw new Error(
                    `Third-party rejected order ${payload.confirmationCode} ` +
                    `(status ${response.status})`
                );
            }

            return response.data;

        } catch (error: any) {

            const message =
                error?.response?.data
                    ? JSON.stringify(error.response.data)
                    : error?.message ?? 'Unknown error';

            throw new Error(
                `Third-party delivery failed for ` +
                `${payload.confirmationCode}: ${message}`
            );
        }
    }
}

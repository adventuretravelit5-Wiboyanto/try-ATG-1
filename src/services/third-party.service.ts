import axios, { AxiosInstance } from 'axios';
import {
    OrderReader,
    OrderItemDetailRow
} from '../db/order.reader';
import {
    SyncLogRepository,
    SyncStatus
} from '../db/sync-log.repository';

/* ======================================================
 * CONFIG TYPES
 * ====================================================== */

export type ThirdPartyConfig = {
    baseUrl: string;
    apiKey: string;
    timeoutMs?: number;
};

/* ======================================================
 * PAYLOAD CONTRACT
 * (LOCKED with third party)
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
 * SERVICE
 * ====================================================== */

export class ThirdPartyService {

    private readonly http: AxiosInstance;
    private readonly orderReader: OrderReader;
    private readonly syncLogRepo: SyncLogRepository;

    constructor(
        config: ThirdPartyConfig,
        orderReader = new OrderReader(),
        syncLogRepo = new SyncLogRepository()
    ) {
        if (!config?.baseUrl || !config?.apiKey) {
            throw new Error(
                'ThirdPartyService config invalid (baseUrl / apiKey required)'
            );
        }

        this.orderReader = orderReader;
        this.syncLogRepo = syncLogRepo;

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
     * Send ONE order item by confirmation_code
     * - Idempotent
     * - Logged
     * - Throw on failure
     */
    async sendOrderByConfirmationCode(
        confirmationCode: string
    ): Promise<void> {

        /* ================= PREVENT DOUBLE SEND ================= */

        const alreadySynced =
            await this.syncLogRepo.isAlreadySynced(
                confirmationCode
            );

        if (alreadySynced) {
            return;
        }

        /* ================= FETCH DATA ================= */

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

        /* ================= SEND + LOG ================= */

        try {
            const response =
                await this.postOrder(payload);

            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: payload.referenceNumber,
                targetService: 'third-party-service',
                requestPayload: payload,
                responsePayload: response,
                status: 'SUCCESS'
            });

        } catch (error: any) {

            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: payload.referenceNumber,
                targetService: 'third-party-service',
                requestPayload: payload,
                responsePayload: error?.response?.data ?? null,
                status: 'FAILED',
                errorMessage: error?.message
            });

            throw error;
        }
    }

    /**
     * 🔁 Helper
     * Send MULTIPLE items (same order)
     * Sequential & safe
     */
    async sendMultipleByConfirmationCodes(
        confirmationCodes: string[]
    ): Promise<void> {

        for (const code of confirmationCodes) {
            await this.sendOrderByConfirmationCode(code);
        }
    }

    /* ======================================================
     * INTERNALS
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
     * Any non-2xx → THROW
     */
    private async postOrder(
        payload: ThirdPartyOrderPayload
    ): Promise<any> {

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

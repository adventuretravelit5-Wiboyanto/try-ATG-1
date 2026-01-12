import axios, { AxiosError } from 'axios';
import { OrderReader } from '../db/order.reader';
import { SyncLogRepository } from '../db/sync-log.repository';

/* ======================================================
 * TYPES
 * ====================================================== */

type IsoDateString = string | null;

type OrderItemPayload = {
    confirmationCode: string;
    productName: string;
    productVariant: string | null;
    sku: string;
    visitDate: IsoDateString;
    quantity: number;
    unitPrice: number | null;
};

type OrderDetailPayload = {
    type: 'ORDER_DETAIL';
    data: {
        referenceNumber: string;
        purchaseDate: IsoDateString;
        resellerName: string | null;
        customer: {
            name: string;
            email: string;
            alternativeEmail: string | null;
            mobileNumber: string | null;
        };
        paymentStatus: string | null;
        remarks: string | null;
        items: OrderItemPayload[];
    };
};

type OrderPayload = {
    type: 'ORDER';
    data: {
        confirmationCode: string;
        referenceNumber: string;
        customerName: string;
        customerEmail: string;
        product: {
            name: string;
            variant: string | null;
            sku: string;
        };
        visitDate: IsoDateString;
        quantity: number;
        unitPrice: number | null;
    };
};

/* ======================================================
 * SERVICE
 * ====================================================== */

export class OrderPushService {
    private reader = new OrderReader();
    private syncLogRepo = new SyncLogRepository();

    private readonly apiUrl: string;

    constructor() {
        if (!process.env.THIRD_PARTY_API_URL) {
            throw new Error('THIRD_PARTY_API_URL is required');
        }
        this.apiUrl = process.env.THIRD_PARTY_API_URL;
    }

    /* ======================================================
     * PUSH SINGLE ITEM (PRIMARY)
     * ====================================================== */

    async pushByConfirmationCode(
        confirmationCode: string
    ): Promise<void> {

        // ✅ Idempotency guard
        if (await this.syncLogRepo.isAlreadySynced(confirmationCode)) {
            console.log(`⏭️ Already synced: ${confirmationCode}`);
            return;
        }

        const item =
            await this.reader.getOrderByConfirmationCode(confirmationCode);

        if (!item) {
            console.warn(`⚠️ Item not found: ${confirmationCode}`);
            return;
        }

        const payload: OrderPayload = {
            type: 'ORDER',
            data: {
                confirmationCode: item.confirmation_code,
                referenceNumber: item.reference_number,
                customerName: item.customer_name,
                customerEmail: item.customer_email,
                product: {
                    name: item.product_name,
                    variant: item.product_variant,
                    sku: item.sku
                },
                visitDate: toIso(item.visit_date),
                quantity: item.quantity,
                unitPrice: item.unit_price
            }
        };

        try {
            const res = await this.send(payload, confirmationCode);

            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: item.reference_number,
                targetService: 'third-party-service',
                requestPayload: payload,
                responsePayload: res,
                status: 'SUCCESS'
            });

        } catch (error: any) {
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: item.reference_number,
                targetService: 'third-party-service',
                requestPayload: payload,
                status: 'FAILED',
                errorMessage: error.message
            });
        }
    }

    /* ======================================================
     * HTTP CLIENT
     * ====================================================== */

    private async send(
        payload: any,
        idempotencyKey: string
    ) {
        const res = await axios.post(
            this.apiUrl,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey
                },
                timeout: 15_000
            }
        );

        return {
            status: res.status,
            data: res.data
        };
    }
}

/* ======================================================
 * HELPERS
 * ====================================================== */

function toIso(
    date?: Date | null
): string | null {
    return date ? date.toISOString() : null;
}

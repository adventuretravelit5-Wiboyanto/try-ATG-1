import axios, { AxiosError } from 'axios';
import { OrderReader } from '../db/order.reader';

/* ======================================================
 * TYPES (PAYLOAD TO THIRD PARTY)
 * ====================================================== */

type OrderItemPayload = {
    confirmationCode: string;
    productName: string;
    productVariant: string | null;
    sku: string;
    visitDate: Date | null;
    quantity: number;
    unitPrice: number | null;
};

type OrderDetailPayload = {
    type: 'ORDER_DETAIL';
    data: {
        referenceNumber: string;
        purchaseDate: Date | null;
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
        visitDate: Date | null;
        quantity: number;
        unitPrice: number | null;
    };
};

/* ======================================================
 * SERVICE
 * ====================================================== */

export class OrderPushService {
    private reader = new OrderReader();

    private readonly apiUrl: string =
        process.env.THIRD_PARTY_API_URL ??
        'http://localhost:3000/api/orders';

    /* ======================================================
     * PUSH ORDER DETAIL (1 reference_number)
     * ====================================================== */

    async pushByReference(referenceNumber: string): Promise<void> {
        const order =
            await this.reader.getOrderDetailByReference(referenceNumber);

        if (!order) {
            console.warn(`⚠️ Order not found: ${referenceNumber}`);
            return;
        }

        if (!order.items || order.items.length === 0) {
            console.warn(
                `⚠️ Order ${referenceNumber} has no items`
            );
            return;
        }

        const payload: OrderDetailPayload = {
            type: 'ORDER_DETAIL',
            data: {
                referenceNumber: order.reference_number,
                purchaseDate: order.purchase_date,
                resellerName: order.reseller_name,
                customer: {
                    name: order.customer_name,
                    email: order.customer_email,
                    alternativeEmail: order.alternative_email,
                    mobileNumber: order.mobile_number
                },
                paymentStatus: order.payment_status,
                remarks: order.remarks,
                items: order.items.map((item) => ({
                    confirmationCode: item.confirmationCode,
                    productName: item.productName,
                    productVariant: item.productVariant,
                    sku: item.sku,
                    visitDate: item.visitDate,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                }))
            }
        };

        await this.send(payload);

        console.log(`🚀 ORDER_DETAIL pushed: ${referenceNumber}`);
    }

    /* ======================================================
     * PUSH ORDER (1 confirmation_code)
     * ====================================================== */

    async pushByConfirmationCode(
        confirmationCode: string
    ): Promise<void> {
        const item =
            await this.reader.getOrderByConfirmationCode(
                confirmationCode
            );

        if (!item) {
            console.warn(
                `⚠️ Item not found: ${confirmationCode}`
            );
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
                visitDate: item.visit_date,
                quantity: item.quantity,
                unitPrice: item.unit_price
            }
        };

        await this.send(payload);

        console.log(`🚀 ORDER pushed: ${confirmationCode}`);
    }

    /* ======================================================
     * HTTP CLIENT
     * ====================================================== */

    private async send(
        payload: OrderDetailPayload | OrderPayload
    ): Promise<void> {
        try {
            await axios.post(this.apiUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15_000
            });
        } catch (err) {
            const error = err as AxiosError;

            if (error.response) {
                console.error('❌ Third-party API error', {
                    status: error.response.status,
                    data: error.response.data
                });
            } else if (error.request) {
                console.error(
                    '❌ No response from third-party API'
                );
            } else {
                console.error(
                    '❌ Push error',
                    error.message
                );
            }

            throw error;
        }
    }
}

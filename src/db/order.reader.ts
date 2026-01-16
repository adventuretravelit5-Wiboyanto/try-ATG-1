import { pool } from './pool';

/* ======================================================
 * READ MODELS (DB → SERVICE)
 * ====================================================== */

/**
 * Order item row for aggregated order detail
 */
export type OrderItemRow = {
    confirmationCode: string;
    productName: string;
    productVariant: string | null;
    sku: string;
    visitDate: Date | null;
    quantity: number;
    unitPrice: number | null;
};

/**
 * Full order detail (1 reference_number → many items)
 */
export type OrderDetailRow = {
    reference_number: string;
    purchase_date: Date | null;
    reseller_name: string | null;

    customer_name: string;
    customer_email: string;
    alternative_email: string | null;
    mobile_number: string | null;

    remarks: string | null;
    payment_status: string | null;

    items: OrderItemRow[];
};

/**
 * SINGLE order item detail
 * ⚠️ CONTRACT USED BY:
 * - ThirdPartyService
 * - eSIM provisioning
 * - Workflows & scripts
 */
export type OrderItemDetailRow = {
    /** UUID of order_items.id */
    order_item_id: string;

    confirmation_code: string;

    reference_number: string;
    purchase_date: Date | null;

    customer_name: string;
    customer_email: string;
    alternative_email: string | null;
    mobile_number: string | null;

    remarks: string | null;
    payment_status: string | null;

    product_name: string;
    product_variant: string | null;
    sku: string;
    visit_date: Date | null;
    quantity: number;
    unit_price: number | null;
};

/* ======================================================
 * READER
 * ====================================================== */

export class OrderReader {

    /* ======================================================
     * ORDER DETAIL
     * 1 reference_number → orders + ALL order_items
     * ====================================================== */
    async getOrderDetailByReference(
        referenceNumber: string
    ): Promise<OrderDetailRow | null> {

        const { rows } = await pool.query<OrderDetailRow>(
            `
            SELECT
                o.reference_number,
                o.purchase_date,
                o.reseller_name,
                o.customer_name,
                o.customer_email,
                o.alternative_email,
                o.mobile_number,
                o.remarks,
                o.payment_status,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'confirmationCode', i.confirmation_code,
                            'productName', i.product_name,
                            'productVariant', i.product_variant,
                            'sku', i.sku,
                            'visitDate', i.visit_date,
                            'quantity', i.quantity,
                            'unitPrice', i.unit_price
                        )
                        ORDER BY i.created_at
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'
                ) AS items
            FROM orders o
            LEFT JOIN order_items i
                ON i.order_id = o.id
            WHERE
                o.reference_number = $1
            GROUP BY
                o.id,
                o.reference_number,
                o.purchase_date,
                o.reseller_name,
                o.customer_name,
                o.customer_email,
                o.alternative_email,
                o.mobile_number,
                o.remarks,
                o.payment_status
            `,
            [referenceNumber]
        );

        return rows[0] ?? null;
    }

    /* ======================================================
     * SINGLE ITEM
     * 1 confirmation_code → 1 order_item
     * ====================================================== */
    async getOrderByConfirmationCode(
        confirmationCode: string
    ): Promise<OrderItemDetailRow | null> {

        const { rows } = await pool.query<OrderItemDetailRow>(
            `
            SELECT
                i.id                AS order_item_id,
                i.confirmation_code,

                o.reference_number,
                o.purchase_date,
                o.customer_name,
                o.customer_email,
                o.alternative_email,
                o.mobile_number,
                o.remarks,
                o.payment_status,

                i.product_name,
                i.product_variant,
                i.sku,
                i.visit_date,
                i.quantity,
                i.unit_price
            FROM order_items i
            JOIN orders o
                ON o.id = i.order_id
            WHERE
                i.confirmation_code = $1
            LIMIT 1
            `,
            [confirmationCode]
        );

        return rows[0] ?? null;
    }
}

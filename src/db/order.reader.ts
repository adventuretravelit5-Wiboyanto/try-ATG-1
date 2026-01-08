import { pool } from './pool';

export class OrderReader {

    /* =======================================================
     * ORDER DETAIL
     * 1 reference_number → 1 order + SEMUA items
     * Dipakai untuk ORDER_DETAIL.json
     * ======================================================= */
    async getOrderDetailByReference(referenceNumber: string) {
        const { rows } = await pool.query(
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
                json_agg(
                    json_build_object(
                        'confirmationCode', i.confirmation_code,
                        'productName', i.product_name,
                        'productVariant', i.product_variant,
                        'sku', i.sku,
                        'visitDate', i.visit_date,
                        'quantity', i.quantity,
                        'unitPrice', i.unit_price,
                        'jsonExported', i.json_exported
                    )
                    ORDER BY i.created_at
                ) AS items
            FROM orders o
            JOIN order_items i ON i.order_id = o.id
            WHERE o.reference_number = $1
            GROUP BY o.id
            `,
            [referenceNumber]
        );

        return rows[0] || null;
    }

    /* =======================================================
     * ORDER FOR EXPORT
     * HANYA item yang BELUM json_exported
     * Dipakai oleh JsonExportService
     * ======================================================= */
    async getOrderForExportByReference(referenceNumber: string) {
        const { rows } = await pool.query(
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
                ) AS items
            FROM orders o
            JOIN order_items i ON i.order_id = o.id
            WHERE o.reference_number = $1
              AND i.json_exported = false
            GROUP BY o.id
            `,
            [referenceNumber]
        );

        return rows[0] || null;
    }

    /* =======================================================
     * ORDER BY CONFIRMATION CODE
     * 1 confirmation_code → 1 item
     * Dipakai untuk lookup / debug
     * ======================================================= */
    async getOrderByConfirmationCode(confirmationCode: string) {
        const { rows } = await pool.query(
            `
            SELECT
                i.confirmation_code,
                o.reference_number,
                o.customer_name,
                o.customer_email,
                i.product_name,
                i.product_variant,
                i.sku,
                i.visit_date,
                i.quantity,
                i.unit_price,
                i.json_exported
            FROM order_items i
            JOIN orders o ON o.id = i.order_id
            WHERE i.confirmation_code = $1
            `,
            [confirmationCode]
        );

        return rows[0] || null;
    }
}

import { pool } from './pool';

/* ======================================================
 * TYPES
 * ====================================================== */

export type OrderStatus =
    | 'RECEIVED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';

export type OrderItemStatus =
    | 'PENDING'
    | 'COMPLETED'
    | 'FAILED';

export interface OrderRow {
    id: string;
    reference_number: string;
    status: OrderStatus;
    created_at: Date;
    updated_at: Date;
}

export interface OrderItemRow {
    id: string;
    order_id: string;
    confirmation_code: string;
    product_name: string;
    product_variant?: string;
    sku?: string;
    visit_date?: string;
    quantity: number;
    unit_price?: number;
    status: OrderItemStatus;
    customer_email?: string;
    reference_number?: string;
}

/* ======================================================
 * REPOSITORY
 * ====================================================== */

export class OrderRepository {

    /* ======================================================
     * ORDER
     * ====================================================== */

    async upsertOrder(data: {
        referenceNumber: string;
        purchaseDate?: Date;
        resellerName?: string;

        customerName?: string;
        customerEmail?: string;
        alternativeEmail?: string;
        mobileNumber?: string;

        paymentStatus?: string;
        remarks?: string;
    }): Promise<{ id: string; referenceNumber: string }> {

        const { rows } = await pool.query(
            `
            INSERT INTO orders (
                reference_number,
                purchase_date,
                reseller_name,
                customer_name,
                customer_email,
                alternative_email,
                mobile_number,
                payment_status,
                remarks,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'RECEIVED')
            ON CONFLICT (reference_number)
            DO UPDATE SET
                updated_at = NOW()
            RETURNING id, reference_number
            `,
            [
                data.referenceNumber,
                data.purchaseDate ?? null,
                data.resellerName ?? null,
                data.customerName ?? null,
                data.customerEmail ?? null,
                data.alternativeEmail ?? null,
                data.mobileNumber ?? null,
                data.paymentStatus ?? null,
                data.remarks ?? null
            ]
        );

        return {
            id: rows[0].id,
            referenceNumber: rows[0].reference_number
        };
    }

    async updateStatus(
        orderId: string,
        status: OrderStatus
    ): Promise<void> {

        await pool.query(
            `
            UPDATE orders
            SET status = $2,
                updated_at = NOW()
            WHERE id = $1
            `,
            [orderId, status]
        );
    }

    async findByReferenceNumber(
        referenceNumber: string
    ): Promise<OrderRow | null> {

        const { rows } = await pool.query<OrderRow>(
            `
            SELECT *
            FROM orders
            WHERE reference_number = $1
            LIMIT 1
            `,
            [referenceNumber]
        );

        return rows[0] ?? null;
    }

    /* ======================================================
     * ORDER ITEMS
     * ====================================================== */

    async upsertOrderItem(data: {
        orderId: string;
        confirmationCode: string;
        productName: string;
        productVariant?: string;
        sku?: string;
        visitDate?: string;
        quantity: number;
        unitPrice?: number;
    }): Promise<void> {

        await pool.query(
            `
            INSERT INTO order_items (
                order_id,
                confirmation_code,
                product_name,
                product_variant,
                sku,
                visit_date,
                quantity,
                unit_price,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING')
            ON CONFLICT (confirmation_code)
            DO UPDATE SET
                updated_at = NOW()
            `,
            [
                data.orderId,
                data.confirmationCode,
                data.productName,
                data.productVariant ?? null,
                data.sku ?? null,
                data.visitDate ?? null,
                data.quantity,
                data.unitPrice ?? null
            ]
        );
    }

    async findItemById(
        itemId: string
    ): Promise<OrderItemRow | null> {

        const { rows } = await pool.query<OrderItemRow>(
            `
            SELECT
                oi.*,
                o.reference_number
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.id = $1
            `,
            [itemId]
        );

        return rows[0] ?? null;
    }

    async findItemByConfirmationCode(
        confirmationCode: string
    ): Promise<OrderItemRow | null> {

        const { rows } = await pool.query<OrderItemRow>(
            `
            SELECT
                oi.*,
                o.reference_number
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.confirmation_code = $1
            `,
            [confirmationCode]
        );

        return rows[0] ?? null;
    }

    async markItemCompleted(
        orderItemId: string
    ): Promise<void> {

        await pool.query(
            `
            UPDATE order_items
            SET status = 'COMPLETED',
                updated_at = NOW()
            WHERE id = $1
            `,
            [orderItemId]
        );
    }
}

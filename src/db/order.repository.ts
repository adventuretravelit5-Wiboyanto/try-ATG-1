import { pool } from './pool';
import { GlobalTixOrder } from '../types';

export class OrderRepository {

    async insertOrder(order: GlobalTixOrder): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            /**
             * 1️⃣ UPSERT ORDER
             * - Jika belum ada → insert
             * - Jika sudah ada → ambil id
             */
            const orderResult = await client.query(
                `
                INSERT INTO orders (
                    reference_number,
                    purchase_date,
                    reseller_name,
                    customer_name,
                    customer_email,
                    alternative_email,
                    mobile_number,
                    remarks,
                    payment_status
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (reference_number)
                DO UPDATE SET
                    updated_at = NOW()
                RETURNING id
                `,
                [
                    order.referenceNumber,
                    order.purchaseDate ?? null,
                    order.resellerName ?? null,
                    order.customerName,
                    order.customerEmail,
                    order.alternateEmail ?? null,
                    order.mobileNumber ?? null,
                    order.remarks ?? '',
                    order.paymentStatus ?? null
                ]
            );

            const orderId = orderResult.rows[0].id;

            /**
             * 2️⃣ INSERT ORDER ITEMS
             */
            if (order.items?.length) {
                for (const item of order.items) {
                    await client.query(
                        `
                        INSERT INTO order_items (
                            order_id,
                            confirmation_code,
                            product_name,
                            product_variant,
                            sku,
                            visit_date,
                            quantity,
                            unit_price
                        )
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                        ON CONFLICT (confirmation_code) DO NOTHING
                        `,
                        [
                            orderId,
                            item.confirmationCode,
                            item.productName,
                            item.productVariant ?? null,
                            item.sku,                    // WAJIB ADA
                            item.visitDate ?? null,
                            item.quantity ?? 1,           // DEFAULT 1
                            item.unitPrice ?? null
                        ]
                    );
                }
            } else {
                console.warn(
                    `⚠️ Order ${order.referenceNumber} has no items`
                );
            }

            await client.query('COMMIT');
            console.log(`✅ Order ${order.referenceNumber} processed`);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to insert order:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

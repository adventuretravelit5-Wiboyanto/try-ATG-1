import { pool } from './pool';
import { GlobalTixOrder } from '../types';

export class OrderRepository {

    /**
     * Insert order + order_items in ONE transaction
     */
    async insertOrder(order: GlobalTixOrder): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1️⃣ Insert order
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
                ON CONFLICT (reference_number) DO NOTHING
                RETURNING id
                `,
                [
                    order.referenceNumber,
                    order.purchaseDate,
                    order.resellerName,
                    order.customerName,
                    order.customerEmail,
                    order.alternateEmail,
                    order.mobileNumber,
                    order.remarks || '',       // pastikan tidak null
                    order.paymentStatus || null
                ]
            );

            // Kalau order sudah ada → log & return
            if (orderResult.rowCount === 0) {
                console.warn(`⚠️ Order ${order.referenceNumber} already exists`);
                await client.query('ROLLBACK');
                return;
            }

            const orderId = orderResult.rows[0].id;

            // 2️⃣ Insert items
            if (order.items && order.items.length > 0) {
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
                            item.productVariant,
                            item.sku,
                            item.visitDate || null,
                            item.quantity,
                            item.unitPrice
                        ]
                    );
                }
            } else {
                console.warn(`⚠️ Order ${order.referenceNumber} has 0 items`);
            }

            await client.query('COMMIT');
            console.log(`✅ Order ${order.referenceNumber} saved successfully`);

            // 3️⃣ TODO: mark email SEEN di worker email

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to insert order:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

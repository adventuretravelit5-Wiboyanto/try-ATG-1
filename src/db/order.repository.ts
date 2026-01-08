import { pool } from './pool';
import { GlobalTixOrder } from '../types';

export class OrderRepository {

    async insertOrder(order: GlobalTixOrder): Promise<number> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            /**
             * 1️⃣ UPSERT ORDER
             * - Selalu dapat order_id (insert / update)
             */
            const orderResult = await client.query<{ id: number }>(
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
                    purchase_date     = EXCLUDED.purchase_date,
                    reseller_name     = EXCLUDED.reseller_name,
                    customer_name     = EXCLUDED.customer_name,
                    customer_email    = EXCLUDED.customer_email,
                    alternative_email = EXCLUDED.alternative_email,
                    mobile_number     = EXCLUDED.mobile_number,
                    remarks           = EXCLUDED.remarks,
                    payment_status    = EXCLUDED.payment_status,
                    updated_at        = NOW()
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

            if (!orderResult.rowCount) {
                throw new Error(
                    `Failed to upsert order ${order.referenceNumber}`
                );
            }

            const orderId = orderResult.rows[0].id;

            /**
             * 2️⃣ INSERT ORDER ITEMS
             */
            if (!order.items || order.items.length === 0) {
                console.warn(
                    `⚠️ Order ${order.referenceNumber} stored WITHOUT items`
                );
            } else {
                for (const item of order.items) {

                    // 🛑 VALIDASI WAJIB
                    if (!item.confirmationCode) {
                        console.warn(
                            `⚠️ Skip item without confirmationCode`,
                            item
                        );
                        continue;
                    }

                    if (!item.sku) {
                        console.warn(
                            `⚠️ Skip item ${item.confirmationCode} without SKU`
                        );
                        continue;
                    }

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
                            item.productName ?? 'Unknown Product',
                            item.productVariant ?? null,
                            item.sku,
                            item.visitDate ?? null,
                            item.quantity ?? 1,
                            item.unitPrice ?? null
                        ]
                    );
                }
            }

            await client.query('COMMIT');

            console.log(
                `✅ Order ${order.referenceNumber} stored (order_id=${orderId})`
            );

            return orderId;

        } catch (error) {
            await client.query('ROLLBACK');

            console.error(
                `❌ Failed to store order ${order.referenceNumber}`,
                error
            );

            throw error;
        } finally {
            client.release();
        }
    }
}

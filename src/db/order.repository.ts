import { pool } from './pool';
import { GlobalTixOrder } from '../types';

export class OrderRepository {

    async upsertOrder(order: GlobalTixOrder): Promise<string> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            /* ==================== UPSERT ORDER ==================== */

            const orderResult = await client.query<{ id: string }>(
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
                    order.remarks ?? null,
                    order.paymentStatus ?? null
                ]
            );

            if (!orderResult.rows.length) {
                throw new Error(
                    `Order upsert failed: ${order.referenceNumber}`
                );
            }

            const orderId = orderResult.rows[0].id;

            /* ==================== UPSERT ITEMS ==================== */

            if (!order.items?.length) {
                // intentionally no throw
                console.warn(
                    `⚠️ Order ${order.referenceNumber} has no items`
                );
            } else {
                for (const item of order.items) {

                    if (!item.confirmationCode || !item.sku) {
                        console.warn(
                            `⚠️ Skip invalid item`,
                            item
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
                        ON CONFLICT (confirmation_code)
                        DO UPDATE SET
                            product_name    = EXCLUDED.product_name,
                            product_variant = EXCLUDED.product_variant,
                            sku             = EXCLUDED.sku,
                            visit_date      = EXCLUDED.visit_date,
                            quantity        = EXCLUDED.quantity,
                            unit_price      = EXCLUDED.unit_price,
                            updated_at      = NOW()
                        `,
                        [
                            orderId,
                            item.confirmationCode,
                            item.productName ?? 'Unknown Product',
                            item.productVariant ?? null,
                            item.sku,
                            item.visitDate ?? null,
                            Number.isInteger(item.quantity)
                                ? item.quantity
                                : 1,
                            item.unitPrice ?? null
                        ]
                    );
                }
            }

            await client.query('COMMIT');

            return orderId;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

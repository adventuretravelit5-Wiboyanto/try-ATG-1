import fs from 'fs/promises';
import path from 'path';
import { pool } from '../db/pool';
import { OrderReader } from '../db/order.reader';

export class JsonExportService {
    private reader = new OrderReader();

    private basePath = path.resolve(process.cwd(), 'json');
    private orderPath = path.join(this.basePath, 'order');
    private orderDetailPath = path.join(this.basePath, 'order_detail');

    constructor() {
        this.ensureFolders().catch(err => {
            console.error('❌ Failed to init JSON folders:', err);
        });
    }

    /* ==================== INIT ==================== */

    private async ensureFolders(): Promise<void> {
        await Promise.all([
            fs.mkdir(this.basePath, { recursive: true }),
            fs.mkdir(this.orderPath, { recursive: true }),
            fs.mkdir(this.orderDetailPath, { recursive: true })
        ]);
    }

    /* ==================== MAIN EXPORT ==================== */

    async exportByReference(referenceNumber: string): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            /**
             * 1️⃣ Ambil order detail + items
             */
            const order = await this.reader.getOrderDetailByReference(
                referenceNumber
            );

            if (!order) {
                console.warn(`⚠️ No order found for ${referenceNumber}`);
                await client.query('ROLLBACK');
                return;
            }

            /**
             * 2️⃣ Filter item yang BELUM diexport
             */
            const itemsToExport = order.items.filter(
                (item: any) => item.confirmationCode
            );

            if (!itemsToExport.length) {
                console.log(
                    `ℹ️ No new items to export for ${referenceNumber}`
                );
                await client.query('ROLLBACK');
                return;
            }

            /**
             * 3️⃣ ORDER DETAIL JSON (1 file per reference)
             */
            const orderDetail = {
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
                items: order.items
            };

            const detailFile = path.join(
                this.orderDetailPath,
                `${referenceNumber}.json`
            );

            await fs.writeFile(
                detailFile,
                JSON.stringify(orderDetail, null, 2)
            );

            /**
             * 4️⃣ ORDER JSON (per confirmation_code)
             */
            for (const item of itemsToExport) {
                const orderJson = {
                    confirmationCode: item.confirmationCode,
                    referenceNumber,
                    customerName: order.customer_name,
                    customerEmail: order.customer_email,
                    product: {
                        name: item.productName,
                        variant: item.productVariant,
                        sku: item.sku
                    },
                    visitDate: item.visitDate,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                };

                const orderFile = path.join(
                    this.orderPath,
                    `${item.confirmationCode}.json`
                );

                await fs.writeFile(
                    orderFile,
                    JSON.stringify(orderJson, null, 2)
                );

                /**
                 * 5️⃣ Tandai item sudah diexport
                 */
                await client.query(
                    `
                    UPDATE order_items
                    SET json_exported = true
                    WHERE confirmation_code = $1
                    `,
                    [item.confirmationCode]
                );
            }

            await client.query('COMMIT');

            console.log(
                `📦 JSON export completed for reference ${referenceNumber}`
            );

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(
                `❌ Failed exporting JSON for ${referenceNumber}`,
                err
            );
            throw err;
        } finally {
            client.release();
        }
    }
}

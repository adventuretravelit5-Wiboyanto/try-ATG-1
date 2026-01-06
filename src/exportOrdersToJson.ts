import { pool } from './db/pool';
import fs from 'fs';
import path from 'path';

async function exportOrdersToJson() {
    const client = await pool.connect();

    try {
        const res = await client.query(`
            SELECT o.id, o.reference_number, o.purchase_date, o.reseller_name,
                   o.customer_name, o.customer_email, o.alternative_email,
                   o.mobile_number, o.remarks, o.payment_status,
                   json_agg(
                       json_build_object(
                           'confirmationCode', oi.confirmation_code,
                           'productName', oi.product_name,
                           'productVariant', oi.product_variant,
                           'sku', oi.sku,
                           'visitDate', oi.visit_date,
                           'quantity', oi.quantity,
                           'unitPrice', oi.unit_price
                       )
                   ) AS items
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            GROUP BY o.id
        `);

        const data = res.rows.map(row => ({
            id: row.id,
            referenceNumber: row.reference_number,
            purchaseDate: row.purchase_date,
            resellerName: row.reseller_name,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            alternativeEmail: row.alternative_email,
            mobileNumber: row.mobile_number,
            remarks: row.remarks,
            paymentStatus: row.payment_status,
            items: row.items[0]?.confirmationCode ? row.items : []
        }));

        const filePath = path.join(__dirname, 'orders_export.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        console.log(`✅ Exported ${data.length} orders to ${filePath}`);
    } catch (err) {
        console.error('❌ Failed to export orders:', err);
    } finally {
        client.release();
    }
}

exportOrdersToJson();

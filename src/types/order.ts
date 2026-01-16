/* ======================================================
 * ORDER STATUS
 * ====================================================== */

export type OrderStatus =
    | 'RECEIVED'    // Email diterima & disimpan
    | 'PROCESS'     // Dikirim ke third party
    | 'PARTIAL'     // Sebagian item selesai
    | 'COMPLETED'   // Semua item selesai
    | 'FAILED';     // Gagal total

/* ======================================================
 * ORDER ENTITY (orders table)
 * ====================================================== */

export interface Order {
    id: string;

    reference_number: string;

    purchase_date: string | null;

    reseller_name: string | null;

    customer_name: string;
    customer_email: string;
    alternative_email: string | null;

    mobile_number: string | null;
    remarks: string | null;

    payment_status: string | null;

    status: OrderStatus;

    created_at: string;
    updated_at: string;
}

/* ======================================================
 * ORDER ITEM ENTITY (order_items table)
 * ====================================================== */

export interface OrderItem {
    id: string;

    order_id: string;

    confirmation_code: string;

    product_name: string;
    product_variant: string | null;

    sku: string;

    visit_date: string | null;

    quantity: number;
    unit_price: number | null;

    created_at: string;
}

/* ======================================================
 * ORDER CREATE PAYLOAD
 * (used by email parser & upsert logic)
 * ====================================================== */

export interface CreateOrderPayload {
    referenceNumber: string;

    purchaseDate?: string | null;

    resellerName?: string | null;

    customer: {
        name: string;
        email: string;
        alternativeEmail?: string | null;
        mobileNumber?: string | null;
    };

    remarks?: string | null;
    paymentStatus?: string | null;
}

/* ======================================================
 * ORDER ITEM CREATE PAYLOAD
 * ====================================================== */

export interface CreateOrderItemPayload {
    confirmationCode: string;

    productName: string;
    productVariant?: string | null;

    sku: string;

    visitDate?: string | null;

    quantity: number;
    unitPrice?: number | null;
}

/* ======================================================
 * READ MODEL
 * (used by OrderReader JOIN queries)
 * ====================================================== */

export interface OrderItemDetailRow {
    /* Order */
    reference_number: string;
    purchase_date: Date | null;

    customer_name: string;
    customer_email: string;
    alternative_email: string | null;
    mobile_number: string | null;

    remarks: string | null;
    payment_status: string | null;

    /* Order Item */
    order_item_id: string;

    confirmation_code: string;

    product_name: string;
    product_variant: string | null;

    sku: string;

    visit_date: Date | null;

    quantity: number;
    unit_price: number | null;
}

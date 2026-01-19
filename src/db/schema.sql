-- =====================================================
-- DATABASE: globaltix
-- =====================================================

-- Jalankan bagian ini sebagai superuser / user dengan privilege CREATE DATABASE
CREATE DATABASE globaltix;

\c globaltix;

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE: orders
-- =====================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reference_number VARCHAR(100) NOT NULL UNIQUE,
    purchase_date TIMESTAMP,

    reseller_name VARCHAR(255),

    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    alternative_email VARCHAR(255),

    mobile_number VARCHAR(50),
    remarks TEXT,

    payment_status VARCHAR(50),

    status VARCHAR(50) DEFAULT 'RECEIVED',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TABLE: order_items
-- =====================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    confirmation_code VARCHAR(100) NOT NULL UNIQUE,

    product_name VARCHAR(255) NOT NULL,
    product_variant VARCHAR(255),
    sku VARCHAR(100) NOT NULL,

    visit_date DATE,

    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2),

    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TABLE: esim_details
-- =====================================================
CREATE TABLE esim_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_item_id UUID NOT NULL
        REFERENCES order_items(id)
        ON DELETE CASCADE,

    product_name VARCHAR(255) NOT NULL,

    valid_from DATE,
    valid_until DATE,

    qr_code TEXT,

    iccid VARCHAR(50) UNIQUE,

    smdp_address VARCHAR(255),
    activation_code VARCHAR(255),
    combined_activation TEXT,

    apn_name VARCHAR(100),
    apn_username VARCHAR(100),
    apn_password VARCHAR(100),

    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    provisioned_at TIMESTAMP,
    activated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TABLE: sync_logs
-- =====================================================
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    confirmation_code VARCHAR(100) NOT NULL,
    reference_number  VARCHAR(100) NOT NULL,

    target_service VARCHAR(100) NOT NULL,

    request_payload  JSONB NOT NULL,
    response_payload JSONB,

    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    error_message TEXT,

    attempt_count INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_esim_order_item
ON esim_details (order_item_id);

CREATE INDEX idx_esim_status
ON esim_details (status);

CREATE UNIQUE INDEX uq_sync_logs_success
ON sync_logs (confirmation_code, target_service)
WHERE status = 'SUCCESS';

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sync_logs_updated_at
BEFORE UPDATE ON sync_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_esim_updated_at
BEFORE UPDATE ON esim_details
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

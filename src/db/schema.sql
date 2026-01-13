untuk db kan saya sudah menjelaskan bahwa db saya seperti ini nama db "globaltix"


untuk db kan saya sudah menjelaskan bahwa db saya seperti ini nama db "globaltix"


* Tabel orders
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


*Tabel order_items dengan unique confirmation_code
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    confirmation_code VARCHAR(100) NOT NULL UNIQUE, -- unik untuk mencegah duplikasi

    product_name VARCHAR(255) NOT NULL,
    product_variant VARCHAR(255),
    sku VARCHAR(100) NOT NULL,

    visit_date DATE,

    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2),

    created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE UNIQUE INDEX uq_sync_logs_success
ON sync_logs (confirmation_code, target_service)
WHERE status = 'SUCCESS';


-- =====================================================================
-- REMQUIP — Sales Offers (Quotes) & Order Documents Migration
-- Run this SQL on the production database.
-- =====================================================================

-- 1. Offers table
CREATE TABLE IF NOT EXISTS remquip_offers (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    offer_number    VARCHAR(50) NOT NULL UNIQUE,
    customer_id     VARCHAR(64) DEFAULT NULL,
    status          ENUM('draft','sent','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft',
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    shipping        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    valid_until     DATE DEFAULT NULL,
    notes           TEXT DEFAULT NULL,
    created_by      VARCHAR(64) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME DEFAULT NULL,
    INDEX idx_offers_customer (customer_id),
    INDEX idx_offers_status   (status),
    INDEX idx_offers_number   (offer_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Offer line items
CREATE TABLE IF NOT EXISTS remquip_offer_items (
    id          VARCHAR(64) NOT NULL PRIMARY KEY,
    offer_id    VARCHAR(64) NOT NULL,
    product_id  VARCHAR(64) DEFAULT NULL,
    product_name VARCHAR(255) DEFAULT NULL,
    sku         VARCHAR(100) DEFAULT NULL,
    quantity    INT NOT NULL DEFAULT 1,
    unit_price  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes       TEXT DEFAULT NULL,
    INDEX idx_offer_items_offer (offer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Offer documents
CREATE TABLE IF NOT EXISTS remquip_offer_documents (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    offer_id        VARCHAR(64) NOT NULL,
    file_url        VARCHAR(512) NOT NULL,
    file_name       VARCHAR(255) DEFAULT NULL,
    document_type   VARCHAR(100) DEFAULT 'attachment',
    uploaded_by     VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_offer_docs_offer (offer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Order documents (mirrors offer docs)
CREATE TABLE IF NOT EXISTS remquip_order_documents (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    order_id        VARCHAR(64) NOT NULL,
    file_url        VARCHAR(512) NOT NULL,
    file_name       VARCHAR(255) DEFAULT NULL,
    document_type   VARCHAR(100) DEFAULT 'attachment',
    uploaded_by     VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_docs_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Link orders back to the offer they were created from
ALTER TABLE remquip_orders ADD COLUMN IF NOT EXISTS offer_id VARCHAR(64) DEFAULT NULL AFTER notes;

-- 6. Extend customers table with full application fields (safe IF NOT EXISTS)
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS neq_tva VARCHAR(100) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS contact_title VARCHAR(100) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS distributor_type VARCHAR(255) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS num_trucks INT DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS num_trailers INT DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_address TEXT DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS accounting_contact VARCHAR(255) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS accounting_phone VARCHAR(50) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS sales_representative VARCHAR(255) DEFAULT NULL;

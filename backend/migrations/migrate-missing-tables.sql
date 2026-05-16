-- =====================================================================
-- REMQUIP — Missing tables & columns migration
-- Covers tables/columns referenced in PHP routes but not yet created.
-- Run once; all statements are idempotent (IF NOT EXISTS).
-- =====================================================================

-- ─── 1. tax_breakdown column on remquip_offers ───
ALTER TABLE remquip_offers
  ADD COLUMN IF NOT EXISTS tax_breakdown JSON DEFAULT NULL AFTER tax;

-- ─── 2. tax_breakdown column on remquip_orders ───
ALTER TABLE remquip_orders
  ADD COLUMN IF NOT EXISTS tax_breakdown JSON DEFAULT NULL AFTER tax;

-- ─── 3. Order notes ───
CREATE TABLE IF NOT EXISTS remquip_order_notes (
    id          VARCHAR(64) NOT NULL PRIMARY KEY,
    order_id    VARCHAR(64) NOT NULL,
    `user`      VARCHAR(255) DEFAULT NULL,
    `text`      TEXT NOT NULL,
    `date`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_notes_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4. Invoices ───
CREATE TABLE IF NOT EXISTS remquip_invoices (
    id                VARCHAR(64) NOT NULL PRIMARY KEY,
    invoice_number    VARCHAR(50) NOT NULL UNIQUE,
    customer_id       VARCHAR(64) DEFAULT NULL,
    order_id          VARCHAR(64) DEFAULT NULL,
    offer_id          VARCHAR(64) DEFAULT NULL,
    status            ENUM('draft','sent','paid','partially_paid','overdue','cancelled','refunded') NOT NULL DEFAULT 'draft',
    payment_status    ENUM('unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unpaid',
    issue_date        DATE DEFAULT NULL,
    due_date          DATE DEFAULT NULL,
    paid_date         DATE DEFAULT NULL,
    subtotal          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_breakdown     JSON DEFAULT NULL,
    shipping          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_paid       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance_due       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_method    VARCHAR(100) DEFAULT NULL,
    payment_reference VARCHAR(255) DEFAULT NULL,
    notes             TEXT DEFAULT NULL,
    internal_notes    TEXT DEFAULT NULL,
    created_by        VARCHAR(64) DEFAULT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at        DATETIME DEFAULT NULL,
    INDEX idx_invoices_customer (customer_id),
    INDEX idx_invoices_status   (status),
    INDEX idx_invoices_number   (invoice_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 5. Invoice line items ───
CREATE TABLE IF NOT EXISTS remquip_invoice_items (
    id            VARCHAR(64) NOT NULL PRIMARY KEY,
    invoice_id    VARCHAR(64) NOT NULL,
    product_id    VARCHAR(64) DEFAULT NULL,
    product_name  VARCHAR(255) DEFAULT NULL,
    sku           VARCHAR(100) DEFAULT NULL,
    description   TEXT DEFAULT NULL,
    quantity      INT NOT NULL DEFAULT 1,
    unit_price    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes         TEXT DEFAULT NULL,
    INDEX idx_invoice_items_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 6. Invoice payments ───
CREATE TABLE IF NOT EXISTS remquip_invoice_payments (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    invoice_id      VARCHAR(64) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_method  VARCHAR(100) DEFAULT NULL,
    reference       VARCHAR(255) DEFAULT NULL,
    notes           TEXT DEFAULT NULL,
    paid_at         DATETIME DEFAULT NULL,
    created_by      VARCHAR(64) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inv_payments_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 7. Customer notes ───
CREATE TABLE IF NOT EXISTS remquip_customer_notes (
    id            VARCHAR(64) NOT NULL PRIMARY KEY,
    customer_id   VARCHAR(64) NOT NULL,
    user_id       VARCHAR(64) DEFAULT NULL,
    note          TEXT NOT NULL,
    is_internal   TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_notes_cid (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 8. Customer documents ───
CREATE TABLE IF NOT EXISTS remquip_customer_documents (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    customer_id     VARCHAR(64) NOT NULL,
    file_url        VARCHAR(512) NOT NULL,
    file_name       VARCHAR(255) DEFAULT NULL,
    document_type   VARCHAR(100) DEFAULT 'attachment',
    uploaded_by     VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_docs_cid (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 9. CRM tasks (follow-ups) ───
CREATE TABLE IF NOT EXISTS remquip_crm_tasks (
    id            VARCHAR(64) NOT NULL PRIMARY KEY,
    customer_id   VARCHAR(64) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    due_at        DATETIME DEFAULT NULL,
    status        ENUM('open','done','cancelled') NOT NULL DEFAULT 'open',
    assigned_to   VARCHAR(64) DEFAULT NULL,
    created_by    VARCHAR(64) DEFAULT NULL,
    notes         TEXT DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_crm_tasks_customer (customer_id),
    INDEX idx_crm_tasks_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 10. Analytics events ───
CREATE TABLE IF NOT EXISTS remquip_analytics (
    id          VARCHAR(64) NOT NULL PRIMARY KEY,
    event_type  VARCHAR(100) NOT NULL,
    customer_id VARCHAR(64) DEFAULT NULL,
    user_id     VARCHAR(64) DEFAULT NULL,
    data        JSON DEFAULT NULL,
    ip_address  VARCHAR(45) DEFAULT NULL,
    user_agent  VARCHAR(512) DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analytics_type (event_type),
    INDEX idx_analytics_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 11. Audit logs ───
CREATE TABLE IF NOT EXISTS remquip_audit_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(64) DEFAULT NULL,
    entity_type VARCHAR(100) DEFAULT NULL,
    entity_id   VARCHAR(64) DEFAULT NULL,
    action      VARCHAR(100) DEFAULT NULL,
    details     JSON DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 12. Tax rates ───
CREATE TABLE IF NOT EXISTS remquip_tax_rates (
    id            VARCHAR(64) NOT NULL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    label_en      VARCHAR(100) DEFAULT NULL,
    label_fr      VARCHAR(100) DEFAULT NULL,
    label_es      VARCHAR(100) DEFAULT NULL,
    rate          DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    is_compound   TINYINT(1) NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME DEFAULT NULL,
    INDEX idx_tax_rates_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 13. Category translations ───
CREATE TABLE IF NOT EXISTS remquip_category_translations (
    id            VARCHAR(64) NOT NULL PRIMARY KEY,
    category_id   VARCHAR(64) NOT NULL,
    locale        VARCHAR(5) NOT NULL DEFAULT 'en',
    name          VARCHAR(255) NOT NULL,
    description   TEXT DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cat_locale (category_id, locale),
    INDEX idx_cat_trans_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 14. Settings ───
CREATE TABLE IF NOT EXISTS remquip_settings (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    setting_key     VARCHAR(64) NOT NULL UNIQUE,
    setting_value   TEXT DEFAULT NULL,
    data_type       VARCHAR(20) NOT NULL DEFAULT 'string',
    description     VARCHAR(500) DEFAULT NULL,
    is_public       TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 15. Pages + user_page_access (admin permissions) ───
CREATE TABLE IF NOT EXISTS remquip_pages (
    id            VARCHAR(64) NOT NULL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    slug          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    is_public     TINYINT(1) NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS remquip_user_page_access (
    id          VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL,
    page_id     VARCHAR(64) NOT NULL,
    can_view    TINYINT(1) NOT NULL DEFAULT 0,
    can_edit    TINYINT(1) NOT NULL DEFAULT 0,
    can_delete  TINYINT(1) NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_page (user_id, page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 16. Admin contacts ───
CREATE TABLE IF NOT EXISTS remquip_admin_contacts (
    id              VARCHAR(64) NOT NULL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) DEFAULT NULL,
    phone           VARCHAR(50) DEFAULT NULL,
    department      VARCHAR(100) DEFAULT NULL,
    specialization  VARCHAR(255) DEFAULT NULL,
    is_available    TINYINT(1) NOT NULL DEFAULT 1,
    display_order   INT NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- QUICKBOOKS MIRROR TABLES + qbo_id columns on local entities
-- =====================================================================
-- Mirrors of QBO data are read-only inside Remquip. They power the
-- "financial overview per customer" UI without ever hitting QBO at
-- request time. Refreshed via webhooks + nightly reconciliation.
-- =====================================================================

-- 1) Mirror: Invoices ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `remquip_qbo_invoices` (
    `id`                    CHAR(36)        NOT NULL DEFAULT (UUID()),
    `qbo_id`                VARCHAR(50)     NOT NULL COMMENT 'QBO Invoice.Id',
    `qbo_doc_number`        VARCHAR(60)     NULL,
    `qbo_customer_id`       VARCHAR(50)     NULL COMMENT 'QBO Customer.Id (CustomerRef.value)',
    `local_customer_id`     CHAR(36)        NULL COMMENT 'Resolved remquip_customers.id (via mappings)',
    `txn_date`              DATE            NULL,
    `due_date`              DATE            NULL,
    `currency`              VARCHAR(3)      NULL,
    `total_amt`             DECIMAL(14,2)   NULL,
    `balance`               DECIMAL(14,2)   NULL,
    `status`                VARCHAR(30)     NULL COMMENT 'Paid | PartiallyPaid | Pending | Overdue',
    `email_status`          VARCHAR(30)     NULL,
    `private_note`          TEXT            NULL,
    `customer_memo`         TEXT            NULL,
    `raw`                   LONGTEXT        NULL COMMENT 'Full JSON snapshot from QBO',
    `qbo_updated_at`        DATETIME        NULL COMMENT 'MetaData.LastUpdatedTime',
    `synced_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_invoice` (`qbo_id`),
    KEY `idx_local_customer` (`local_customer_id`),
    KEY `idx_qbo_customer`   (`qbo_customer_id`),
    KEY `idx_txn_date`       (`txn_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Mirror: Estimates / Quotes ----------------------------------------
CREATE TABLE IF NOT EXISTS `remquip_qbo_estimates` (
    `id`                    CHAR(36)        NOT NULL DEFAULT (UUID()),
    `qbo_id`                VARCHAR(50)     NOT NULL COMMENT 'QBO Estimate.Id',
    `qbo_doc_number`        VARCHAR(60)     NULL,
    `qbo_customer_id`       VARCHAR(50)     NULL,
    `local_customer_id`     CHAR(36)        NULL,
    `txn_date`              DATE            NULL,
    `expiration_date`       DATE            NULL,
    `currency`              VARCHAR(3)      NULL,
    `total_amt`             DECIMAL(14,2)   NULL,
    `status`                VARCHAR(30)     NULL COMMENT 'Pending | Accepted | Closed | Rejected',
    `accepted_date`         DATE            NULL,
    `customer_memo`         TEXT            NULL,
    `raw`                   LONGTEXT        NULL,
    `qbo_updated_at`        DATETIME        NULL,
    `synced_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_estimate` (`qbo_id`),
    KEY `idx_local_customer` (`local_customer_id`),
    KEY `idx_qbo_customer`   (`qbo_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Mirror: Payments --------------------------------------------------
CREATE TABLE IF NOT EXISTS `remquip_qbo_payments` (
    `id`                    CHAR(36)        NOT NULL DEFAULT (UUID()),
    `qbo_id`                VARCHAR(50)     NOT NULL,
    `qbo_customer_id`       VARCHAR(50)     NULL,
    `local_customer_id`     CHAR(36)        NULL,
    `txn_date`              DATE            NULL,
    `currency`              VARCHAR(3)      NULL,
    `total_amt`             DECIMAL(14,2)   NULL,
    `unapplied_amt`         DECIMAL(14,2)   NULL,
    `payment_method`        VARCHAR(60)     NULL,
    `payment_ref_num`       VARCHAR(80)     NULL,
    `linked_invoice_ids`    LONGTEXT        NULL COMMENT 'JSON array of QBO Invoice.Id this payment applies to',
    `raw`                   LONGTEXT        NULL,
    `qbo_updated_at`        DATETIME        NULL,
    `synced_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_payment` (`qbo_id`),
    KEY `idx_local_customer` (`local_customer_id`),
    KEY `idx_qbo_customer`   (`qbo_customer_id`),
    KEY `idx_txn_date`       (`txn_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Cached chart of accounts (so the admin can pick Income/Expense/Asset
--    accounts when configuring inventory item defaults).
CREATE TABLE IF NOT EXISTS `remquip_qbo_accounts` (
    `id`                    CHAR(36)        NOT NULL DEFAULT (UUID()),
    `qbo_id`                VARCHAR(50)     NOT NULL,
    `name`                  VARCHAR(200)    NOT NULL,
    `account_type`          VARCHAR(80)     NULL COMMENT 'Income | Expense | Other Current Asset | ...',
    `account_sub_type`      VARCHAR(120)    NULL,
    `classification`        VARCHAR(40)     NULL COMMENT 'Asset | Liability | Equity | Revenue | Expense',
    `currency`              VARCHAR(3)      NULL,
    `active`                TINYINT(1)      NOT NULL DEFAULT 1,
    `synced_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_account` (`qbo_id`),
    KEY `idx_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Convenience qbo_id columns directly on local entities.
--    Authoritative mapping still lives in remquip_integration_mappings;
--    these are denormalised for fast joins on the customer detail page.
ALTER TABLE `remquip_customers`
    ADD COLUMN IF NOT EXISTS `qbo_id` VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS `qbo_synced_at` DATETIME NULL,
    ADD INDEX IF NOT EXISTS `idx_qbo_id` (`qbo_id`);

ALTER TABLE `remquip_products`
    ADD COLUMN IF NOT EXISTS `qbo_id` VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS `qbo_synced_at` DATETIME NULL,
    ADD INDEX IF NOT EXISTS `idx_qbo_id` (`qbo_id`);

-- =====================================================================
--  QUICKBOOKS ONLINE — COMPLETE INTEGRATION SCHEMA (idempotent)
-- =====================================================================
--  Run once on a fresh DB or on top of an existing Remquip install.
--  Every statement uses IF NOT EXISTS / IF EXISTS so it is safe to
--  re-run as many times as you like.
--
--  Usage:
--    mysql -u USER -p DBNAME < backend/migrations/quickbooks-complete.sql
--
--  Covers EVERYTHING the QuickBooks integration + the
--  application→customer conversion flow need to work 100%:
--    1. Customers: leads/customers split + qbo_id columns
--    2. Products:  qbo_id columns
--    3. Account-applications: ensure pdf_url + approved_customer_id exist
--    4. Users: account_origin ('register' | 'application')
--    5. Integration plumbing: providers, mappings, audit logs, webhooks
--    6. QBO mirror tables: invoices, estimates, payments, accounts
--    7. Seed row for the 'quickbooks' provider (sandbox)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. CUSTOMERS — leads vs customers + denormalised qbo_id
-- =====================================================================
ALTER TABLE `remquip_customers`
    ADD COLUMN IF NOT EXISTS `category` ENUM('lead','customer','contract') NOT NULL DEFAULT 'lead',
    ADD COLUMN IF NOT EXISTS `qbo_id`        VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS `qbo_synced_at` DATETIME    NULL,
    ADD INDEX  IF NOT EXISTS `idx_category` (`category`),
    ADD INDEX  IF NOT EXISTS `idx_qbo_id`   (`qbo_id`);

-- contact_person is now nullable (a customer can be just a company name)
ALTER TABLE `remquip_customers`
    MODIFY COLUMN `contact_person` VARCHAR(255) NULL;

-- Make sure customer_type covers Retail too
ALTER TABLE `remquip_customers`
    MODIFY COLUMN `customer_type` ENUM('Fleet','Wholesale','Distributor','Retail')
        NOT NULL DEFAULT 'Wholesale';

-- =====================================================================
-- 2. PRODUCTS — denormalised qbo_id for fast joins
-- =====================================================================
ALTER TABLE `remquip_products`
    ADD COLUMN IF NOT EXISTS `qbo_id`        VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS `qbo_synced_at` DATETIME    NULL,
    ADD INDEX  IF NOT EXISTS `idx_qbo_id`    (`qbo_id`);

-- =====================================================================
-- 3. ACCOUNT APPLICATIONS — ensure approval-flow columns exist
--    (Safe even if migrate-account-applications.sql / migrate-signature-pdf.sql
--    were already applied.)
-- =====================================================================
ALTER TABLE `remquip_account_applications`
    ADD COLUMN IF NOT EXISTS `signature_url`        VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS `pdf_url`              VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS `rejection_reason`     TEXT         NULL,
    ADD COLUMN IF NOT EXISTS `approved_customer_id` CHAR(36)     NULL,
    ADD INDEX  IF NOT EXISTS `idx_approved_customer` (`approved_customer_id`);

-- =====================================================================
-- 4. USERS — account_origin tag (register vs application approval)
-- =====================================================================
ALTER TABLE `remquip_users`
    ADD COLUMN IF NOT EXISTS `account_origin` ENUM('register','application')
        NOT NULL DEFAULT 'register';

-- =====================================================================
-- 5. INTEGRATION CORE TABLES
-- =====================================================================

-- 5a. Providers (one row per integration: quickbooks, amazon, ebay, ...)
CREATE TABLE IF NOT EXISTS `remquip_integrations` (
    `id`                  CHAR(36)     NOT NULL DEFAULT (UUID()),
    `provider`            VARCHAR(40)  NOT NULL COMMENT 'quickbooks | amazon | ebay',
    `display_name`        VARCHAR(120) NOT NULL,
    `environment`         ENUM('sandbox','production') NOT NULL DEFAULT 'sandbox',
    `status`              ENUM('disconnected','connecting','connected','error')
                          NOT NULL DEFAULT 'disconnected',
    `is_enabled`          TINYINT(1)   NOT NULL DEFAULT 0,
    `credentials`         LONGTEXT     NULL COMMENT 'JSON: client_id, client_secret, access_token, refresh_token, realm_id, webhook_verifier_token',
    `config`              LONGTEXT     NULL COMMENT 'JSON: per-provider config (e.g. qbo_income_account_id)',
    `token_expires_at`    DATETIME     NULL,
    `last_sync_at`        DATETIME     NULL,
    `last_error`          TEXT         NULL,
    `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5b. local_id ↔ external_id mappings (the source of truth)
CREATE TABLE IF NOT EXISTS `remquip_integration_mappings` (
    `id`             CHAR(36)    NOT NULL DEFAULT (UUID()),
    `provider`       VARCHAR(40) NOT NULL,
    `entity_type`    VARCHAR(40) NOT NULL COMMENT 'customer | product | invoice | estimate | payment | account',
    `local_id`       VARCHAR(64) NOT NULL,
    `external_id`    VARCHAR(64) NOT NULL,
    `external_data`  LONGTEXT    NULL COMMENT 'Last-seen JSON snapshot from external system',
    `created_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_local`    (`provider`, `entity_type`, `local_id`),
    UNIQUE KEY `uniq_external` (`provider`, `entity_type`, `external_id`),
    KEY `idx_external` (`provider`, `entity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5c. Sync audit log (every push/pull/webhook leaves a row here)
CREATE TABLE IF NOT EXISTS `remquip_integration_logs` (
    `id`              CHAR(36)    NOT NULL DEFAULT (UUID()),
    `provider`        VARCHAR(40) NOT NULL,
    `event`           VARCHAR(80) NOT NULL COMMENT 'oauth.connect | sync.customers | webhook.customer.update | ...',
    `direction`       ENUM('inbound','outbound','internal') NOT NULL DEFAULT 'internal',
    `status`          ENUM('success','warning','error')      NOT NULL DEFAULT 'success',
    `payload`         LONGTEXT    NULL,
    `response`        LONGTEXT    NULL,
    `duration_ms`     INT         NULL,
    `created_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_provider_event` (`provider`, `event`),
    KEY `idx_created`        (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5d. Inbound webhook events (for replay / debugging)
CREATE TABLE IF NOT EXISTS `remquip_integration_webhooks` (
    `id`              CHAR(36)    NOT NULL DEFAULT (UUID()),
    `provider`        VARCHAR(40) NOT NULL,
    `event_type`      VARCHAR(80) NULL,
    `external_id`     VARCHAR(64) NULL,
    `signature`       VARCHAR(255) NULL,
    `signature_valid` TINYINT(1)  NOT NULL DEFAULT 0,
    `payload`         LONGTEXT    NULL,
    `processed`       TINYINT(1)  NOT NULL DEFAULT 0,
    `processing_error` TEXT       NULL,
    `received_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_provider_received` (`provider`, `received_at`),
    KEY `idx_external` (`external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6. QUICKBOOKS MIRROR TABLES (read-only inside Remquip)
-- =====================================================================

-- 6a. Invoices
CREATE TABLE IF NOT EXISTS `remquip_qbo_invoices` (
    `id`                  CHAR(36)      NOT NULL DEFAULT (UUID()),
    `qbo_id`              VARCHAR(50)   NOT NULL COMMENT 'QBO Invoice.Id',
    `qbo_doc_number`      VARCHAR(60)   NULL,
    `qbo_customer_id`     VARCHAR(50)   NULL COMMENT 'QBO Customer.Id (CustomerRef.value)',
    `local_customer_id`   CHAR(36)      NULL COMMENT 'Resolved remquip_customers.id',
    `txn_date`            DATE          NULL,
    `due_date`            DATE          NULL,
    `currency`            VARCHAR(3)    NULL,
    `total_amt`           DECIMAL(14,2) NULL,
    `balance`             DECIMAL(14,2) NULL,
    `status`              VARCHAR(30)   NULL COMMENT 'Paid | PartiallyPaid | Pending | Overdue',
    `email_status`        VARCHAR(30)   NULL,
    `private_note`        TEXT          NULL,
    `customer_memo`       TEXT          NULL,
    `raw`                 LONGTEXT      NULL COMMENT 'Full JSON snapshot from QBO',
    `qbo_updated_at`      DATETIME      NULL COMMENT 'MetaData.LastUpdatedTime',
    `synced_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_invoice`  (`qbo_id`),
    KEY `idx_local_customer`       (`local_customer_id`),
    KEY `idx_qbo_customer`         (`qbo_customer_id`),
    KEY `idx_txn_date`             (`txn_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6b. Estimates / Quotes
CREATE TABLE IF NOT EXISTS `remquip_qbo_estimates` (
    `id`                  CHAR(36)      NOT NULL DEFAULT (UUID()),
    `qbo_id`              VARCHAR(50)   NOT NULL COMMENT 'QBO Estimate.Id',
    `qbo_doc_number`      VARCHAR(60)   NULL,
    `qbo_customer_id`     VARCHAR(50)   NULL,
    `local_customer_id`   CHAR(36)      NULL,
    `txn_date`            DATE          NULL,
    `expiration_date`     DATE          NULL,
    `currency`            VARCHAR(3)    NULL,
    `total_amt`           DECIMAL(14,2) NULL,
    `status`              VARCHAR(30)   NULL COMMENT 'Pending | Accepted | Closed | Rejected',
    `accepted_date`       DATE          NULL,
    `customer_memo`       TEXT          NULL,
    `raw`                 LONGTEXT      NULL,
    `qbo_updated_at`      DATETIME      NULL,
    `synced_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_estimate` (`qbo_id`),
    KEY `idx_local_customer`       (`local_customer_id`),
    KEY `idx_qbo_customer`         (`qbo_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6c. Payments
CREATE TABLE IF NOT EXISTS `remquip_qbo_payments` (
    `id`                  CHAR(36)      NOT NULL DEFAULT (UUID()),
    `qbo_id`              VARCHAR(50)   NOT NULL,
    `qbo_customer_id`     VARCHAR(50)   NULL,
    `local_customer_id`   CHAR(36)      NULL,
    `txn_date`            DATE          NULL,
    `currency`            VARCHAR(3)    NULL,
    `total_amt`           DECIMAL(14,2) NULL,
    `unapplied_amt`       DECIMAL(14,2) NULL,
    `payment_method`      VARCHAR(60)   NULL,
    `payment_ref_num`     VARCHAR(80)   NULL,
    `linked_invoice_ids`  LONGTEXT      NULL COMMENT 'JSON array of QBO Invoice.Id this payment applies to',
    `raw`                 LONGTEXT      NULL,
    `qbo_updated_at`      DATETIME      NULL,
    `synced_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_payment`  (`qbo_id`),
    KEY `idx_local_customer`       (`local_customer_id`),
    KEY `idx_qbo_customer`         (`qbo_customer_id`),
    KEY `idx_txn_date`             (`txn_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6d. Cached chart of accounts (for inventory item creation)
CREATE TABLE IF NOT EXISTS `remquip_qbo_accounts` (
    `id`                  CHAR(36)      NOT NULL DEFAULT (UUID()),
    `qbo_id`              VARCHAR(50)   NOT NULL,
    `name`                VARCHAR(200)  NOT NULL,
    `account_type`        VARCHAR(80)   NULL COMMENT 'Income | Expense | Other Current Asset | ...',
    `account_sub_type`    VARCHAR(120)  NULL,
    `classification`      VARCHAR(40)   NULL COMMENT 'Asset | Liability | Equity | Revenue | Expense',
    `currency`            VARCHAR(3)    NULL,
    `active`              TINYINT(1)    NOT NULL DEFAULT 1,
    `synced_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_qbo_account` (`qbo_id`),
    KEY `idx_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 7. SEED — register the QuickBooks provider row (idempotent)
-- =====================================================================
INSERT INTO `remquip_integrations`
    (`id`, `provider`, `display_name`, `environment`, `status`, `is_enabled`)
VALUES
    (UUID(), 'quickbooks', 'QuickBooks Online', 'sandbox', 'disconnected', 1)
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`);

-- =====================================================================
SET FOREIGN_KEY_CHECKS = 1;
-- DONE. Next steps:
--   1. Upload the backend files listed in QUICKBOOKS_SETUP_GUIDE.md
--   2. Open /admin/integrations → QuickBooks → Connect
--   3. Open /admin/integrations/sync → Run Sync Now
-- =====================================================================

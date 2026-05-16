-- =====================================================================
-- INTEGRATIONS MODULE — QuickBooks, Amazon SP-API, eBay
-- =====================================================================
-- Creates tables to hold per-provider credentials, connection state,
-- sync history, and field mappings. Designed so the admin UI can be
-- built and tested today, and real API keys / OAuth tokens dropped in
-- later without further schema changes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `remquip_integrations` (
    `id`                CHAR(36)        NOT NULL DEFAULT (UUID()),
    `provider`          VARCHAR(40)     NOT NULL COMMENT 'quickbooks | amazon | ebay',
    `display_name`      VARCHAR(120)    NOT NULL,
    `environment`       VARCHAR(20)     NOT NULL DEFAULT 'sandbox' COMMENT 'sandbox | production',
    `status`            VARCHAR(20)     NOT NULL DEFAULT 'disconnected' COMMENT 'disconnected | pending | connected | error',
    `is_enabled`        TINYINT(1)      NOT NULL DEFAULT 0,

    -- Credentials (stored as JSON; for OAuth providers includes access_token, refresh_token, expires_at)
    `credentials`       LONGTEXT        NULL COMMENT 'JSON blob: client_id, client_secret, access_token, refresh_token, realm_id, marketplace_id, ...',
    `config`            LONGTEXT        NULL COMMENT 'JSON blob: per-provider toggles (sync_products, sync_orders, sync_inventory, ...)',

    -- Connection lifecycle
    `connected_at`      DATETIME        NULL,
    `last_sync_at`      DATETIME        NULL,
    `last_error`        TEXT            NULL,
    `token_expires_at`  DATETIME        NULL,

    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_provider` (`provider`),
    KEY `idx_status` (`status`),
    KEY `idx_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sync logs / history per integration
CREATE TABLE IF NOT EXISTS `remquip_integration_logs` (
    `id`                CHAR(36)        NOT NULL DEFAULT (UUID()),
    `integration_id`    CHAR(36)        NOT NULL,
    `provider`          VARCHAR(40)     NOT NULL,
    `action`            VARCHAR(60)     NOT NULL COMMENT 'connect | disconnect | test | sync_products | sync_orders | sync_inventory | webhook | error',
    `status`            VARCHAR(20)     NOT NULL DEFAULT 'success' COMMENT 'success | error | warning | info',
    `message`           TEXT            NULL,
    `payload`           LONGTEXT        NULL COMMENT 'JSON: request/response snapshot for debugging',
    `items_processed`   INT             NULL,
    `items_failed`      INT             NULL,
    `duration_ms`       INT             NULL,
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_integration` (`integration_id`),
    KEY `idx_provider`    (`provider`),
    KEY `idx_created`     (`created_at`),
    CONSTRAINT `fk_intlog_integration`
        FOREIGN KEY (`integration_id`) REFERENCES `remquip_integrations`(`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Field/SKU/account mappings between Remquip and external system
CREATE TABLE IF NOT EXISTS `remquip_integration_mappings` (
    `id`                CHAR(36)        NOT NULL DEFAULT (UUID()),
    `integration_id`    CHAR(36)        NOT NULL,
    `entity_type`       VARCHAR(40)     NOT NULL COMMENT 'product | customer | order | invoice | tax_code | account | category',
    `local_id`          VARCHAR(120)    NOT NULL COMMENT 'Remquip internal id/sku',
    `external_id`       VARCHAR(200)    NOT NULL COMMENT 'External system id/sku/listing-id',
    `metadata`          LONGTEXT        NULL COMMENT 'JSON snapshot of last sync',
    `last_synced_at`    DATETIME        NULL,
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_local_external` (`integration_id`, `entity_type`, `local_id`),
    KEY `idx_external` (`integration_id`, `entity_type`, `external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Seed the three providers as disconnected placeholders so the UI shows
-- them immediately, even before any keys are entered.
INSERT IGNORE INTO `remquip_integrations`
    (`id`, `provider`, `display_name`, `environment`, `status`, `is_enabled`, `config`)
VALUES
    (UUID(), 'quickbooks', 'QuickBooks Online', 'sandbox', 'disconnected', 0,
     JSON_OBJECT('sync_customers', false, 'sync_invoices', false, 'sync_payments', false, 'sync_products', false)),
    (UUID(), 'amazon',     'Amazon Seller Central (SP-API)', 'sandbox', 'disconnected', 0,
     JSON_OBJECT('sync_listings', false, 'sync_orders', false, 'sync_inventory', false, 'marketplace', 'ATVPDKIKX0DER')),
    (UUID(), 'ebay',       'eBay Marketplace', 'sandbox', 'disconnected', 0,
     JSON_OBJECT('sync_listings', false, 'sync_orders', false, 'sync_inventory', false));

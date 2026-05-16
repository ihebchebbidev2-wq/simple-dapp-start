-- Per-product per-customer price augmentation (idempotent)
-- NOTE: No FOREIGN KEY constraints — the referenced tables may use INT or VARCHAR PKs.
--       Application-level integrity is enforced in the PHP routes instead.
DROP TABLE IF EXISTS remquip_customer_product_prices;

CREATE TABLE remquip_customer_product_prices (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    augmentation_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_product (customer_id, product_id),
    INDEX idx_cpp_customer (customer_id),
    INDEX idx_cpp_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

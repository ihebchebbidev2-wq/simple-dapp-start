-- =====================================================================
-- REMQUIP – Multi-Phase / Installment Payments for Contract Customers
-- Migration: create remquip_order_installments + extend orders table
-- Run in phpMyAdmin
-- =====================================================================

-- 1. Payment installments table
CREATE TABLE IF NOT EXISTS remquip_order_installments (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  order_id          CHAR(36) NOT NULL,
  installment_number INT      NOT NULL DEFAULT 1,
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_date          DATE     NOT NULL,
  status            ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  paid_at           TIMESTAMP NULL DEFAULT NULL,
  payment_ref       VARCHAR(255) DEFAULT NULL,
  notes             TEXT     DEFAULT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_inst_order (order_id),
  INDEX idx_inst_status (status),
  INDEX idx_inst_due (due_date),

  CONSTRAINT fk_inst_order FOREIGN KEY (order_id)
    REFERENCES remquip_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add installment-related columns to orders
ALTER TABLE remquip_orders
  ADD COLUMN IF NOT EXISTS installment_count INT DEFAULT NULL AFTER payment_method,
  ADD COLUMN IF NOT EXISTS requires_contract TINYINT(1) NOT NULL DEFAULT 0 AFTER installment_count,
  ADD COLUMN IF NOT EXISTS contract_id CHAR(36) DEFAULT NULL AFTER requires_contract;

-- 3. Expand payment_method to accept 'installments'
--    (payment_method is VARCHAR so no ENUM change needed)

-- 4. Expand category ENUM on customers to include 'contract' (idempotent with add-contract-customer.sql)
ALTER TABLE remquip_customers
  MODIFY COLUMN category ENUM('lead','customer','contract') NOT NULL DEFAULT 'lead';

-- 5. Ensure contract_validated column exists
ALTER TABLE remquip_customers
  ADD COLUMN IF NOT EXISTS contract_validated TINYINT(1) NOT NULL DEFAULT 0;

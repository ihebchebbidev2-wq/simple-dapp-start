-- Add stock_deducted flag to orders for idempotent stock deduction
ALTER TABLE remquip_orders ADD COLUMN IF NOT EXISTS stock_deducted TINYINT(1) NOT NULL DEFAULT 0;

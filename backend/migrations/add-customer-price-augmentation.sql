-- Add per-customer price augmentation percentage (idempotent)
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS price_augmentation_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00;

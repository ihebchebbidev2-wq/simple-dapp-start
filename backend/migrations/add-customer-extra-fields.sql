-- Add missing columns to remquip_customers (idempotent)
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS supplier_ref_1 VARCHAR(255) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS supplier_ref_2 VARCHAR(255) DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS parts_needed TEXT DEFAULT NULL;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS special_requests TEXT DEFAULT NULL;

-- Add structured billing/shipping address columns to remquip_customers (idempotent)
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS address_2 VARCHAR(255) DEFAULT NULL AFTER address;

ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100) DEFAULT NULL AFTER billing_address;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_address_2 VARCHAR(255) DEFAULT NULL AFTER billing_address;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_province VARCHAR(100) DEFAULT NULL AFTER billing_city;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20) DEFAULT NULL AFTER billing_province;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100) DEFAULT NULL AFTER billing_postal_code;

ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100) DEFAULT NULL AFTER shipping_address;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS shipping_address_2 VARCHAR(255) DEFAULT NULL AFTER shipping_address;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS shipping_province VARCHAR(100) DEFAULT NULL AFTER shipping_city;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20) DEFAULT NULL AFTER shipping_province;
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100) DEFAULT NULL AFTER shipping_postal_code;

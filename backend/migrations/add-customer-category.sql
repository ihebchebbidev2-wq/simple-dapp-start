-- Add category column + expand customer_type ENUM (idempotent)
ALTER TABLE remquip_customers ADD COLUMN IF NOT EXISTS category ENUM('lead', 'customer') NOT NULL DEFAULT 'lead';

-- Also ensure customer_type includes 'Retail'
ALTER TABLE remquip_customers MODIFY COLUMN customer_type ENUM('Fleet','Wholesale','Distributor','Retail') NOT NULL DEFAULT 'Wholesale';

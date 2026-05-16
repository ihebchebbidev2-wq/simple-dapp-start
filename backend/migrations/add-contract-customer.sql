-- Add account_origin to users (register vs application)
ALTER TABLE remquip_users
  ADD COLUMN IF NOT EXISTS account_origin ENUM('register','application') NOT NULL DEFAULT 'register';

-- Expand customer category to include 'contract'
ALTER TABLE remquip_customers
  MODIFY COLUMN category ENUM('lead','customer','contract') NOT NULL DEFAULT 'lead';

-- Add contract_validated flag
ALTER TABLE remquip_customers
  ADD COLUMN IF NOT EXISTS contract_validated TINYINT(1) NOT NULL DEFAULT 0;

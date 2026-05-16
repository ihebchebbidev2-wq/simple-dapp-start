-- Allow customers to have no email.
-- MySQL UNIQUE indexes already allow multiple NULLs, so once this column
-- is nullable + we store NULL (instead of '') the duplicate '' error stops.
--
-- 1) Convert any existing empty-string emails to NULL so the alter succeeds.
UPDATE remquip_customers
SET email = NULL
WHERE email = '' OR email IS NULL;

-- 2) Make the column nullable (it may already be — IF EXISTS-safe statement).
ALTER TABLE remquip_customers
  MODIFY COLUMN email VARCHAR(255) NULL DEFAULT NULL;

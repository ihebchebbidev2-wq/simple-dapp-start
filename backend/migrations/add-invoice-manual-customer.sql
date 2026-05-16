-- Allow invoices without a linked customer by adding manual customer detail columns
ALTER TABLE remquip_invoices
  MODIFY COLUMN customer_id VARCHAR(36) NULL DEFAULT NULL,
  ADD COLUMN customer_name VARCHAR(255) NULL DEFAULT NULL AFTER customer_id,
  ADD COLUMN customer_email VARCHAR(255) NULL DEFAULT NULL AFTER customer_name,
  ADD COLUMN customer_phone VARCHAR(50) NULL DEFAULT NULL AFTER customer_email;

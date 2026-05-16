-- Add website field to customers table
-- Run this once on production. Safe to re-run (uses IF NOT EXISTS where supported).

ALTER TABLE remquip_customers
  ADD COLUMN website VARCHAR(255) NULL DEFAULT NULL AFTER fax;

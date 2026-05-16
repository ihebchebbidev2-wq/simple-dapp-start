-- =====================================================================
-- REMQUIP – Application PDF & Signature Image Integration
-- Migration: add signature_url and pdf_url to remquip_account_applications
-- =====================================================================

ALTER TABLE remquip_account_applications
  ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500) DEFAULT NULL AFTER signature_data,
  ADD COLUMN IF NOT EXISTS pdf_url       VARCHAR(500) DEFAULT NULL AFTER signature_url;

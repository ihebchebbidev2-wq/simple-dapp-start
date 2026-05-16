-- =====================================================================
-- REMQUIP – Customer Account Application Form
-- Migration: create remquip_account_applications + extend remquip_customers
-- =====================================================================

-- 1. New table for pending applications
CREATE TABLE IF NOT EXISTS remquip_account_applications (
  id                    CHAR(36) NOT NULL PRIMARY KEY,
  status                ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',

  -- Section 1: Company Information
  company_name          VARCHAR(255) NOT NULL,
  neq_tva               VARCHAR(100) DEFAULT NULL,
  contact_person        VARCHAR(255) NOT NULL,
  contact_title         VARCHAR(150) DEFAULT NULL,
  phone                 VARCHAR(50)  DEFAULT NULL,
  email                 VARCHAR(255) NOT NULL,
  distributor_type      JSON         DEFAULT NULL,   -- ["reseller","logistics","garage","other"]
  distributor_type_other VARCHAR(255) DEFAULT NULL,
  num_trucks            INT          DEFAULT NULL,
  num_trailers          INT          DEFAULT NULL,

  -- Section 2: Addresses
  billing_address       TEXT         DEFAULT NULL,
  shipping_address      TEXT         DEFAULT NULL,

  -- Section 3: Accounting & Payment
  accounting_contact    VARCHAR(255) DEFAULT NULL,
  accounting_phone      VARCHAR(50)  DEFAULT NULL,
  billing_email         VARCHAR(255) DEFAULT NULL,
  payment_terms         VARCHAR(50)  DEFAULT NULL,   -- on_delivery | net_15 | net_30 | on_order
  payment_method        VARCHAR(50)  DEFAULT NULL,   -- transfer | cheque | credit_card | other

  -- Section 4: Credit References
  bank_reference        TEXT         DEFAULT NULL,
  credit_limit_requested DECIMAL(12,2) DEFAULT NULL,
  supplier_ref_1        TEXT         DEFAULT NULL,
  supplier_ref_2        TEXT         DEFAULT NULL,

  -- Section 5: Products & Needs
  parts_needed          TEXT         DEFAULT NULL,
  special_requests      TEXT         DEFAULT NULL,
  sales_representative  VARCHAR(255) DEFAULT NULL,

  -- Section 6: Validation / Signature
  signatory_name        VARCHAR(255) DEFAULT NULL,
  signatory_title       VARCHAR(150) DEFAULT NULL,
  signature_date        DATE         DEFAULT NULL,
  signature_data        MEDIUMTEXT   DEFAULT NULL,   -- base64 PNG of signature

  -- Admin workflow
  rejection_reason      TEXT         DEFAULT NULL,
  approved_customer_id  CHAR(36)     DEFAULT NULL,

  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_app_status (status),
  INDEX idx_app_email  (email),
  INDEX idx_app_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. Extend remquip_customers with fields from the form
--    All nullable, non-breaking – existing rows unaffected.

ALTER TABLE remquip_customers
  ADD COLUMN IF NOT EXISTS neq_tva               VARCHAR(100)  DEFAULT NULL AFTER tax_number,
  ADD COLUMN IF NOT EXISTS contact_title          VARCHAR(150)  DEFAULT NULL AFTER contact_person,
  ADD COLUMN IF NOT EXISTS distributor_type       JSON          DEFAULT NULL AFTER customer_type,
  ADD COLUMN IF NOT EXISTS num_trucks             INT           DEFAULT NULL AFTER distributor_type,
  ADD COLUMN IF NOT EXISTS num_trailers           INT           DEFAULT NULL AFTER num_trucks,
  ADD COLUMN IF NOT EXISTS shipping_address       TEXT          DEFAULT NULL AFTER country,
  ADD COLUMN IF NOT EXISTS accounting_contact     VARCHAR(255)  DEFAULT NULL AFTER shipping_address,
  ADD COLUMN IF NOT EXISTS accounting_phone       VARCHAR(50)   DEFAULT NULL AFTER accounting_contact,
  ADD COLUMN IF NOT EXISTS billing_email          VARCHAR(255)  DEFAULT NULL AFTER accounting_phone,
  ADD COLUMN IF NOT EXISTS payment_method         VARCHAR(50)   DEFAULT NULL AFTER payment_terms,
  ADD COLUMN IF NOT EXISTS bank_reference         TEXT          DEFAULT NULL AFTER payment_method,
  ADD COLUMN IF NOT EXISTS supplier_ref_1         TEXT          DEFAULT NULL AFTER bank_reference,
  ADD COLUMN IF NOT EXISTS supplier_ref_2         TEXT          DEFAULT NULL AFTER supplier_ref_1,
  ADD COLUMN IF NOT EXISTS parts_needed           TEXT          DEFAULT NULL AFTER supplier_ref_2,
  ADD COLUMN IF NOT EXISTS special_requests       TEXT          DEFAULT NULL AFTER parts_needed,
  ADD COLUMN IF NOT EXISTS sales_representative   VARCHAR(255)  DEFAULT NULL AFTER special_requests;

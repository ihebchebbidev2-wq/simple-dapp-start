-- ============================================================
-- Customer feedback batch — 2026-05
--   1. accountant_email on customers
--   2. customizable lead statuses
--   3. tasks module: standalone tasks + assignee + priority
-- All statements are idempotent (IF NOT EXISTS).
-- ============================================================

-- 1) Accountant email --------------------------------------------------
ALTER TABLE remquip_customers
  ADD COLUMN IF NOT EXISTS accountant_email VARCHAR(255) NULL AFTER email;

-- 2) Lead statuses -----------------------------------------------------
CREATE TABLE IF NOT EXISTS remquip_lead_statuses (
  id          CHAR(36) PRIMARY KEY,
  label       VARCHAR(80) NOT NULL,
  color       VARCHAR(20) NOT NULL DEFAULT '#64748b',
  sort_order  INT NOT NULL DEFAULT 0,
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lead_status_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE remquip_customers
  ADD COLUMN IF NOT EXISTS lead_status_id CHAR(36) NULL AFTER status,
  ADD INDEX IF NOT EXISTS idx_customers_lead_status (lead_status_id);

-- Seed default pipeline (only if empty)
INSERT IGNORE INTO remquip_lead_statuses (id, label, color, sort_order, is_default)
SELECT * FROM (
  SELECT UUID() AS id, 'New'           AS label, '#3b82f6' AS color, 1 AS sort_order, 1 AS is_default UNION ALL
  SELECT UUID(), 'Contacted',     '#0ea5e9', 2, 0 UNION ALL
  SELECT UUID(), 'Qualified',     '#8b5cf6', 3, 0 UNION ALL
  SELECT UUID(), 'Proposal Sent', '#f59e0b', 4, 0 UNION ALL
  SELECT UUID(), 'Won',           '#10b981', 5, 0 UNION ALL
  SELECT UUID(), 'Lost',          '#ef4444', 6, 0
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM remquip_lead_statuses LIMIT 1);

-- 3) Tasks: standalone + assignee + priority ---------------------------
-- Make customer_id optional (tasks not tied to a customer)
ALTER TABLE remquip_crm_tasks
  MODIFY COLUMN customer_id CHAR(36) NULL;

ALTER TABLE remquip_crm_tasks
  ADD COLUMN IF NOT EXISTS assigned_to CHAR(36) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS priority ENUM('low','normal','high') NOT NULL DEFAULT 'normal' AFTER assigned_to,
  ADD INDEX IF NOT EXISTS idx_crm_tasks_assigned (assigned_to),
  ADD INDEX IF NOT EXISTS idx_crm_tasks_due (due_at);

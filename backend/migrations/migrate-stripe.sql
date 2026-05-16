-- Stripe Payment Integration: add payment tracking columns to remquip_orders
-- Run this migration before deploying the Stripe integration.

ALTER TABLE remquip_orders
  ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255) DEFAULT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255) DEFAULT NULL AFTER stripe_session_id,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'stripe' AFTER stripe_payment_intent_id,
  ADD COLUMN IF NOT EXISTS paid_at DATETIME DEFAULT NULL AFTER payment_method;

-- Index for webhook lookups by session ID
ALTER TABLE remquip_orders
  ADD INDEX idx_stripe_session (stripe_session_id);

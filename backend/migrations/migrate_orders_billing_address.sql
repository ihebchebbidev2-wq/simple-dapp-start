-- Add billing_address column to remquip_orders
-- Referenced in routes/orders.php but migration was missing.
ALTER TABLE remquip_orders
  ADD COLUMN IF NOT EXISTS billing_address TEXT DEFAULT NULL;

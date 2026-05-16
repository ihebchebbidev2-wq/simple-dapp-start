-- Add admin_password column to remquip_users
-- This is a secondary plaintext password that admins can set to log into customer accounts
-- without modifying the customer's actual password.
ALTER TABLE remquip_users ADD COLUMN admin_password VARCHAR(255) DEFAULT NULL AFTER password_hash;

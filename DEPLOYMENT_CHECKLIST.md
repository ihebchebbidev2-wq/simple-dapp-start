# Deployment checklist — QuickBooks integration + Customers/Applications fixes

Everything needed for the QuickBooks bi-directional sync and the application→customer
conversion flow to work 100% in dev (sandbox) and prod.

---

## 1. Run the SQL (one file, idempotent)

```bash
mysql -u USER -p DBNAME < backend/migrations/quickbooks-complete.sql
```

This single file:
- Adds `category` (lead/customer/contract), `qbo_id`, `qbo_synced_at` to `remquip_customers`
- Makes `contact_person` **nullable** (company-only customers)
- Adds `qbo_id`, `qbo_synced_at` to `remquip_products`
- Ensures `pdf_url`, `signature_url`, `rejection_reason`, `approved_customer_id` on `remquip_account_applications`
- Adds `account_origin` on `remquip_users`
- Creates `remquip_integrations`, `remquip_integration_mappings`,
  `remquip_integration_logs`, `remquip_integration_webhooks`
- Creates QBO mirror tables: `remquip_qbo_invoices`, `remquip_qbo_estimates`,
  `remquip_qbo_payments`, `remquip_qbo_accounts`
- Seeds the `quickbooks` provider row (sandbox, enabled)

---

## 2. Backend files to upload (PHP)

Hardcoded sandbox keys live in `backend/config.php`, so you do NOT need any
environment variables for testing. Upload these files to the server:

### Core / config (must)
- `backend/config.php`           ← contains `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENVIRONMENT`, `QBO_REDIRECT_URI`
- `backend/router.php`           ← routes `/integrations/*`
- `backend/bootstrap.php`
- `backend/helpers.php`
- `backend/database.php`

### QuickBooks integration (must)
- `backend/integrations/QboClient.php`         ← OAuth + REST client (token refresh fallback to hardcoded keys)
- `backend/integrations/QboSyncService.php`    ← push/pull customers, products, invoices, estimates, payments, accounts
- `backend/routes/integrations.php`            ← `/integrations`, `/integrations/quickbooks/connect|callback|sync|disconnect|webhook`

### Customers & Applications (fixed in this session)
- `backend/routes/customers.php`               ← contact_person now optional; `convert-to-customer` endpoint
- `backend/routes/account-applications.php`    ← approval now creates `category='customer'` + accepts `overrides`

### Migration runner (optional convenience)
- `backend/execute_migration_integrations.php`
- `backend/execute_migration_qbo_mirror.php`

---

## 3. Frontend files (already built into the SPA)

These are bundled by `npm run build` — just deploy the `dist/` output:

- `src/pages/admin/AdminIntegrations.tsx`               ← Integrations list + Configure dialog
- `src/pages/admin/AdminIntegrationsOAuthCallback.tsx`  ← `/admin/integrations/oauth/quickbooks`
- `src/pages/admin/AdminIntegrationsSync.tsx`           ← `/admin/integrations/sync` (Run Sync Now screen)
- `src/pages/admin/AdminCustomers.tsx`                  ← contact person optional, convert-to-customer button
- `src/pages/admin/AdminApplications.tsx`               ← sends `overrides` on approve
- `src/components/admin/CustomerQboPanel.tsx`           ← invoices/estimates/payments per customer
- `src/lib/api.ts`                                      ← `approveApplication(id, pdfUrl, overrides)`

---

## 4. Intuit Developer portal — required URLs

In **https://developer.intuit.com → My App → Keys & OAuth → Sandbox**:

| Field                | Value                                                                       |
|----------------------|------------------------------------------------------------------------------|
| Redirect URI         | `https://YOUR-DOMAIN/admin/integrations/oauth/quickbooks`                   |
| Webhook endpoint URL | `https://YOUR-DOMAIN/api/integrations/quickbooks/webhook`                   |
| Webhook events       | Customer, Item, Invoice, Estimate, Payment (Create / Update / Delete)       |

After saving the webhook in Intuit, copy the **Verifier Token** and store it in
`remquip_integrations.credentials.webhook_verifier_token` (the Configure dialog
in `/admin/integrations` does this for you).

---

## 5. Smoke test (after upload)

1. `GET  /api/integrations` → should return a row with `provider='quickbooks'`, `status='disconnected'`.
2. Open `/admin/integrations` → click **Connect** on QuickBooks → finish Intuit consent → land on `/admin/integrations/oauth/quickbooks` → status flips to **Connected**.
3. Open `/admin/integrations/sync` → click **Sync Customers** → progress bar fills, processed count > 0, last sync timestamp updates.
4. Repeat for Inventory and Accounting cards.
5. Open any synced customer → the **QuickBooks** panel shows invoices, quotes, payments, total spent.
6. Approve a pending application from `/admin/applications` → new row appears in `/admin/customers` with `category=customer` (NOT lead) and the admin-edited fields are persisted.

That's the full set — SQL + PHP files + Intuit URLs.

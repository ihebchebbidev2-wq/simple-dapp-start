# Integrations Module — QuickBooks · Amazon SP-API · eBay

> Status: **Scaffold complete.** UI, database, and API endpoints are live.
> Real OAuth/API calls are stubbed and clearly marked `TODO` so they can be
> dropped in once you obtain developer credentials.

---

## 1. Activation steps

### a. Run the database migration
Visit once (admin):
```
https://yourdomain.com/remquip/backend/execute_migration_integrations.php
```
This creates 3 tables: `remquip_integrations`, `remquip_integration_logs`, `remquip_integration_mappings` and seeds three placeholder rows (one per provider).

### b. Open the admin page
Sidebar → **System → Integrations** (`/admin/integrations`)

You will see three cards: QuickBooks Online, Amazon Seller Central, eBay Marketplace.

### c. Configure & connect
1. Click **Configure** on a provider card.
2. Paste the credentials in the **Credentials** tab.
3. Toggle features in the **Features** tab.
4. Save.
5. Click **Connect** on the card. Once `connected`, **Test** and **Sync** buttons activate.

---

## 2. What's live today

| Layer | Path | Notes |
|---|---|---|
| Migration | `backend/migrations/migrate-integrations.sql` | 3 tables + seed rows |
| Migration runner | `backend/execute_migration_integrations.php` | one-shot |
| API | `backend/routes/integrations.php` | full CRUD + connect/disconnect/test/sync/webhook |
| Router registration | `backend/router.php` | resource added |
| Admin page | `src/pages/admin/AdminIntegrations.tsx` | cards + dialog with Credentials / Features / Sync / Logs tabs |
| Route | `/admin/integrations` (gated by `canEditSettings`) | wired in `App.tsx` + sidebar |

### REST endpoints
| Method | Path | Purpose |
|---|---|---|
| GET    | `/integrations`                          | list all |
| GET    | `/integrations/:provider`                | one (credentials masked) |
| GET    | `/integrations/:provider/logs`           | last 100 activity rows |
| GET    | `/integrations/:provider/mappings`       | local↔external id map |
| PUT    | `/integrations/:provider`                | upsert credentials/config (partial merge — blank fields preserved) |
| POST   | `/integrations/:provider/connect`        | validates required fields then sets `status=connected` |
| POST   | `/integrations/:provider/disconnect`     | wipes credentials, marks disconnected |
| POST   | `/integrations/:provider/test`           | ping — currently a stub |
| POST   | `/integrations/:provider/sync`           | body: `{ "entity": "..." }` |
| POST   | `/integrations/:provider/webhook`        | **public** — providers post here |

Secrets are masked on read (`••••1234`). PUT only writes fields that are sent non-empty, so the UI can leave a "Leave blank to keep existing" hint.

---

## 3. What still needs real keys + code

Every place that needs a real API call is marked with a `// TODO` comment in `backend/routes/integrations.php`. Below is exactly what to add per provider.

### 3.1 QuickBooks Online

**Docs:**
- Get started: https://developer.intuit.com/app/developer/qbo/docs/get-started
- OAuth 2.0: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- API reference: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account
- PHP SDK: https://github.com/intuit/QuickBooks-V3-PHP-SDK

**Credentials needed (already in the form):**
- `client_id`, `client_secret` (from the Intuit App)
- `redirect_uri` (must match exactly what's registered)
- `realm_id` (Company ID — comes back from the OAuth callback)
- `access_token`, `refresh_token` (captured during OAuth)

**OAuth flow to implement:**
1. Add `GET /integrations/quickbooks/oauth/start` — builds Intuit authorize URL with scope `com.intuit.quickbooks.accounting` and redirects.
2. Add `GET /integrations/quickbooks/oauth/callback` — exchanges `code` for tokens, stores in `credentials`, sets `status=connected` and `token_expires_at`.
3. Implement refresh: tokens expire in ~1 hour; refresh tokens last 100 days. Add a cron that refreshes tokens nearing expiry.

**Sync targets:**
- Customers ↔ `Customer` (https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/customer)
- Invoices → `Invoice`
- Payments → `Payment`
- Products ↔ `Item`

**Webhook signature:** verify the `intuit-signature` header (HMAC-SHA256 with the verifier token). Webhook URL: `https://yourdomain.com/remquip/backend/api.php?path=integrations/quickbooks/webhook`

---

### 3.2 Amazon Seller Central (SP-API)

**Docs:**
- Welcome: https://developer-docs.amazon.com/sp-api/docs/welcome
- Registering as developer: https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer
- Authorize app for selling partners: https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications
- Marketplace IDs: https://developer-docs.amazon.com/sp-api/docs/marketplace-ids

**Credentials needed:**
- LWA app: `lwa_client_id`, `lwa_client_secret`
- `refresh_token` (from the seller authorization)
- `seller_id`, `marketplace_id`
- (Optional, for restricted operations) `aws_access_key`, `aws_secret_key`, `role_arn`

**Implementation notes:**
- Exchange refresh token → access token via `https://api.amazon.com/auth/o2/token` (1 hr lifetime).
- Sign requests with AWS SigV4 only for restricted-data operations; most calls use plain Bearer.
- Use the SP-API PHP SDK or build a thin client. SDK list: https://developer-docs.amazon.com/sp-api/docs/sp-api-software-development-kits
- Respect rate limits — every endpoint publishes its quota; use the headers `x-amzn-RateLimit-Limit`.

**Sync targets:**
- Listings: `Listings Items API v2021-08-01`
- Orders: `Orders API v0` (`getOrders`)
- Inventory: `FBA Inventory API v1`

---

### 3.3 eBay

**Docs:**
- OAuth: https://developer.ebay.com/api-docs/static/oauth-tokens.html
- Sell APIs: https://developer.ebay.com/api-docs/sell/static/overview.html
- Marketplace account deletion notification (mandatory): https://developer.ebay.com/marketplace-account-deletion

**Credentials needed:**
- App credentials: `app_id`, `cert_id`, `dev_id`
- `redirect_uri` / `RuName`
- `refresh_token` (from user consent flow with `offline_access` scope, lifetime ~18 months)

**Implementation notes:**
- Production base: `https://api.ebay.com`, sandbox: `https://api.sandbox.ebay.com`.
- Refresh tokens to obtain user access tokens (2 hr lifetime).
- Webhook: subscribe to "Marketplace account deletion" notifications — eBay requires this to keep your app live.

**Sync targets:**
- Listings: Inventory API (`/sell/inventory/v1/`) or Trading API (`AddItem`).
- Orders: `Fulfillment API` `/sell/fulfillment/v1/order`
- Inventory: `/sell/inventory/v1/inventory_item`

---

## 4. Where to add real API code

In `backend/routes/integrations.php`, look for `// TODO:` markers in:

- `connect` action — perform the OAuth token exchange before flipping status.
- `test` action — replace `usleep(150000)` with a real lightweight call (per provider).
- `sync` action — branch on `$id` and call `QboSyncService::sync($entity)` / `AmazonSpApiSyncService::sync($entity)` / `EbaySyncService::sync($entity)`.
- `webhook` action — verify provider signature before logging.

Suggested layout:
```
backend/integrations/
  QboClient.php
  QboSyncService.php
  AmazonSpApiClient.php
  AmazonSyncService.php
  EbayClient.php
  EbaySyncService.php
```

Each `*Client` handles auth + token refresh; each `*SyncService` handles entity-by-entity mapping using `remquip_integration_mappings` for idempotent upserts.

---

## 5. Security

- All admin routes require `Auth::requireAuth('admin')`.
- Secrets are stored in `remquip_integrations.credentials` as JSON. Consider encrypting this column with `AES_ENCRYPT()` once you're ready for production.
- The webhook endpoint is intentionally public; **always verify the signature** before trusting payloads.
- Credentials are masked on read — only the last 4 chars are returned.

---

## 6. UI walkthrough

- **Status pill** — shows `connected | disconnected | pending | error`.
- **Configure dialog** has 4 tabs:
  - **Credentials** — environment + per-provider fields with show/hide toggles for secrets.
  - **Features** — per-data-flow toggles (e.g. "Sync invoices").
  - **Sync** — manual triggers per entity (only enabled when connected).
  - **Logs** — last 100 activity rows.
- All actions write to `remquip_integration_logs` for audit.

You're ready to plug in real keys whenever the customer hands them over.

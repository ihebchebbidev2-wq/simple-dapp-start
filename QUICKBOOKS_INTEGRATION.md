# QuickBooks Online — Complete Integration Guide

> Everything you need to make the bi-directional QuickBooks sync work end-to-end. Follow this top-to-bottom and the integration will be fully operational once your client gives you their Intuit App credentials.

---

## What this integration does

| Area | Direction | Mechanism |
|---|---|---|
| **Customers** | Bi-directional | REST + webhooks. Only `category='customer'` rows push to QBO. Leads & contractors stay local. |
| **Items / Products** | Bi-directional | REST + webhooks. Stock & pricing kept in sync. |
| **Invoices** | Pull-only into `remquip_qbo_invoices` | Webhook + manual sync |
| **Estimates / Quotes** | Pull-only into `remquip_qbo_estimates` | Webhook + manual sync |
| **Payments** | Pull-only into `remquip_qbo_payments` | Webhook + manual sync |
| **Total spent / payment history** | Computed from mirror tables | UI |

The accounting tables are **read-only mirrors** in MySQL. The customer detail page reads them locally — fast, offline-tolerant, no per-page-load API calls.

---

## 1) Prerequisites — what your client must give you

Send your client this checklist:

1. ✅ An **Intuit Developer account** at https://developer.intuit.com (free).
2. ✅ A **Production app** registered in `My Apps` for "QuickBooks Online and Payments".
3. ✅ The **Realm ID** (a.k.a. Company ID) of the QuickBooks company they use day-to-day.
4. ✅ **Admin access** to that QBO company so they can authorize the OAuth flow.
5. ✅ Permission to add the **redirect URI** and **webhook URL** we'll show them in the admin.

You'll receive from them:
- **Client ID** (Sandbox + Production)
- **Client Secret** (Sandbox + Production)
- The **Realm ID** is captured automatically during OAuth — no need to ask.

---

## 2) Run the database migration

```bash
# From the project root, hit it once (admin only):
curl https://your-domain.com/remquip/backend/execute_migration_qbo_mirror.php
# Or run from CLI:
php backend/execute_migration_qbo_mirror.php
```

This creates:
- `remquip_qbo_invoices`, `remquip_qbo_estimates`, `remquip_qbo_payments`
- `remquip_qbo_accounts` (chart of accounts cache, used for Item creation)
- Adds `qbo_id` + `qbo_synced_at` columns on `remquip_customers` and `remquip_products`

---

## 3) Configure the integration in the admin

Navigate to `/admin/integrations` and click **Configure** on the QuickBooks card.

### Credentials tab
Paste the values from Intuit:

| Field | Where to find it |
|---|---|
| Client ID | Intuit App → Keys & OAuth → Sandbox/Production Keys |
| Client Secret | Same screen |
| Redirect URI | **Copy the value shown in the "Webhooks" tab here** (it ends with `/admin/integrations/oauth/quickbooks`). Paste it back into Intuit App → Keys & OAuth → Redirect URIs. |
| Webhook Verifier Token | After saving the Webhook URL in Intuit, Intuit gives you a Verifier Token. Paste it here. |

Set **Environment = Sandbox** while testing, then switch to **Production**.

### Webhooks tab
This shows the **exact** URLs to paste into Intuit. Three URLs matter:
1. **OAuth Redirect URI** → goes into `Keys & OAuth → Redirect URIs`
2. **Webhook Notification URL** → goes into `Webhooks → Endpoint URL`
3. (none for QBO besides those two)

In Intuit's Webhooks page, tick at least: **Customer**, **Item**, **Invoice**, **Estimate**, **Payment**. Save.

---

## 4) Run the OAuth flow

1. Click **Connect** on the QuickBooks card.
2. You'll be redirected to Intuit → sign in with the QBO admin account → click **Authorize**.
3. The callback page (`/admin/integrations/oauth/quickbooks`) captures `code`, `state`, and `realmId` from the URL and POSTs them to `POST /integrations/quickbooks/oauth/callback`.
4. Backend exchanges them for `access_token` + `refresh_token` and saves them encrypted in `remquip_integrations.credentials`.
5. Status flips to **Connected**.

The access token lives 1 hour and is **auto-refreshed** before every API call (and also on any 401 with one retry). The refresh token lives **100 days** — if nobody uses the integration for 100 days the refresh token expires and you must re-authorize. Show the admin a banner at day 90.

---

## 5) Initial bulk sync

In the **Sync** tab inside Configure, run these in order (each is idempotent — re-running is safe):

1. **Accounts** — caches the chart of accounts so you can create inventory items
2. **Customers** — pulls every QBO customer + pushes any local `category='customer'` rows that don't have a `qbo_id` yet
3. **Items / Products** — pulls every QBO Item + pushes any local product without a `qbo_id`
4. **Invoices** → **Estimates** → **Payments** — populate the mirror tables

Each sync writes a row to `remquip_integration_logs` with counts + duration so you can audit.

---

## 6) Ongoing operation

- **Webhooks** drive real-time updates. When QBO emits a `Customer.Update` event, the backend's webhook router calls `QboSyncService::pullSingleCustomer()` and the local row is patched. Same for Items, Invoices, Estimates, Payments.
- **Bi-directional customers**: when you create or edit a `category='customer'` row in Remquip, you can call `POST /integrations/quickbooks/sync` with `{"entity":"customers"}` to push the unsynced ones. (You can also wire a per-row "Push to QBO" button — endpoint already exists.)
- **Conflict resolution**: last-write-wins by `MetaData.LastUpdatedTime` (QBO) vs `updated_at` (Remquip).
- **Soft delete**: QBO sets `Active=false`. We store this in `status` (`active`/`inactive`).

---

## 7) Field mappings

### Customer
| Remquip | QBO Customer |
|---|---|
| `company_name` | `CompanyName` / `DisplayName` |
| `contact_name` (split) | `GivenName` + `FamilyName` |
| `email` | `PrimaryEmailAddr.Address` |
| `phone` | `PrimaryPhone.FreeFormNumber` |
| `billing_address` (JSON) | `BillAddr.{Line1, City, CountrySubDivisionCode, PostalCode, Country}` |
| `shipping_address` (JSON) | `ShipAddr.*` |
| `status` | derived from `Active` |
| `notes` | `Notes` |

### Product / Item
| Remquip | QBO Item |
|---|---|
| `name` | `Name` |
| `sku` | `Sku` |
| `description` | `Description` |
| `price` | `UnitPrice` |
| `stock` | `QtyOnHand` (only for Inventory type) |

> **⚠️ Inventory items require account refs.** Pick `Income`, `Expense`, and `Asset` accounts in `Configure → Sync → Accounts` first. If any of the three is unset, items are pushed as **NonInventory** (no stock tracking).

---

## 8) Webhook signature verification

Every QBO webhook POST carries `intuit-signature: <base64(HMAC-SHA256(payload, verifier_token))>`. Our backend computes the expected signature and rejects mismatches with HTTP 401. Implementation: `backend/routes/integrations.php`, the QBO branch in the `POST` block.

---

## 9) Troubleshooting

| Symptom | Fix |
|---|---|
| `QBO refresh failed [401]: invalid_grant` | Refresh token expired (100 days idle). Re-run the OAuth flow. |
| `webhook_verifier_token missing` (412) | Paste the verifier token Intuit gave you into Credentials. |
| `QBO API ... failed [400]: ValidationFault` | Usually a missing required field (e.g. Item without account refs). Check the response body in `remquip_integration_logs.payload`. |
| Customers pushed twice | Two local rows had matching email. Run a duplicate cleanup before initial push, or rely on QBO's automatic merge. |
| `getCustomer` returns nothing | The customer was deleted in QBO and your local `qbo_id` is stale. Clear it: `UPDATE remquip_customers SET qbo_id=NULL WHERE id='...'`. |
| Rate limit errors | QBO allows 500 req/min/realm. Initial bulk pulls of >5k customers should be paginated (already implemented at 100/page). |

---

## 10) Production checklist

- [ ] Production keys pasted (NOT sandbox)
- [ ] Environment toggle set to `production`
- [ ] Webhook endpoint reachable over HTTPS (Intuit will not call HTTP)
- [ ] App passed Intuit production review
- [ ] Verifier token saved
- [ ] Cron job calling `POST /integrations/quickbooks/sync` (entity rotation) at least once a day as a reconciliation safety net
- [ ] Backup of `remquip_integrations.credentials` taken (it contains the refresh token)
- [ ] Admin banner configured to warn at day 90 of refresh-token age

---

## 11) API reference (for developers)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET`  | `/integrations` | List all providers |
| `GET`  | `/integrations/quickbooks` | One provider (credentials masked) |
| `PUT`  | `/integrations/quickbooks` | Save credentials/config |
| `GET`  | `/integrations/quickbooks/oauth/start` | Build authorize URL |
| `POST` | `/integrations/quickbooks/oauth/callback` | Exchange code → tokens |
| `POST` | `/integrations/quickbooks/connect` | Validate creds + flip status |
| `POST` | `/integrations/quickbooks/disconnect` | Wipe tokens |
| `POST` | `/integrations/quickbooks/test` | Real `CompanyInfo` ping |
| `POST` | `/integrations/quickbooks/sync` | `{entity: customers\|items\|invoices\|estimates\|payments\|accounts}` |
| `GET`  | `/integrations/quickbooks/accounts` | Cached chart of accounts |
| `GET`  | `/integrations/quickbooks/customer/{localId}` | Mirror data + totals for one customer |
| `GET`  | `/integrations/quickbooks/logs` | Activity log |
| `GET`  | `/integrations/quickbooks/mappings` | local_id ↔ qbo_id pairs |
| `POST` | `/integrations/quickbooks/webhook` | (public) Intuit webhook receiver |

---

## 12) Files involved

```
backend/
  integrations/
    QboClient.php          ← OAuth + REST + auto-refresh
    QboSyncService.php     ← Orchestrator (push/pull + mappings)
  migrations/
    migrate-qbo-mirror-tables.sql
  execute_migration_qbo_mirror.php
  routes/
    integrations.php       ← Webhook router + sync endpoints

src/pages/admin/
  AdminIntegrations.tsx                ← Configure UI
  AdminIntegrationsOAuthCallback.tsx   ← OAuth landing page
  AdminCustomers.tsx                   ← QBO tab in customer detail
```

That's it — once your client gives you the Client ID + Secret, you complete steps 3 → 5 in 10 minutes and the integration is live.

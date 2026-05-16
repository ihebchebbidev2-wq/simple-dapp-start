# QuickBooks Online — Step-by-Step Setup Guide

> Follow this guide top-to-bottom. By the end you will have a fully working bi-directional sync between Remquip and QuickBooks Online for **Customers**, **Inventory items**, and a read-only **financial overview** (Invoices, Quotes, Payments, totals per client).
>
> Total time: ~20 minutes once you have an Intuit Developer account.

---

## ✅ What you'll get when you finish

| Area | Direction | Where to see it |
|---|---|---|
| **Clients (Leads vs Customers)** | Bi-directional. Only `category='customer'` rows sync to QBO. Leads & contractors stay local. | `/admin/customers` (filter Leads/Customers/Contractors) |
| **Inventory** | Bi-directional. Stock + price + SKU stay in sync. | `/admin/products` and `/admin/inventory` |
| **Invoices, Quotes, Payments** | Pull-only mirror (read-only in Remquip) | "QuickBooks" tab on each customer detail page |
| **Total spent + payment history per client** | Computed from mirror tables | Same tab — KPI cards at top |

---

## STEP 1 — Run the database migration (1 minute)

Open this URL **once** while logged in as admin:
```
https://YOUR-DOMAIN.com/remquip/backend/execute_migration_qbo_mirror.php
```
You should see `migration completed`. This creates the mirror tables and the `qbo_id` columns. It is idempotent — safe to re-run.

---

## STEP 2 — Create an Intuit Developer account (3 minutes)

1. Go to **https://developer.intuit.com**
2. Click **Sign up** (top-right). Use the same email that owns the QuickBooks company you want to sync. It's free.
3. Verify your email.

---

## STEP 3 — Create your QuickBooks app (5 minutes)

1. Once logged into **developer.intuit.com**, click **Dashboard → Create an app**.
2. Choose **QuickBooks Online and Payments**.
3. Give it a name (e.g. `Remquip Sync`) and pick the scope **`com.intuit.quickbooks.accounting`**. Click **Create**.

You're now inside your new app.

### 3a. Get your Sandbox keys (use these first to test)
1. Left sidebar → **Keys & credentials**
2. Make sure the tab is set to **Development settings** (= sandbox).
3. You'll see:
   - **Client ID** — copy it
   - **Client Secret** — copy it
4. Scroll down to **Redirect URIs** and click **Add URI**. Paste this exact URL (replace the domain with yours):
   ```
   https://YOUR-DOMAIN.com/admin/integrations/oauth/quickbooks
   ```
   Save.

### 3b. Set up Webhooks (so QBO pushes changes to you in real time)
1. Left sidebar → **Webhooks**
2. **Endpoint URL** — paste:
   ```
   https://YOUR-DOMAIN.com/remquip/backend/api.php?path=integrations/quickbooks/webhook
   ```
3. **Events to subscribe to** — tick at minimum:
   - ☑ Customer (Create, Update, Merge)
   - ☑ Item (Create, Update)
   - ☑ Invoice (Create, Update, Delete, Void)
   - ☑ Estimate (Create, Update, Delete)
   - ☑ Payment (Create, Update, Delete, Void)
4. Click **Save**.
5. After saving, Intuit shows a **Verifier Token** at the top of the page. **Copy it** — you'll paste it in Step 4. (Without it, webhooks will be rejected for invalid signature.)

### 3c. Find your Realm ID (Company ID)
1. Open https://app.qbo.intuit.com (or the sandbox: https://sandbox.qbo.intuit.com)
2. Click the **gear icon (⚙)** top-right → **Additional information**
3. The **Company ID** is your Realm ID. Copy it.
   *Tip:* it's also automatically captured during OAuth — you can leave it blank and it will be filled in.

---

## STEP 4 — Paste credentials into Remquip (2 minutes)

1. Open `/admin/integrations` in Remquip.
2. Click **Configure** on the QuickBooks card.
3. Go to the **Credentials** tab and paste:

| Field | Value |
|---|---|
| **Environment** | `Sandbox` (switch to `Production` later) |
| **Client ID** | from Step 3a |
| **Client Secret** | from Step 3a |
| **Realm ID** | from Step 3c (or leave blank — captured by OAuth) |
| **Redirect URI** | exactly `https://YOUR-DOMAIN.com/admin/integrations/oauth/quickbooks` |
| **Webhook Verifier Token** | from Step 3b |

Leave **Access Token** and **Refresh Token** empty — those are written automatically after OAuth.

4. Click **Save**.

---

## STEP 5 — Connect (the OAuth flow) (1 minute)

1. Still in the dialog, click the **Sync** tab → **Connect to QuickBooks**.
   *(Or close the dialog and click the green "Connect" button on the QuickBooks card.)*
2. You'll be redirected to Intuit. Sign in with the QuickBooks **company admin** account.
3. Click **Connect** → **Authorize**.
4. Intuit redirects you back to `/admin/integrations/oauth/quickbooks`. The page will auto-exchange the code for tokens and you'll land back on `/admin/integrations`.
5. The status pill flips to **Connected** ✅.

> If you see `invalid_redirect_uri`: the URL in Intuit's "Redirect URIs" list does not exactly match what you put in the Credentials tab. Fix one to match the other (down to the trailing slash).

---

## STEP 6 — Pick the accounts that QBO Items will use (1 minute)

QuickBooks needs to know which Income / Expense / Asset accounts new inventory items go against. Run this once:

1. In `/admin/integrations`, open the QuickBooks **Configure** dialog → **Sync** tab.
2. Click **Sync accounts**. This populates the chart-of-accounts cache.
3. Pick:
   - **Income account** (e.g. `Sales of Product Income`)
   - **Expense account** (e.g. `Cost of Goods Sold`)
   - **Asset account** (e.g. `Inventory Asset`)
4. Save. Future product pushes from Remquip → QBO will be created as **Inventory** items with stock tracking. (If any of the three is unset, items push as `NonInventory` instead — works fine but no QBO-side stock.)

---

## STEP 7 — Initial bulk sync (5 minutes, mostly waiting)

Run these in order — each is idempotent (safe to re-run):

| # | Button | What it does |
|---|---|---|
| 1 | **Sync customers** | Pulls every QBO Customer → Remquip, then pushes any local `category='customer'` row that has no `qbo_id` yet. |
| 2 | **Sync items / products** | Same idea for products. |
| 3 | **Sync invoices** | Populates `remquip_qbo_invoices` mirror. |
| 4 | **Sync estimates** | Populates `remquip_qbo_estimates`. |
| 5 | **Sync payments** | Populates `remquip_qbo_payments`. |

After each run, switch to the **Logs** tab — you'll see counts and durations.

---

## STEP 8 — Verify it works (1 minute)

1. Go to `/admin/customers`, click any customer that has a `qbo_id`.
2. Open the **QuickBooks** tab.
3. You should see:
   - 4 KPI tiles: **Total invoiced · Total paid · Outstanding · Invoice count**
   - 3 tables: **Invoices**, **Quotes / Estimates**, **Payments**

Now make a small change in QBO (e.g. edit a customer's phone number) and within seconds the local Remquip row updates — that's the webhook firing live.

---

## STEP 9 — Switch to Production (when ready)

1. Back in **developer.intuit.com → Your app → Keys & credentials**, switch the tab to **Production settings**.
2. Submit your app for **Production review** (Intuit asks a few questions about how you handle data).
3. Once approved, you get **Production** Client ID, Client Secret, and a separate webhook Verifier Token.
4. In `/admin/integrations` → QuickBooks → Configure:
   - Switch **Environment** to `Production`
   - Paste the new Client ID, Secret, Verifier Token
5. Click **Disconnect** then **Connect** again to re-run OAuth against the production company.
6. Repeat the bulk sync (Step 7) once.

---

## How the day-to-day flow works

- **Webhook-driven (real-time)**: any change in QBO (Customer, Item, Invoice, Estimate, Payment) is pushed to Remquip within seconds and the matching local row is patched.
- **Periodic safety-net cron** *(recommended)*: hit `POST /integrations/quickbooks/sync` for each entity once a day to catch any webhook misses. Example wp-cron / system-cron line:
  ```
  0 3 * * * curl -fsS -H "Cookie: <admin-cookie>" "https://YOUR-DOMAIN.com/remquip/backend/api.php?path=integrations/quickbooks/sync" -d '{"entity":"customers"}'
  ```
- **Token lifecycle**: access tokens last 1 hour and auto-refresh. Refresh tokens last 100 days — if nobody uses the integration for 100 days you'll need to re-authorize.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `invalid_redirect_uri` | The Redirect URI in Intuit must EXACTLY match the one in your Credentials tab. |
| `webhook_verifier_token missing` (HTTP 412 in logs) | Paste the Verifier Token from Intuit's Webhooks page into the Credentials tab. |
| `QBO refresh failed [401]: invalid_grant` | Refresh token expired (idle > 100 days). Click **Disconnect** then **Connect** to re-authorize. |
| Customers pushed appear twice in QBO | Two local rows shared an email/company name. Clean duplicates locally then re-sync. |
| `ValidationFault` on items | Account refs not picked. Do **Step 6**. |
| Webhook returns 401 in your server logs | Verifier token mismatch. Re-copy from Intuit and save again. |

---

## Files involved (for developers)

```
backend/integrations/QboClient.php          ← OAuth + REST + auto-refresh
backend/integrations/QboSyncService.php     ← Push/pull orchestration + mappings
backend/routes/integrations.php             ← REST + webhook router
backend/migrations/quickbooks-complete.sql  ← Full schema (idempotent)
backend/execute_migration_qbo_mirror.php    ← One-shot runner

src/pages/admin/AdminIntegrations.tsx                ← /admin/integrations
src/pages/admin/AdminIntegrationsOAuthCallback.tsx   ← OAuth landing
src/components/admin/CustomerQboPanel.tsx            ← QuickBooks tab on a customer
```

That's it — once your client gives you Client ID + Client Secret + Verifier Token, the whole chain is live in under 10 minutes.

# Customer feedback — implementation plan

Six items. Each maps to backend (SQL + PHP) and/or frontend (React admin) work. No design changes; functionality only.

## 1. Strict module separation (Leads / Customers / Contract Customers)

The three admin pages already share the `AdminCustomers` component, filtered by `customer_category` (`lead` | `customer` | `contract`). Today, the "New" dialog can flip the category, and a contract can only be born from an online application.

**Changes**
- Lock the `customer_category` of newly created records to the page they were opened from. The "New" dialog reads the route (`/admin/leads`, `/admin/customers`, `/admin/contract-customers`) and sends that as `customer_category`; the selector becomes read-only.
- Add **"Create Contract Customer manually"** button on `/admin/contract-customers` that bypasses the online application flow. Backend already accepts `customer_category=contract`; we just need a UI entry point and to default `contract_validated=true` (admin-created) plus optional `contract_signed_at = now()`.
- List queries: confirm each route filters strictly by its own category (already true — verify and add tests where missing).

## 2. Edit redirect goes back to previous page

Today, saving a customer/lead/contract in `CustomerEditPage` (or the inline edit dialog inside `AdminCustomers`) always pushes to `/admin/customers`.

**Changes**
- Replace the hard-coded `navigate("/admin/customers")` calls with `navigate(-1)` when there is history; fall back to the category-aware list (`/admin/leads`, `/admin/customers`, `/admin/contract-customers`) based on the record's `customer_category`.
- When opening edit, pass `state: { from: location.pathname }` so cancel/save both honor it.

## 3. Accountant email field

`remquip_customers` currently has one `email` (contact).

**Changes**
- Migration: `ALTER TABLE remquip_customers ADD COLUMN accountant_email VARCHAR(255) NULL AFTER email;`
- Backend: include `accountant_email` in `GET/POST/PATCH /customers` payloads and validation (optional, email-format check).
- Frontend: add the field to the customer form (all 3 categories), the detail view, and any "Send invoice / statement" email composer so the user can pick contact vs. accountant.

## 4. Customizable lead statuses

**Schema**
```sql
CREATE TABLE remquip_lead_statuses (
  id CHAR(36) PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  sort_order INT NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE remquip_customers
  ADD COLUMN lead_status_id CHAR(36) NULL,
  ADD CONSTRAINT fk_lead_status FOREIGN KEY (lead_status_id)
    REFERENCES remquip_lead_statuses(id) ON DELETE SET NULL;
```
Seed defaults: New, Contacted, Qualified, Proposal Sent, Won, Lost.

**Backend**
- New routes under `backend/routes/lead_statuses.php`:
  `GET/POST/PATCH/DELETE /lead-statuses` (admin-only).
- `PATCH /customers/:id` accepts `lead_status_id`.

**Frontend**
- New management page `src/pages/admin/AdminLeadStatuses.tsx` (or section in AdminSettings → "Lead pipeline"): list with reorder, color picker, add/edit/delete (block delete if in use → ask to reassign).
- On `/admin/leads` table: column showing the colored status pill; inline edit via select.
- In customer edit form (when category=lead): replace free-text status with the select.

## 5. Order pre-confirmation editing

Per the user's choice: orders in **any status except `shipped` / `delivered` / `completed` / `cancelled`** are fully editable (add/remove lines, change qty), with totals recalculated.

**Backend**
- New endpoints in `backend/routes/sales.php`:
  - `POST /orders/:id/items` — add line (validates stock + per-customer price).
  - `PATCH /orders/:id/items/:itemId` — change qty.
  - `DELETE /orders/:id/items/:itemId` — remove line.
  - Each recomputes `subtotal`, `tax_total`, `total`, writes an audit row, and rejects when status ∈ locked set.
- Stock side-effect: keep current "reserve on confirm" behavior — edits before confirmation just adjust the cart-equivalent without touching stock.

**Frontend**
- In `AdminOrders` order-detail drawer: when status is editable, render an inline editable table (qty input, delete button, product search to add a line). Totals refresh live. A banner shows "Editable — order not yet confirmed/shipped". When locked, show read-only as today.

## 6. Tasks & Reminders module

`remquip_crm_tasks` exists with `customer_id NOT NULL`. We will extend it to support standalone tasks and a dedicated admin page; the existing `TaskReminderModal`, `useUpcomingTasks`, and customer-profile Tasks tab keep working.

**Schema**
```sql
ALTER TABLE remquip_crm_tasks
  MODIFY customer_id CHAR(36) NULL,
  ADD COLUMN assigned_to CHAR(36) NULL AFTER status,
  ADD COLUMN priority ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  ADD INDEX idx_crm_tasks_assigned (assigned_to),
  ADD INDEX idx_crm_tasks_due (due_at);
```

**Backend** (`backend/routes/tasks.php`, mounted under `/tasks`)
- `GET /tasks` with filters (status, assignee, mine, due-range, has_customer).
- `POST /tasks` (customer_id optional).
- `PATCH /tasks/:id`, `DELETE /tasks/:id`.
- Keep the existing `/customers/:id/tasks` endpoints; they just write into the same table.

**Frontend**
- New page `src/pages/admin/AdminTasks.tsx`: list with tabs (All / Mine / Due soon / Overdue / Done), create dialog (title, notes, due date, priority, assignee dropdown of admin users, optional customer link via existing customer search combobox), inline status toggle, edit & delete.
- Add **Tasks** entry to `AdminLayout` sidebar between Customers and Chat; badge reuses `useUpcomingTasks` count.
- Existing customer-profile Tasks tab unchanged; new tasks created there continue to appear in the global module.

---

## Technical notes (for the engineer)

- **Migrations**: add SQL files under `backend/migrations/` and an `execute_migration_feedback_2026_05.php` runner mirroring the existing pattern.
- **Permissions**: lead statuses and tasks module gated by existing `PermissionGate` keys; add new keys `lead_statuses.manage`, `tasks.view`, `tasks.manage` in `AdminAccess` seed.
- **API client**: extend `src/lib/api.ts` with `leadStatuses`, `tasks` (global), `orderItems` namespaces.
- **Routes**: register `/admin/tasks` and `/admin/lead-statuses` (or surface inside `AdminSettings`).
- **No design changes** — reuse existing `AdminDataTable`, dialogs, and form primitives.

## Out of scope (will not change)

- The React Router DOM vs TanStack scaffolding mismatch noted earlier (separate cleanup task).
- Any visual redesign.
- QuickBooks/Stripe behavior beyond what order-line edits naturally affect (totals already sync via existing mirror).

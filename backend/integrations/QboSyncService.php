<?php
/**
 * QboSyncService — orchestrates bi-directional sync between Remquip and QBO.
 *
 *  Customers: bi-directional (Remquip ↔ QBO Customer)
 *  Items:     bi-directional (Remquip Products ↔ QBO Item)
 *  Invoices / Estimates / Payments: pull-only into mirror tables
 *
 * Mapping is stored in remquip_integration_mappings and ALSO denormalised
 * onto remquip_customers.qbo_id / remquip_products.qbo_id for fast joins.
 */

require_once __DIR__ . '/QboClient.php';

class QboSyncService
{
    private $db;
    private QboClient $client;
    private string $integrationId;

    public function __construct($db)
    {
        $this->db     = $db;
        $this->client = new QboClient($db);
        $row = $db->fetch('SELECT id FROM remquip_integrations WHERE provider = :p', ['p' => 'quickbooks']);
        $this->integrationId = (string) ($row['id'] ?? '');
        if (!$this->integrationId) {
            throw new RuntimeException('QuickBooks integration row not found.');
        }
    }

    /* =================================================================
     *  Public entry-point used by /integrations/quickbooks/sync
     * ================================================================= */
    public function sync(string $entity): array
    {
        switch ($entity) {
            case 'customers': return $this->syncCustomers();
            case 'products':
            case 'items':     return $this->syncItems();
            case 'invoices':  return $this->pullInvoices();
            case 'estimates': return $this->pullEstimates();
            case 'payments':  return $this->pullPayments();
            case 'accounts':  return $this->pullAccounts();
            default:
                throw new RuntimeException("Unknown entity: {$entity}");
        }
    }

    /* =================================================================
     *  CUSTOMERS — bi-directional
     * ================================================================= */

    /** Pull all QBO customers + push pending Remquip customers (category=customer). */
    public function syncCustomers(): array
    {
        $pulled = $this->pullCustomers();
        $pushed = $this->pushCustomers();
        return ['pulled' => $pulled, 'pushed' => $pushed];
    }

    /** Pull all customers from QBO into remquip_customers. */
    public function pullCustomers(): array
    {
        $start = 1; $page = 100; $processed = 0; $created = 0; $updated = 0; $failed = 0;
        do {
            $batch = $this->client->listCustomers($start, $page);
            foreach ($batch as $c) {
                try {
                    $r = $this->upsertLocalCustomerFromQbo($c);
                    if ($r === 'created') $created++; else $updated++;
                    $processed++;
                } catch (Throwable $e) {
                    $failed++;
                    Logger::error('pullCustomer failed', ['qbo_id' => $c['Id'] ?? '?', 'err' => $e->getMessage()]);
                }
            }
            $start += $page;
        } while (count($batch) === $page);
        return compact('processed', 'created', 'updated', 'failed');
    }

    /** Push category=customer rows that don't yet have a qbo_id. */
    public function pushCustomers(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT * FROM remquip_customers
             WHERE category = 'customer'
               AND (qbo_id IS NULL OR qbo_id = '')
             LIMIT 200"
        );
        $pushed = 0; $failed = 0;
        foreach ($rows as $row) {
            try {
                $payload = $this->buildQboCustomerPayload($row);
                $created = $this->client->createCustomer($payload);
                $qboId   = (string) ($created['Id'] ?? '');
                if ($qboId) {
                    $this->updateLocalCustomerQboId($row['id'], $qboId, $created);
                    $pushed++;
                }
            } catch (Throwable $e) {
                $failed++;
                Logger::error('pushCustomer failed', ['local_id' => $row['id'], 'err' => $e->getMessage()]);
            }
        }
        return compact('pushed', 'failed');
    }

    public function pullSingleCustomer(string $qboId): ?string
    {
        $c = $this->client->getCustomer($qboId);
        return $c ? $this->upsertLocalCustomerFromQbo($c) : null;
    }

    private function upsertLocalCustomerFromQbo(array $c): string
    {
        $qboId   = (string) ($c['Id'] ?? '');
        if (!$qboId) throw new RuntimeException('QBO customer missing Id');

        $existing = $this->db->fetch(
            'SELECT id FROM remquip_customers WHERE qbo_id = :q LIMIT 1', ['q' => $qboId]
        );

        $email     = $c['PrimaryEmailAddr']['Address']     ?? null;
        $phone     = $c['PrimaryPhone']['FreeFormNumber']  ?? null;
        $company   = $c['CompanyName']                     ?? ($c['DisplayName'] ?? null);
        $given     = $c['GivenName']  ?? '';
        $family    = $c['FamilyName'] ?? '';
        $contact   = trim("$given $family");
        $billing   = $c['BillAddr']  ?? null;
        $shipping  = $c['ShipAddr']  ?? null;
        $notes     = $c['Notes']     ?? null;
        $active    = !empty($c['Active']) ? 1 : 0;

        if ($existing) {
            $this->db->execute(
                'UPDATE remquip_customers
                 SET company_name = :company, contact_name = :contact, email = :email, phone = :phone,
                     billing_address = :billing, shipping_address = :shipping, notes = :notes,
                     status = :status, qbo_synced_at = NOW(), updated_at = NOW()
                 WHERE id = :id',
                [
                    'company' => $company,
                    'contact' => $contact ?: null,
                    'email'   => $email,
                    'phone'   => $phone,
                    'billing' => $billing  ? json_encode($billing,  JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
                    'shipping'=> $shipping ? json_encode($shipping, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
                    'notes'   => $notes,
                    'status'  => $active ? 'active' : 'inactive',
                    'id'      => $existing['id'],
                ]
            );
            $this->upsertMapping('customer', $existing['id'], $qboId, $c);
            return 'updated';
        }

        // Create new
        $newId = $this->db->fetch('SELECT UUID() AS u')['u'];
        $this->db->execute(
            'INSERT INTO remquip_customers
                (id, company_name, contact_name, email, phone, billing_address, shipping_address,
                 customer_type, category, status, notes, qbo_id, qbo_synced_at, created_at, updated_at)
             VALUES (:id, :company, :contact, :email, :phone, :billing, :shipping,
                 :ctype, :cat, :status, :notes, :qbo, NOW(), NOW(), NOW())',
            [
                'id'      => $newId,
                'company' => $company ?: 'QBO Customer',
                'contact' => $contact ?: null,
                'email'   => $email,
                'phone'   => $phone,
                'billing' => $billing  ? json_encode($billing,  JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
                'shipping'=> $shipping ? json_encode($shipping, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
                'ctype'   => 'Wholesale',
                'cat'     => 'customer',
                'status'  => $active ? 'active' : 'inactive',
                'notes'   => $notes,
                'qbo'     => $qboId,
            ]
        );
        $this->upsertMapping('customer', $newId, $qboId, $c);
        return 'created';
    }

    private function buildQboCustomerPayload(array $row): array
    {
        $payload = [
            'DisplayName'  => $row['company_name'] ?: ($row['contact_name'] ?: ($row['email'] ?: 'Remquip Customer')),
            'CompanyName'  => $row['company_name'] ?: null,
        ];
        if (!empty($row['contact_name'])) {
            $parts = explode(' ', trim($row['contact_name']), 2);
            $payload['GivenName']  = $parts[0] ?? '';
            $payload['FamilyName'] = $parts[1] ?? '';
        }
        if (!empty($row['email'])) $payload['PrimaryEmailAddr']    = ['Address' => $row['email']];
        if (!empty($row['phone'])) $payload['PrimaryPhone']        = ['FreeFormNumber' => $row['phone']];

        foreach (['billing_address' => 'BillAddr', 'shipping_address' => 'ShipAddr'] as $col => $qboKey) {
            if (!empty($row[$col])) {
                $addr = is_array($row[$col]) ? $row[$col] : (json_decode($row[$col], true) ?: null);
                if (is_array($addr)) {
                    $payload[$qboKey] = array_filter([
                        'Line1'                  => $addr['line1'] ?? $addr['Line1'] ?? ($addr['street'] ?? null),
                        'City'                   => $addr['city']  ?? $addr['City']  ?? null,
                        'CountrySubDivisionCode' => $addr['state'] ?? $addr['CountrySubDivisionCode'] ?? null,
                        'PostalCode'             => $addr['postal_code'] ?? $addr['PostalCode'] ?? ($addr['zip'] ?? null),
                        'Country'                => $addr['country'] ?? $addr['Country'] ?? null,
                    ]);
                }
            }
        }
        return $payload;
    }

    private function updateLocalCustomerQboId(string $localId, string $qboId, array $qboCustomer): void
    {
        $this->db->execute(
            'UPDATE remquip_customers SET qbo_id = :q, qbo_synced_at = NOW(), updated_at = NOW() WHERE id = :id',
            ['q' => $qboId, 'id' => $localId]
        );
        $this->upsertMapping('customer', $localId, $qboId, $qboCustomer);
    }

    /* =================================================================
     *  ITEMS / PRODUCTS — bi-directional
     * ================================================================= */

    public function syncItems(): array
    {
        $pulled = $this->pullItems();
        $pushed = $this->pushItems();
        return ['pulled' => $pulled, 'pushed' => $pushed];
    }

    public function pullItems(): array
    {
        $start = 1; $page = 100; $processed = 0; $created = 0; $updated = 0; $failed = 0;
        do {
            $batch = $this->client->listItems($start, $page);
            foreach ($batch as $i) {
                try {
                    $r = $this->upsertLocalProductFromQbo($i);
                    if ($r === 'created') $created++; else $updated++;
                    $processed++;
                } catch (Throwable $e) {
                    $failed++;
                    Logger::error('pullItem failed', ['qbo_id' => $i['Id'] ?? '?', 'err' => $e->getMessage()]);
                }
            }
            $start += $page;
        } while (count($batch) === $page);
        return compact('processed', 'created', 'updated', 'failed');
    }

    public function pushItems(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT id, sku, name, description, price, stock
             FROM remquip_products
             WHERE (qbo_id IS NULL OR qbo_id = '')
             LIMIT 200"
        );
        $pushed = 0; $failed = 0;
        $defaults = $this->itemAccountDefaults();
        foreach ($rows as $row) {
            try {
                $payload = $this->buildQboItemPayload($row, $defaults);
                $created = $this->client->createItem($payload);
                $qboId   = (string) ($created['Id'] ?? '');
                if ($qboId) {
                    $this->db->execute(
                        'UPDATE remquip_products SET qbo_id = :q, qbo_synced_at = NOW(), updated_at = NOW() WHERE id = :id',
                        ['q' => $qboId, 'id' => $row['id']]
                    );
                    $this->upsertMapping('product', $row['id'], $qboId, $created);
                    $pushed++;
                }
            } catch (Throwable $e) {
                $failed++;
                Logger::error('pushItem failed', ['local_id' => $row['id'], 'err' => $e->getMessage()]);
            }
        }
        return compact('pushed', 'failed');
    }

    public function pullSingleItem(string $qboId): ?string
    {
        $i = $this->client->getItem($qboId);
        return $i ? $this->upsertLocalProductFromQbo($i) : null;
    }

    private function upsertLocalProductFromQbo(array $i): string
    {
        $qboId = (string) ($i['Id'] ?? '');
        if (!$qboId) throw new RuntimeException('QBO Item missing Id');

        $existing = $this->db->fetch(
            'SELECT id FROM remquip_products WHERE qbo_id = :q LIMIT 1', ['q' => $qboId]
        );

        $sku   = $i['Sku']  ?? null;
        $name  = $i['Name'] ?? 'QBO Item';
        $desc  = $i['Description']  ?? null;
        $price = isset($i['UnitPrice'])    ? (float) $i['UnitPrice']    : 0.0;
        $stock = isset($i['QtyOnHand'])    ? (int)   $i['QtyOnHand']    : null;
        $active= !empty($i['Active']);

        if ($existing) {
            $sets = ['name = :name', 'description = :desc', 'price = :price',
                     'qbo_synced_at = NOW()', 'updated_at = NOW()'];
            $params = ['name' => $name, 'desc' => $desc, 'price' => $price, 'id' => $existing['id']];
            if ($stock !== null) { $sets[] = 'stock = :stock'; $params['stock'] = $stock; }
            if ($sku) { $sets[] = 'sku = :sku'; $params['sku'] = $sku; }
            $this->db->execute(
                'UPDATE remquip_products SET ' . implode(', ', $sets) . ' WHERE id = :id',
                $params
            );
            $this->upsertMapping('product', $existing['id'], $qboId, $i);
            return 'updated';
        }
        $newId = $this->db->fetch('SELECT UUID() AS u')['u'];
        $this->db->execute(
            'INSERT INTO remquip_products
                (id, sku, name, description, price, stock, qbo_id, qbo_synced_at, created_at, updated_at)
             VALUES (:id, :sku, :name, :desc, :price, :stock, :qbo, NOW(), NOW(), NOW())',
            [
                'id'    => $newId,
                'sku'   => $sku ?: ('QBO-' . $qboId),
                'name'  => $name,
                'desc'  => $desc,
                'price' => $price,
                'stock' => $stock ?? 0,
                'qbo'   => $qboId,
            ]
        );
        $this->upsertMapping('product', $newId, $qboId, $i);
        return 'created';
    }

    private function buildQboItemPayload(array $row, array $defaults): array
    {
        $payload = [
            'Name'        => $row['name'] ?: ('SKU-' . $row['sku']),
            'Sku'         => $row['sku'] ?? null,
            'Description' => $row['description'] ?? null,
            'UnitPrice'   => isset($row['price']) ? (float)$row['price'] : 0,
            'Type'        => 'Inventory',
            'TrackQtyOnHand' => true,
            'QtyOnHand'      => isset($row['stock']) ? (int)$row['stock'] : 0,
            'InvStartDate'   => date('Y-m-d'),
        ];
        // Account refs are MANDATORY for Inventory items in QBO
        if ($defaults['income_account_id'])  $payload['IncomeAccountRef']            = ['value' => $defaults['income_account_id']];
        if ($defaults['expense_account_id']) $payload['ExpenseAccountRef']           = ['value' => $defaults['expense_account_id']];
        if ($defaults['asset_account_id'])   $payload['AssetAccountRef']             = ['value' => $defaults['asset_account_id']];

        // Fallback to NonInventory if accounts not chosen — admin should pick them in the dialog.
        if (!$defaults['income_account_id'] || !$defaults['expense_account_id'] || !$defaults['asset_account_id']) {
            $payload['Type'] = 'NonInventory';
            unset($payload['TrackQtyOnHand'], $payload['QtyOnHand'], $payload['InvStartDate'],
                  $payload['ExpenseAccountRef'], $payload['AssetAccountRef']);
        }
        return $payload;
    }

    private function itemAccountDefaults(): array
    {
        $cfg = $this->loadConfig();
        return [
            'income_account_id'  => $cfg['qbo_income_account_id']  ?? null,
            'expense_account_id' => $cfg['qbo_expense_account_id'] ?? null,
            'asset_account_id'   => $cfg['qbo_asset_account_id']   ?? null,
        ];
    }

    /* =================================================================
     *  INVOICES / ESTIMATES / PAYMENTS — pull only
     * ================================================================= */

    public function pullInvoices(): array
    {
        $start = 1; $page = 100; $processed = 0; $failed = 0;
        do {
            $batch = $this->client->listInvoices($start, $page);
            foreach ($batch as $inv) {
                try { $this->upsertMirrorInvoice($inv); $processed++; }
                catch (Throwable $e) { $failed++; Logger::error('mirror invoice', ['err' => $e->getMessage()]); }
            }
            $start += $page;
        } while (count($batch) === $page);
        return compact('processed', 'failed');
    }

    public function pullEstimates(): array
    {
        $start = 1; $page = 100; $processed = 0; $failed = 0;
        do {
            $batch = $this->client->listEstimates($start, $page);
            foreach ($batch as $est) {
                try { $this->upsertMirrorEstimate($est); $processed++; }
                catch (Throwable $e) { $failed++; }
            }
            $start += $page;
        } while (count($batch) === $page);
        return compact('processed', 'failed');
    }

    public function pullPayments(): array
    {
        $start = 1; $page = 100; $processed = 0; $failed = 0;
        do {
            $batch = $this->client->listPayments($start, $page);
            foreach ($batch as $pay) {
                try { $this->upsertMirrorPayment($pay); $processed++; }
                catch (Throwable $e) { $failed++; }
            }
            $start += $page;
        } while (count($batch) === $page);
        return compact('processed', 'failed');
    }

    public function pullAccounts(): array
    {
        $start = 1; $page = 200; $processed = 0;
        do {
            $batch = $this->client->listAccounts($start, $page);
            foreach ($batch as $a) {
                $qboId = (string) ($a['Id'] ?? '');
                if (!$qboId) continue;
                $existing = $this->db->fetch('SELECT id FROM remquip_qbo_accounts WHERE qbo_id = :q', ['q' => $qboId]);
                $params = [
                    'qbo'     => $qboId,
                    'name'    => $a['Name'] ?? '',
                    'type'    => $a['AccountType']    ?? null,
                    'sub'     => $a['AccountSubType'] ?? null,
                    'class'   => $a['Classification'] ?? null,
                    'cur'     => $a['CurrencyRef']['value'] ?? null,
                    'active'  => !empty($a['Active']) ? 1 : 0,
                ];
                if ($existing) {
                    $this->db->execute(
                        'UPDATE remquip_qbo_accounts
                         SET name=:name, account_type=:type, account_sub_type=:sub, classification=:class,
                             currency=:cur, active=:active, synced_at=NOW()
                         WHERE qbo_id=:qbo', $params);
                } else {
                    $params['id'] = $this->db->fetch('SELECT UUID() AS u')['u'];
                    $this->db->execute(
                        'INSERT INTO remquip_qbo_accounts (id, qbo_id, name, account_type, account_sub_type, classification, currency, active)
                         VALUES (:id, :qbo, :name, :type, :sub, :class, :cur, :active)', $params);
                }
                $processed++;
            }
            $start += $page;
        } while (count($batch) === $page);
        return compact('processed');
    }

    public function pullSingleInvoice(string $qboId): void
    {
        $inv = $this->client->getInvoice($qboId);
        if ($inv) $this->upsertMirrorInvoice($inv);
    }
    public function pullSinglePayment(string $qboId): void
    {
        $p = $this->client->getPayment($qboId);
        if ($p) $this->upsertMirrorPayment($p);
    }
    public function pullSingleEstimate(string $qboId): void
    {
        $e = $this->client->getEstimate($qboId);
        if ($e) $this->upsertMirrorEstimate($e);
    }

    private function upsertMirrorInvoice(array $inv): void
    {
        $qboId = (string)($inv['Id'] ?? '');
        if (!$qboId) return;
        $qboCust = (string)($inv['CustomerRef']['value'] ?? '');
        $localCust = $qboCust ? $this->resolveLocalCustomerId($qboCust) : null;

        $params = [
            'qbo'    => $qboId,
            'doc'    => $inv['DocNumber'] ?? null,
            'qcust'  => $qboCust ?: null,
            'lcust'  => $localCust,
            'txn'    => $inv['TxnDate']  ?? null,
            'due'    => $inv['DueDate']  ?? null,
            'cur'    => $inv['CurrencyRef']['value'] ?? null,
            'total'  => isset($inv['TotalAmt']) ? (float)$inv['TotalAmt'] : null,
            'bal'    => isset($inv['Balance'])  ? (float)$inv['Balance']  : null,
            'status' => $this->invoiceStatus($inv),
            'estatus'=> $inv['EmailStatus'] ?? null,
            'priv'   => $inv['PrivateNote'] ?? null,
            'memo'   => $inv['CustomerMemo']['value'] ?? null,
            'raw'    => json_encode($inv, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'qup'    => $this->parseQboTime($inv['MetaData']['LastUpdatedTime'] ?? null),
        ];
        $existing = $this->db->fetch('SELECT id FROM remquip_qbo_invoices WHERE qbo_id = :qbo', ['qbo' => $qboId]);
        if ($existing) {
            $this->db->execute(
                'UPDATE remquip_qbo_invoices
                 SET qbo_doc_number=:doc, qbo_customer_id=:qcust, local_customer_id=:lcust, txn_date=:txn,
                     due_date=:due, currency=:cur, total_amt=:total, balance=:bal, status=:status,
                     email_status=:estatus, private_note=:priv, customer_memo=:memo, raw=:raw,
                     qbo_updated_at=:qup, synced_at=NOW()
                 WHERE qbo_id=:qbo', $params);
        } else {
            $params['id'] = $this->db->fetch('SELECT UUID() AS u')['u'];
            $this->db->execute(
                'INSERT INTO remquip_qbo_invoices
                    (id, qbo_id, qbo_doc_number, qbo_customer_id, local_customer_id, txn_date, due_date,
                     currency, total_amt, balance, status, email_status, private_note, customer_memo, raw, qbo_updated_at)
                 VALUES (:id, :qbo, :doc, :qcust, :lcust, :txn, :due, :cur, :total, :bal, :status, :estatus, :priv, :memo, :raw, :qup)',
                $params);
        }
    }

    private function upsertMirrorEstimate(array $est): void
    {
        $qboId = (string)($est['Id'] ?? '');
        if (!$qboId) return;
        $qboCust = (string)($est['CustomerRef']['value'] ?? '');
        $localCust = $qboCust ? $this->resolveLocalCustomerId($qboCust) : null;
        $params = [
            'qbo'    => $qboId,
            'doc'    => $est['DocNumber'] ?? null,
            'qcust'  => $qboCust ?: null,
            'lcust'  => $localCust,
            'txn'    => $est['TxnDate']        ?? null,
            'exp'    => $est['ExpirationDate'] ?? null,
            'cur'    => $est['CurrencyRef']['value'] ?? null,
            'total'  => isset($est['TotalAmt']) ? (float)$est['TotalAmt'] : null,
            'status' => $est['TxnStatus']    ?? null,
            'acc'    => $est['AcceptedDate'] ?? null,
            'memo'   => $est['CustomerMemo']['value'] ?? null,
            'raw'    => json_encode($est, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'qup'    => $this->parseQboTime($est['MetaData']['LastUpdatedTime'] ?? null),
        ];
        $existing = $this->db->fetch('SELECT id FROM remquip_qbo_estimates WHERE qbo_id = :qbo', ['qbo' => $qboId]);
        if ($existing) {
            $this->db->execute(
                'UPDATE remquip_qbo_estimates
                 SET qbo_doc_number=:doc, qbo_customer_id=:qcust, local_customer_id=:lcust, txn_date=:txn,
                     expiration_date=:exp, currency=:cur, total_amt=:total, status=:status, accepted_date=:acc,
                     customer_memo=:memo, raw=:raw, qbo_updated_at=:qup, synced_at=NOW()
                 WHERE qbo_id=:qbo', $params);
        } else {
            $params['id'] = $this->db->fetch('SELECT UUID() AS u')['u'];
            $this->db->execute(
                'INSERT INTO remquip_qbo_estimates
                    (id, qbo_id, qbo_doc_number, qbo_customer_id, local_customer_id, txn_date, expiration_date,
                     currency, total_amt, status, accepted_date, customer_memo, raw, qbo_updated_at)
                 VALUES (:id, :qbo, :doc, :qcust, :lcust, :txn, :exp, :cur, :total, :status, :acc, :memo, :raw, :qup)',
                $params);
        }
    }

    private function upsertMirrorPayment(array $p): void
    {
        $qboId = (string)($p['Id'] ?? '');
        if (!$qboId) return;
        $qboCust = (string)($p['CustomerRef']['value'] ?? '');
        $localCust = $qboCust ? $this->resolveLocalCustomerId($qboCust) : null;
        $linked = [];
        foreach (($p['Line'] ?? []) as $line) {
            foreach (($line['LinkedTxn'] ?? []) as $lt) {
                if (($lt['TxnType'] ?? '') === 'Invoice') $linked[] = $lt['TxnId'] ?? null;
            }
        }
        $params = [
            'qbo'    => $qboId,
            'qcust'  => $qboCust ?: null,
            'lcust'  => $localCust,
            'txn'    => $p['TxnDate'] ?? null,
            'cur'    => $p['CurrencyRef']['value'] ?? null,
            'total'  => isset($p['TotalAmt'])    ? (float)$p['TotalAmt']    : null,
            'unapp'  => isset($p['UnappliedAmt'])? (float)$p['UnappliedAmt']: null,
            'pm'     => $p['PaymentMethodRef']['name'] ?? null,
            'pref'   => $p['PaymentRefNum'] ?? null,
            'links'  => json_encode(array_values(array_filter($linked))),
            'raw'    => json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'qup'    => $this->parseQboTime($p['MetaData']['LastUpdatedTime'] ?? null),
        ];
        $existing = $this->db->fetch('SELECT id FROM remquip_qbo_payments WHERE qbo_id = :qbo', ['qbo' => $qboId]);
        if ($existing) {
            $this->db->execute(
                'UPDATE remquip_qbo_payments
                 SET qbo_customer_id=:qcust, local_customer_id=:lcust, txn_date=:txn, currency=:cur,
                     total_amt=:total, unapplied_amt=:unapp, payment_method=:pm, payment_ref_num=:pref,
                     linked_invoice_ids=:links, raw=:raw, qbo_updated_at=:qup, synced_at=NOW()
                 WHERE qbo_id=:qbo', $params);
        } else {
            $params['id'] = $this->db->fetch('SELECT UUID() AS u')['u'];
            $this->db->execute(
                'INSERT INTO remquip_qbo_payments
                    (id, qbo_id, qbo_customer_id, local_customer_id, txn_date, currency, total_amt,
                     unapplied_amt, payment_method, payment_ref_num, linked_invoice_ids, raw, qbo_updated_at)
                 VALUES (:id, :qbo, :qcust, :lcust, :txn, :cur, :total, :unapp, :pm, :pref, :links, :raw, :qup)',
                $params);
        }
    }

    private function invoiceStatus(array $inv): string
    {
        $bal = (float) ($inv['Balance'] ?? 0);
        $tot = (float) ($inv['TotalAmt'] ?? 0);
        if ($bal <= 0 && $tot > 0) return 'Paid';
        if ($bal > 0 && $bal < $tot) return 'PartiallyPaid';
        if (!empty($inv['DueDate']) && strtotime($inv['DueDate']) < time() && $bal > 0) return 'Overdue';
        return 'Pending';
    }

    /* =================================================================
     *  Mapping + helpers
     * ================================================================= */

    private function resolveLocalCustomerId(string $qboCustomerId): ?string
    {
        $row = $this->db->fetch(
            'SELECT id FROM remquip_customers WHERE qbo_id = :q LIMIT 1',
            ['q' => $qboCustomerId]
        );
        return $row['id'] ?? null;
    }

    private function upsertMapping(string $entityType, string $localId, string $externalId, ?array $metadata = null): void
    {
        $existing = $this->db->fetch(
            'SELECT id FROM remquip_integration_mappings
             WHERE integration_id = :i AND entity_type = :t AND local_id = :l LIMIT 1',
            ['i' => $this->integrationId, 't' => $entityType, 'l' => $localId]
        );
        $meta = $metadata ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
        if ($existing) {
            $this->db->execute(
                'UPDATE remquip_integration_mappings
                 SET external_id = :e, metadata = :m, last_synced_at = NOW(), updated_at = NOW()
                 WHERE id = :id',
                ['e' => $externalId, 'm' => $meta, 'id' => $existing['id']]
            );
        } else {
            $newId = $this->db->fetch('SELECT UUID() AS u')['u'];
            $this->db->execute(
                'INSERT INTO remquip_integration_mappings
                    (id, integration_id, entity_type, local_id, external_id, metadata, last_synced_at)
                 VALUES (:id, :i, :t, :l, :e, :m, NOW())',
                ['id' => $newId, 'i' => $this->integrationId, 't' => $entityType,
                 'l' => $localId, 'e' => $externalId, 'm' => $meta]
            );
        }
    }

    private function loadConfig(): array
    {
        $row = $this->db->fetch('SELECT config FROM remquip_integrations WHERE provider = \'quickbooks\'');
        return $row && $row['config'] ? (json_decode($row['config'], true) ?: []) : [];
    }

    private function parseQboTime(?string $iso): ?string
    {
        if (!$iso) return null;
        $ts = strtotime($iso);
        return $ts ? date('Y-m-d H:i:s', $ts) : null;
    }
}

<?php
/**
 * INVOICES ROUTES — Standalone invoice management for accounting
 */

$method = $_SERVER['REQUEST_METHOD'];

// ── GET /invoices — paginated list ──
if ($method === 'GET' && (!$id || $id === 'search')) {
    Auth::requireAuth('admin');
    try {
        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $search        = trim($_GET['search'] ?? $_GET['q'] ?? '');
        $status        = trim($_GET['status'] ?? '');
        $paymentStatus = trim($_GET['payment_status'] ?? '');

        $where  = ['i.deleted_at IS NULL'];
        $params = [];

        if ($search) {
            $where[] = "(i.invoice_number LIKE :search OR c.company_name LIKE :search OR c.email LIKE :search)";
            $params['search'] = "%$search%";
        }
        if ($status) {
            $where[] = "i.status = :status";
            $params['status'] = $status;
        }
        if ($paymentStatus) {
            $where[] = "i.payment_status = :ps";
            $params['ps'] = $paymentStatus;
        }

        $wc = implode(' AND ', $where);

        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_invoices i LEFT JOIN remquip_customers c ON i.customer_id = c.id WHERE $wc",
            $params
        )['total'] ?? 0;

        $params['limit']  = $limit;
        $params['offset'] = $offset;

        $invoices = $conn->fetchAll(
            "SELECT i.id, i.invoice_number, i.customer_id,
                    COALESCE(c.company_name, i.customer_name) as customer_name,
                    COALESCE(c.email, i.customer_email) as customer_email,
                    COALESCE(c.phone, i.customer_phone) as customer_phone,
                    (SELECT COUNT(*) FROM remquip_invoice_items WHERE invoice_id = i.id) as item_count,
                    i.subtotal, i.tax, i.shipping, i.discount, i.total, i.amount_paid, i.balance_due,
                    i.status, i.payment_status, i.payment_method,
                    i.issue_date, i.due_date, i.paid_date,
                    i.order_id, i.offer_id,
                    i.notes, i.created_by, i.created_at, i.updated_at
             FROM remquip_invoices i
             LEFT JOIN remquip_customers c ON i.customer_id = c.id
             WHERE $wc
             ORDER BY i.created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );

        ResponseHelper::sendPaginated($invoices, $total, $limit, $offset, 'Invoices retrieved');
    } catch (Exception $e) {
        Logger::error('Get invoices error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve invoices', 500);
    }
}

// ── GET /invoices/stats — summary statistics ──
if ($method === 'GET' && $id === 'stats') {
    Auth::requireAuth('admin');
    try {
        $stats = $conn->fetch(
            "SELECT
                COUNT(*) as total_invoices,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                COALESCE(SUM(total), 0) as total_invoiced,
                COALESCE(SUM(amount_paid), 0) as total_collected,
                COALESCE(SUM(total - amount_paid), 0) as total_outstanding
             FROM remquip_invoices WHERE deleted_at IS NULL"
        );
        ResponseHelper::sendSuccess($stats, 'Invoice stats');
    } catch (Exception $e) {
        Logger::error('Invoice stats error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to get invoice stats', 500);
    }
}

// ── GET /invoices/:id — detail with items + payments ──
if ($method === 'GET' && $id && $id !== 'search' && $id !== 'stats' && !$action) {
    Auth::requireAuth('admin');
    try {
        $invoice = $conn->fetch(
            "SELECT i.*,
                    COALESCE(c.company_name, i.customer_name) as company_name,
                    COALESCE(c.contact_person, i.customer_name) as contact_person,
                    COALESCE(c.email, i.customer_email) as customer_email,
                    COALESCE(c.phone, i.customer_phone) as customer_phone
             FROM remquip_invoices i
             LEFT JOIN remquip_customers c ON i.customer_id = c.id
             WHERE i.id = :id AND i.deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$invoice) { ResponseHelper::sendError('Invoice not found', 404); }

        $invoice['items'] = $conn->fetchAll(
            "SELECT ii.id, ii.product_id, ii.product_name, ii.sku, ii.description, ii.quantity, ii.unit_price, ii.line_total, ii.notes,
                    p.name as product_name_live, p.sku as product_sku_live
             FROM remquip_invoice_items ii
             LEFT JOIN remquip_products p ON ii.product_id = p.id
             WHERE ii.invoice_id = :id",
            ['id' => $id]
        );

        $invoice['payments'] = $conn->fetchAll(
            "SELECT id, amount, payment_method, reference, notes, paid_at, created_by, created_at
             FROM remquip_invoice_payments WHERE invoice_id = :id ORDER BY paid_at DESC",
            ['id' => $id]
        );

        ResponseHelper::sendSuccess($invoice, 'Invoice details retrieved');
    } catch (Exception $e) {
        Logger::error('Get invoice error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve invoice', 500);
    }
}

// ── POST /invoices — create new invoice ──
if ($method === 'POST' && !$id) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $customerId = $data['customer_id'] ?? $data['customerId'] ?? null;
        $rawItems   = $data['items'] ?? [];

        $manualName  = $data['customer_name'] ?? $data['customerName'] ?? null;
        $manualEmail = $data['customer_email'] ?? $data['customerEmail'] ?? null;
        $manualPhone = $data['customer_phone'] ?? $data['customerPhone'] ?? null;
        // customer_id is now optional — manual details serve as fallback
        if (!is_array($rawItems) || empty($rawItems)) { ResponseHelper::sendError('At least one item is required', 400); }

        // Parse items
        $items = [];
        foreach ($rawItems as $item) {
            $pid  = $item['product_id'] ?? $item['productId'] ?? null;
            $qty  = (int)($item['quantity'] ?? 1);
            $up   = (float)($item['unit_price'] ?? $item['unitPrice'] ?? 0);
            $name = $item['product_name'] ?? $item['name'] ?? '';
            $sku  = $item['sku'] ?? '';
            $desc = $item['description'] ?? null;
            $note = $item['notes'] ?? null;
            if ($qty < 1) $qty = 1;
            $items[] = [
                'productId' => $pid, 'quantity' => $qty, 'unitPrice' => $up,
                'name' => $name, 'sku' => $sku, 'description' => $desc, 'notes' => $note,
            ];
        }

        // Compute totals
        $subtotal = 0;
        foreach ($items as $item) { $subtotal += $item['quantity'] * $item['unitPrice']; }
        $subtotal = round($subtotal, 2);
        $discount = round((float)($data['discount'] ?? 0), 2);
        $tax      = round((float)($data['tax'] ?? 0), 2);
        $shipping = round((float)($data['shipping'] ?? 0), 2);

        // Compute tax if not manually provided
        $taxBreakdownJson = null;
        if ($tax == 0 && $subtotal > 0) {
            $taxRates = get_active_tax_rates($conn);
            if (!empty($taxRates)) {
                $taxableBase = max(0, $subtotal - $discount);
                $result = compute_tax_breakdown($taxableBase, $taxRates);
                $tax = $result['total_tax'];
                $taxBreakdownJson = json_encode($result['breakdown']);
            }
        }
        if ($taxBreakdownJson === null && isset($data['tax_breakdown']) && is_array($data['tax_breakdown'])) {
            $taxBreakdownJson = json_encode($data['tax_breakdown']);
        }

        $total = round($subtotal - $discount + $tax + $shipping, 2);

        $issueDate = $data['issue_date'] ?? $data['issueDate'] ?? date('Y-m-d');
        $dueDate   = $data['due_date'] ?? $data['dueDate'] ?? null;
        $notes     = $data['notes'] ?? null;
        $intNotes  = $data['internal_notes'] ?? $data['internalNotes'] ?? null;
        $status    = $data['status'] ?? 'draft';
        $orderId   = $data['order_id'] ?? $data['orderId'] ?? null;
        $offerId   = $data['offer_id'] ?? $data['offerId'] ?? null;
        $payMethod = $data['payment_method'] ?? $data['paymentMethod'] ?? null;

        if (!in_array($status, ['draft','sent'], true)) $status = 'draft';

        $tok     = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $createdBy = $payload['user_id'] ?? null;

        $invoiceNumber = 'INV-' . date('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $invoiceId     = $conn->fetch('SELECT UUID() AS u')['u'];

        $conn->execute(
             "INSERT INTO remquip_invoices (id, invoice_number, customer_id, customer_name, customer_email, customer_phone,
              order_id, offer_id, status, payment_status,
              issue_date, due_date, subtotal, tax, tax_breakdown, shipping, discount, total, amount_paid, balance_due,
              payment_method, notes, internal_notes, created_by)
              VALUES (:id, :num, :cid, :cname, :cemail, :cphone,
              :oid, :ofid, :status, 'unpaid',
              :issueDate, :dueDate, :sub, :tax, :taxBreakdown, :ship, :disc, :total, 0, :total,
              :payMethod, :notes, :intNotes, :by)",
            [
                'id' => $invoiceId, 'num' => $invoiceNumber, 'cid' => $customerId,
                'cname' => $manualName, 'cemail' => $manualEmail, 'cphone' => $manualPhone,
                'oid' => $orderId, 'ofid' => $offerId,
                'status' => $status, 'issueDate' => $issueDate, 'dueDate' => $dueDate,
                'sub' => $subtotal, 'tax' => $tax, 'ship' => $shipping,
                'disc' => $discount, 'total' => $total,
                'payMethod' => $payMethod, 'notes' => $notes, 'intNotes' => $intNotes,
                'by' => $createdBy, 'taxBreakdown' => $taxBreakdownJson,
            ]
        );
        foreach ($items as $item) {
            $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_invoice_items (id, invoice_id, product_id, product_name, sku, description, quantity, unit_price, line_total, notes)
                 VALUES (:id, :iid, :pid, :name, :sku, :desc, :qty, :up, :lt, :notes)",
                [
                    'id' => $lineId, 'iid' => $invoiceId, 'pid' => $item['productId'],
                    'name' => $item['name'], 'sku' => $item['sku'], 'desc' => $item['description'],
                    'qty' => $item['quantity'], 'up' => $item['unitPrice'],
                    'lt' => round($item['quantity'] * $item['unitPrice'], 2),
                    'notes' => $item['notes'],
                ]
            );
        }

        Logger::info('Invoice created', ['invoice_id' => $invoiceId, 'invoice_number' => $invoiceNumber]);
        ResponseHelper::sendSuccess(['id' => $invoiceId, 'invoice_number' => $invoiceNumber], 'Invoice created successfully', 201);
    } catch (Exception $e) {
        Logger::error('Create invoice error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create invoice', 500);
    }
}

// ── PUT /invoices/:id — update invoice fields + items ──
if (($method === 'PATCH' || $method === 'PUT') && $id && $id !== 'stats' && !$action) {
    Auth::requireAuth('admin');
    try {
        $data    = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params  = ['id' => $id];

        if (isset($data['customer_id']))      { $updates[] = 'customer_id = :cid';       $params['cid'] = $data['customer_id']; }
        if (isset($data['notes']))            { $updates[] = 'notes = :notes';           $params['notes'] = $data['notes']; }
        if (isset($data['internal_notes']))   { $updates[] = 'internal_notes = :inotes'; $params['inotes'] = $data['internal_notes']; }
        if (isset($data['payment_method']))   { $updates[] = 'payment_method = :pm';     $params['pm'] = $data['payment_method']; }
        if (isset($data['payment_reference'])){ $updates[] = 'payment_reference = :pr';  $params['pr'] = $data['payment_reference']; }

        if (array_key_exists('due_date', $data) || array_key_exists('dueDate', $data)) {
            $dd = $data['due_date'] ?? $data['dueDate'] ?? null;
            if ($dd === null || trim((string)$dd) === '') { $updates[] = 'due_date = NULL'; }
            else { $updates[] = 'due_date = :dd'; $params['dd'] = $dd; }
        }
        if (isset($data['issue_date'])) { $updates[] = 'issue_date = :idate'; $params['idate'] = $data['issue_date']; }
        if (isset($data['discount']))   { $updates[] = 'discount = :disc';    $params['disc'] = round((float)$data['discount'], 2); }
        if (isset($data['tax']))        { $updates[] = 'tax = :tax';          $params['tax']  = round((float)$data['tax'], 2); }
        if (isset($data['shipping']))   { $updates[] = 'shipping = :ship';    $params['ship'] = round((float)$data['shipping'], 2); }

        // Replace items if provided
        if (isset($data['items']) && is_array($data['items'])) {
            $conn->execute("DELETE FROM remquip_invoice_items WHERE invoice_id = :iid", ['iid' => $id]);
            $subtotal = 0;
            foreach ($data['items'] as $item) {
                $pid  = $item['product_id'] ?? $item['productId'] ?? null;
                $qty  = max(1, (int)($item['quantity'] ?? 1));
                $up   = (float)($item['unit_price'] ?? $item['unitPrice'] ?? 0);
                $lt   = round($qty * $up, 2);
                $subtotal += $lt;
                $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
                $conn->execute(
                    "INSERT INTO remquip_invoice_items (id, invoice_id, product_id, product_name, sku, description, quantity, unit_price, line_total, notes)
                     VALUES (:id, :iid, :pid, :name, :sku, :desc, :qty, :up, :lt, :notes)",
                    [
                        'id' => $lineId, 'iid' => $id, 'pid' => $pid,
                        'name' => $item['product_name'] ?? $item['name'] ?? '',
                        'sku' => $item['sku'] ?? '',
                        'desc' => $item['description'] ?? null,
                        'qty' => $qty, 'up' => $up, 'lt' => $lt,
                        'notes' => $item['notes'] ?? null,
                    ]
                );
            }
            $subtotal = round($subtotal, 2);
            $updates[] = 'subtotal = :sub'; $params['sub'] = $subtotal;
            $row = $conn->fetch('SELECT tax, shipping, discount FROM remquip_invoices WHERE id = :id', ['id' => $id]);
            $tax_v  = isset($params['tax'])  ? $params['tax']  : (float)($row['tax'] ?? 0);
            $ship_v = isset($params['ship']) ? $params['ship'] : (float)($row['shipping'] ?? 0);
            $disc_v = isset($params['disc']) ? $params['disc'] : (float)($row['discount'] ?? 0);
            $total  = round($subtotal - $disc_v + $tax_v + $ship_v, 2);
            $updates[] = 'total = :total'; $params['total'] = $total;
        }

        if (!$updates) { ResponseHelper::sendError('No fields to update', 400); }
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_invoices SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);

        Logger::info('Invoice updated', ['invoice_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Invoice updated successfully');
    } catch (Exception $e) {
        Logger::error('Update invoice error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update invoice', 500);
    }
}

// ── PUT /invoices/:id/status — change status ──
if (($method === 'PATCH' || $method === 'PUT') && $id && $action === 'status') {
    Auth::requireAuth('admin');
    try {
        $data   = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = trim($data['status'] ?? '');
        if (!in_array($status, ['draft','sent','paid','partially_paid','overdue','cancelled','refunded'], true)) {
            ResponseHelper::sendError('Invalid status', 400);
        }

        $paymentStatus = null;
        if ($status === 'paid') $paymentStatus = 'paid';
        if ($status === 'partially_paid') $paymentStatus = 'partial';
        if ($status === 'refunded') $paymentStatus = 'refunded';
        if ($status === 'cancelled') $paymentStatus = 'unpaid';

        $sql = "UPDATE remquip_invoices SET status = :status";
        $p   = ['status' => $status, 'id' => $id];

        if ($paymentStatus) {
            $sql .= ", payment_status = :ps";
            $p['ps'] = $paymentStatus;
        }
        if ($status === 'paid') {
            $sql .= ", paid_date = CURDATE(), amount_paid = total, balance_due = 0";
        }

        $sql .= ", updated_at = NOW() WHERE id = :id AND deleted_at IS NULL";
        $conn->execute($sql, $p);

        Logger::info('Invoice status updated', ['invoice_id' => $id, 'status' => $status]);
        ResponseHelper::sendSuccess(['id' => $id, 'status' => $status], 'Invoice status updated');
    } catch (Exception $e) {
        Logger::error('Update invoice status error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update invoice status', 500);
    }
}

// ── POST /invoices/:id/payments — record a payment ──
if ($method === 'POST' && $id && $action === 'payments') {
    Auth::requireAuth('admin');
    try {
        $data   = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = round((float)($data['amount'] ?? 0), 2);
        if ($amount <= 0) { ResponseHelper::sendError('Amount must be positive', 400); }

        $invoice = $conn->fetch("SELECT id, total, amount_paid FROM remquip_invoices WHERE id = :id AND deleted_at IS NULL", ['id' => $id]);
        if (!$invoice) { ResponseHelper::sendError('Invoice not found', 404); }

        $tok     = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $createdBy = $payload['user_id'] ?? null;

        $payId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_invoice_payments (id, invoice_id, amount, payment_method, reference, notes, paid_at, created_by)
             VALUES (:id, :iid, :amount, :pm, :ref, :notes, :paidAt, :by)",
            [
                'id' => $payId, 'iid' => $id, 'amount' => $amount,
                'pm' => $data['payment_method'] ?? null,
                'ref' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'paidAt' => $data['paid_at'] ?? date('Y-m-d H:i:s'),
                'by' => $createdBy,
            ]
        );

        // Update invoice amount_paid and statuses
        $newPaid = (float)$invoice['amount_paid'] + $amount;
        $total   = (float)$invoice['total'];
        $ps      = $newPaid >= $total ? 'paid' : ($newPaid > 0 ? 'partial' : 'unpaid');
        $st      = $newPaid >= $total ? 'paid' : 'partially_paid';
        $paidDate = $newPaid >= $total ? date('Y-m-d') : null;

        $balanceDue = round($total - $newPaid, 2);
        $conn->execute(
            "UPDATE remquip_invoices SET amount_paid = :ap, balance_due = :bd, payment_status = :ps, status = :st, paid_date = :pd, updated_at = NOW() WHERE id = :id",
            ['ap' => $newPaid, 'bd' => $balanceDue, 'ps' => $ps, 'st' => $st, 'pd' => $paidDate, 'id' => $id]
        );

        Logger::info('Invoice payment recorded', ['invoice_id' => $id, 'payment_id' => $payId, 'amount' => $amount]);
        ResponseHelper::sendSuccess(['id' => $payId, 'new_amount_paid' => $newPaid, 'payment_status' => $ps], 'Payment recorded', 201);
    } catch (Exception $e) {
        Logger::error('Record payment error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to record payment', 500);
    }
}

// ── POST /invoices/:id/send — email the invoice to the customer ──
if ($method === 'POST' && $id && $action === 'send') {
    Auth::requireAuth('admin');
    try {
        $data          = json_decode(file_get_contents('php://input'), true) ?? [];
        $customMessage = !empty($data['message']) ? trim($data['message']) : null;
        $customSubject = !empty($data['subject']) ? trim($data['subject']) : null;

        $invoice = $conn->fetch(
            "SELECT id, status FROM remquip_invoices WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$invoice) { ResponseHelper::sendError('Invoice not found', 404); }

        $sent = remquip_notify_invoice_sent($conn, $id, $customMessage, $customSubject);

        // Auto-advance status from draft → sent when emailing the customer
        if ($invoice['status'] === 'draft') {
            $conn->execute(
                "UPDATE remquip_invoices SET status = 'sent', updated_at = NOW() WHERE id = :id",
                ['id' => $id]
            );
        }

        if ($sent) {
            Logger::info('Invoice emailed to customer', ['invoice_id' => $id]);
            ResponseHelper::sendSuccess(['sent' => true], 'Invoice sent to customer successfully');
        } else {
            ResponseHelper::sendError('Failed to send email — check SMTP configuration', 500);
        }
    } catch (Exception $e) {
        Logger::error('Send invoice email error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to send invoice email', 500);
    }
}

// ── DELETE /invoices/:id — soft delete ──
if ($method === 'DELETE' && $id && !$action) {
    Auth::requireAuth('admin');
    try {
        $conn->execute(
            "UPDATE remquip_invoices SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        Logger::info('Invoice deleted', ['invoice_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Invoice deleted');
    } catch (Exception $e) {
        Logger::error('Delete invoice error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete invoice', 500);
    }
}

<?php
/**
 * OFFERS ROUTES — Sales Offers / Quotes management
 */

$method = $_SERVER['REQUEST_METHOD'];

// ── GET /offers — paginated list ──
if ($method === 'GET' && (!$id || $id === 'search')) {
    Auth::requireAuth('admin');
    try {
        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $search = trim($_GET['search'] ?? $_GET['q'] ?? '');
        $status = trim($_GET['status'] ?? '');

        $where  = ['o.deleted_at IS NULL'];
        $params = [];

        if ($search) {
            $where[] = "(o.offer_number LIKE :search OR c.company_name LIKE :search OR c.email LIKE :search)";
            $params['search'] = "%$search%";
        }
        if ($status) {
            $where[] = "o.status = :status";
            $params['status'] = $status;
        }

        $wc = implode(' AND ', $where);

        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_offers o LEFT JOIN remquip_customers c ON o.customer_id = c.id WHERE $wc",
            $params
        )['total'] ?? 0;

        $params['limit']  = $limit;
        $params['offset'] = $offset;

        $offers = $conn->fetchAll(
            "SELECT o.id, o.offer_number, o.customer_id,
                    c.company_name as customer_name, c.email as customer_email, c.phone as customer_phone,
                    (SELECT COUNT(*) FROM remquip_offer_items WHERE offer_id = o.id) as item_count,
                    o.subtotal, o.tax, o.shipping, o.discount, o.total,
                    o.status, o.valid_until, o.notes, o.created_by, o.created_at, o.updated_at
             FROM remquip_offers o
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE $wc
             ORDER BY o.created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );

        ResponseHelper::sendPaginated($offers, $total, $limit, $offset, 'Offers retrieved');
    } catch (Exception $e) {
        Logger::error('Get offers error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve offers', 500);
    }
}

// ── GET /offers/:id — detail with items + documents ──
if ($method === 'GET' && $id && !$action) {
    Auth::requireAuth('admin');
    try {
        $offer = $conn->fetch(
            "SELECT o.*, c.company_name, c.contact_person, c.email as customer_email, c.phone as customer_phone
             FROM remquip_offers o
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE o.id = :id AND o.deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$offer) { ResponseHelper::sendError('Offer not found', 404); }

        $offer['items'] = $conn->fetchAll(
            "SELECT oi.id, oi.product_id, oi.product_name, oi.sku, oi.quantity, oi.unit_price, oi.line_total, oi.notes,
                    p.name as product_name_live, p.sku as product_sku_live
             FROM remquip_offer_items oi
             LEFT JOIN remquip_products p ON oi.product_id = p.id
             WHERE oi.offer_id = :id",
            ['id' => $id]
        );

        $offer['documents'] = $conn->fetchAll(
            "SELECT id, file_url, file_name, document_type, uploaded_by, created_at
             FROM remquip_offer_documents WHERE offer_id = :id ORDER BY created_at DESC",
            ['id' => $id]
        );

        ResponseHelper::sendSuccess($offer, 'Offer details retrieved');
    } catch (Exception $e) {
        Logger::error('Get offer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve offer', 500);
    }
}

// ── POST /offers — create new offer ──
if ($method === 'POST' && !$id) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $customerId = $data['customer_id'] ?? $data['customerId'] ?? null;
        $rawItems   = $data['items'] ?? [];

        if (!$customerId) { ResponseHelper::sendError('Customer is required', 400); }
        if (!is_array($rawItems) || empty($rawItems)) { ResponseHelper::sendError('At least one item is required', 400); }

        // Parse items
        $items = [];
        foreach ($rawItems as $item) {
            $pid  = $item['product_id'] ?? $item['productId'] ?? null;
            $qty  = (int)($item['quantity'] ?? 1);
            $up   = (float)($item['unit_price'] ?? $item['unitPrice'] ?? 0);
            $name = $item['product_name'] ?? $item['name'] ?? '';
            $sku  = $item['sku'] ?? '';
            $note = $item['notes'] ?? null;
            if ($qty < 1) $qty = 1;
            $items[] = [
                'productId' => $pid, 'quantity' => $qty, 'unitPrice' => $up,
                'name' => $name, 'sku' => $sku, 'notes' => $note,
            ];
        }

        // Compute totals
        $subtotal = 0;
        foreach ($items as $item) { $subtotal += $item['quantity'] * $item['unitPrice']; }
        $subtotal = round($subtotal, 2);
        $discount = round((float)($data['discount'] ?? 0), 2);
        $tax      = round((float)($data['tax'] ?? 0), 2);
        $shipping = round((float)($data['shipping'] ?? 0), 2);

        // Compute tax breakdown from DB tax rates if tax not manually specified
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
        // If tax was manually provided, try to parse breakdown from data
        if ($taxBreakdownJson === null && isset($data['tax_breakdown']) && is_array($data['tax_breakdown'])) {
            $taxBreakdownJson = json_encode($data['tax_breakdown']);
        }

        $total    = round($subtotal - $discount + $tax + $shipping, 2);

        $validUntil = $data['valid_until'] ?? $data['validUntil'] ?? null;
        $notes      = $data['notes'] ?? null;
        $status     = $data['status'] ?? 'draft';
        if (!in_array($status, ['draft','sent'], true)) $status = 'draft';

        $tok     = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $createdBy = $payload['user_id'] ?? null;

        $offerNumber = 'OFR-' . date('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $offerId     = $conn->fetch('SELECT UUID() AS u')['u'];

        $conn->execute(
            "INSERT INTO remquip_offers (id, offer_number, customer_id, status, subtotal, tax, shipping, discount, total, tax_breakdown, valid_until, notes, created_by)
             VALUES (:id, :num, :cid, :status, :sub, :tax, :ship, :disc, :total, :taxBreakdown, :valid, :notes, :by)",
            [
                'id' => $offerId, 'num' => $offerNumber, 'cid' => $customerId,
                'status' => $status, 'sub' => $subtotal, 'tax' => $tax, 'ship' => $shipping,
                'disc' => $discount, 'total' => $total, 'valid' => $validUntil,
                'notes' => $notes, 'by' => $createdBy,
                'taxBreakdown' => $taxBreakdownJson,
            ]
        );

        // Insert line items
        foreach ($items as $item) {
            $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_offer_items (id, offer_id, product_id, product_name, sku, quantity, unit_price, line_total, notes)
                 VALUES (:id, :oid, :pid, :name, :sku, :qty, :up, :lt, :notes)",
                [
                    'id' => $lineId, 'oid' => $offerId, 'pid' => $item['productId'],
                    'name' => $item['name'], 'sku' => $item['sku'],
                    'qty' => $item['quantity'], 'up' => $item['unitPrice'],
                    'lt' => round($item['quantity'] * $item['unitPrice'], 2),
                    'notes' => $item['notes'],
                ]
            );
        }

        Logger::info('Offer created', ['offer_id' => $offerId, 'offer_number' => $offerNumber]);
        ResponseHelper::sendSuccess(['id' => $offerId, 'offer_number' => $offerNumber], 'Offer created successfully', 201);
    } catch (Exception $e) {
        Logger::error('Create offer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create offer', 500);
    }
}

// ── PUT /offers/:id — update offer fields + items ──
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    Auth::requireAuth('admin');
    try {
        $data    = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params  = ['id' => $id];

        if (isset($data['customer_id'])) { $updates[] = 'customer_id = :cid'; $params['cid'] = $data['customer_id']; }
        if (isset($data['notes']))       { $updates[] = 'notes = :notes';     $params['notes'] = $data['notes']; }
        if (array_key_exists('valid_until', $data) || array_key_exists('validUntil', $data)) {
            $vu = $data['valid_until'] ?? $data['validUntil'] ?? null;
            if ($vu === null || trim((string)$vu) === '') { $updates[] = 'valid_until = NULL'; }
            else { $updates[] = 'valid_until = :vu'; $params['vu'] = $vu; }
        }
        if (isset($data['discount'])) { $updates[] = 'discount = :disc'; $params['disc'] = round((float)$data['discount'], 2); }
        if (isset($data['tax']))      { $updates[] = 'tax = :tax';       $params['tax']  = round((float)$data['tax'], 2); }
        if (isset($data['shipping'])) { $updates[] = 'shipping = :ship'; $params['ship'] = round((float)$data['shipping'], 2); }

        // Replace items if provided
        if (isset($data['items']) && is_array($data['items'])) {
            $conn->execute("DELETE FROM remquip_offer_items WHERE offer_id = :oid", ['oid' => $id]);
            $subtotal = 0;
            foreach ($data['items'] as $item) {
                $pid  = $item['product_id'] ?? $item['productId'] ?? null;
                $qty  = max(1, (int)($item['quantity'] ?? 1));
                $up   = (float)($item['unit_price'] ?? $item['unitPrice'] ?? 0);
                $lt   = round($qty * $up, 2);
                $subtotal += $lt;
                $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
                $conn->execute(
                    "INSERT INTO remquip_offer_items (id, offer_id, product_id, product_name, sku, quantity, unit_price, line_total, notes)
                     VALUES (:id, :oid, :pid, :name, :sku, :qty, :up, :lt, :notes)",
                    [
                        'id' => $lineId, 'oid' => $id, 'pid' => $pid,
                        'name' => $item['product_name'] ?? $item['name'] ?? '',
                        'sku' => $item['sku'] ?? '',
                        'qty' => $qty, 'up' => $up, 'lt' => $lt,
                        'notes' => $item['notes'] ?? null,
                    ]
                );
            }
            $subtotal = round($subtotal, 2);
            $updates[] = 'subtotal = :sub'; $params['sub'] = $subtotal;
            // Recompute total
            $row = $conn->fetch('SELECT tax, shipping, discount FROM remquip_offers WHERE id = :id', ['id' => $id]);
            $tax_v  = isset($params['tax'])  ? $params['tax']  : (float)($row['tax'] ?? 0);
            $ship_v = isset($params['ship']) ? $params['ship'] : (float)($row['shipping'] ?? 0);
            $disc_v = isset($params['disc']) ? $params['disc'] : (float)($row['discount'] ?? 0);
            $total  = round($subtotal - $disc_v + $tax_v + $ship_v, 2);
            $updates[] = 'total = :total'; $params['total'] = $total;
        }

        if (!$updates) { ResponseHelper::sendError('No fields to update', 400); }
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_offers SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);

        Logger::info('Offer updated', ['offer_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Offer updated successfully');
    } catch (Exception $e) {
        Logger::error('Update offer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update offer', 500);
    }
}

// ── PUT /offers/:id/status — change status ──
if (($method === 'PATCH' || $method === 'PUT') && $id && $action === 'status') {
    Auth::requireAuth('admin');
    try {
        $data   = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = trim($data['status'] ?? '');
        if (!in_array($status, ['draft','sent','accepted','rejected','expired','converted'], true)) {
            ResponseHelper::sendError('Invalid status', 400);
        }
        $conn->execute(
            "UPDATE remquip_offers SET status = :status, updated_at = NOW() WHERE id = :id AND deleted_at IS NULL",
            ['status' => $status, 'id' => $id]
        );
        Logger::info('Offer status updated', ['offer_id' => $id, 'status' => $status]);
        ResponseHelper::sendSuccess(['id' => $id, 'status' => $status], 'Offer status updated');
    } catch (Exception $e) {
        Logger::error('Update offer status error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update offer status', 500);
    }
}

// ── POST /offers/:id/convert — convert accepted offer to order ──
if ($method === 'POST' && $id && $action === 'convert') {
    Auth::requireAuth('admin');
    try {
        $offer = $conn->fetch(
            "SELECT * FROM remquip_offers WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$offer) { ResponseHelper::sendError('Offer not found', 404); }
        if (!in_array($offer['status'], ['accepted', 'sent', 'draft'], true)) {
            ResponseHelper::sendError('Only draft, sent, or accepted offers can be converted to orders', 400);
        }

        $items = $conn->fetchAll(
            "SELECT * FROM remquip_offer_items WHERE offer_id = :id",
            ['id' => $id]
        );

        // Create the order
        $orderId     = $conn->fetch('SELECT UUID() AS u')['u'];
        $orderNumber = 'RMQ-' . date('YmdHis');

        $conn->execute(
            "INSERT INTO remquip_orders (id, customer_id, order_number, subtotal, tax, shipping, discount, total, payment_status, payment_method, status, notes, offer_id)
             VALUES (:id, :cid, :num, :sub, :tax, :ship, :disc, :total, 'pending', 'invoice', 'pending', :notes, :offerId)",
            [
                'id' => $orderId, 'cid' => $offer['customer_id'], 'num' => $orderNumber,
                'sub' => $offer['subtotal'], 'tax' => $offer['tax'],
                'ship' => $offer['shipping'], 'disc' => $offer['discount'],
                'total' => $offer['total'],
                'notes' => $offer['notes'], 'offerId' => $id,
            ]
        );

        // Copy line items
        foreach ($items as $item) {
            $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_order_items (id, order_id, product_id, quantity, unit_price, line_total)
                 VALUES (:id, :oid, :pid, :qty, :up, :lt)",
                [
                    'id' => $lineId, 'oid' => $orderId, 'pid' => $item['product_id'],
                    'qty' => $item['quantity'], 'up' => $item['unit_price'], 'lt' => $item['line_total'],
                ]
            );
        }

        // Mark offer as converted
        $conn->execute(
            "UPDATE remquip_offers SET status = 'converted', updated_at = NOW() WHERE id = :id",
            ['id' => $id]
        );

        // Copy offer documents to order
        $docs = $conn->fetchAll("SELECT * FROM remquip_offer_documents WHERE offer_id = :id", ['id' => $id]);
        foreach ($docs as $doc) {
            $docId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_order_documents (id, order_id, file_url, file_name, document_type, uploaded_by) VALUES (:id, :oid, :url, :fname, :dtype, :by)",
                ['id' => $docId, 'oid' => $orderId, 'url' => $doc['file_url'], 'fname' => $doc['file_name'], 'dtype' => $doc['document_type'], 'by' => $doc['uploaded_by']]
            );
        }

        // Email the customer to confirm their order
        try {
            remquip_notify_order_from_offer($conn, $orderId, $offer['offer_number']);
        } catch (Exception $_) { /* non-fatal */ }

        Logger::info('Offer converted to order', ['offer_id' => $id, 'order_id' => $orderId, 'order_number' => $orderNumber]);
        ResponseHelper::sendSuccess(
            ['id' => $orderId, 'order_number' => $orderNumber, 'offer_id' => $id],
            'Offer converted to order successfully',
            201
        );
    } catch (Exception $e) {
        Logger::error('Convert offer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to convert offer to order', 500);
    }
}

// ── POST /offers/:id/convert-invoice — convert offer to standalone invoice ──
if ($method === 'POST' && $id && $action === 'convert-invoice') {
    Auth::requireAuth('admin');
    try {
        $offer = $conn->fetch(
            "SELECT * FROM remquip_offers WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$offer) { ResponseHelper::sendError('Offer not found', 404); }
        if ($offer['status'] === 'converted') {
            ResponseHelper::sendError('This offer has already been converted', 400);
        }

        $items = $conn->fetchAll(
            "SELECT * FROM remquip_offer_items WHERE offer_id = :id",
            ['id' => $id]
        );

        // Compute tax
        $subtotal = (float)$offer['subtotal'];
        $discount = (float)$offer['discount'];
        $shipping = (float)$offer['shipping'];
        $tax      = (float)$offer['tax'];
        $taxBreakdownJson = $offer['tax_breakdown'] ?? null;

        if ($tax == 0 && $subtotal > 0) {
            $taxRates = get_active_tax_rates($conn);
            if (!empty($taxRates)) {
                $taxableBase = max(0, $subtotal - $discount);
                $result = compute_tax_breakdown($taxableBase, $taxRates);
                $tax = $result['total_tax'];
                $taxBreakdownJson = json_encode($result['breakdown']);
            }
        }

        $total = round($subtotal - $discount + $tax + $shipping, 2);
        $balanceDue = $total;

        // Create invoice
        $invoiceId     = $conn->fetch('SELECT UUID() AS u')['u'];
        $invoiceNumber = 'INV-' . date('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $issueDate     = date('Y-m-d');
        $dueDate       = date('Y-m-d', strtotime('+30 days'));

        $tok     = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $createdBy = $payload['user_id'] ?? null;

        $conn->execute(
            "INSERT INTO remquip_invoices (id, invoice_number, customer_id, offer_id, status, payment_status, issue_date, due_date,
                subtotal, tax, tax_breakdown, shipping, discount, total, amount_paid, balance_due, notes, created_by)
             VALUES (:id, :num, :cid, :offerId, 'draft', 'unpaid', :issueDate, :dueDate,
                :sub, :tax, :taxBreak, :ship, :disc, :total, 0, :balance, :notes, :createdBy)",
            [
                'id' => $invoiceId, 'num' => $invoiceNumber,
                'cid' => $offer['customer_id'], 'offerId' => $id,
                'issueDate' => $issueDate, 'dueDate' => $dueDate,
                'sub' => $subtotal, 'tax' => $tax,
                'taxBreak' => $taxBreakdownJson,
                'ship' => $shipping, 'disc' => $discount,
                'total' => $total, 'balance' => $balanceDue,
                'notes' => $offer['notes'], 'createdBy' => $createdBy,
            ]
        );

        // Copy line items
        foreach ($items as $item) {
            $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_invoice_items (id, invoice_id, product_id, product_name, sku, quantity, unit_price, line_total, notes)
                 VALUES (:id, :iid, :pid, :pname, :sku, :qty, :up, :lt, :notes)",
                [
                    'id' => $lineId, 'iid' => $invoiceId,
                    'pid' => $item['product_id'],
                    'pname' => $item['product_name'], 'sku' => $item['sku'],
                    'qty' => $item['quantity'], 'up' => $item['unit_price'],
                    'lt' => $item['line_total'], 'notes' => $item['notes'],
                ]
            );
        }

        Logger::info('Offer converted to invoice', ['offer_id' => $id, 'invoice_id' => $invoiceId, 'invoice_number' => $invoiceNumber]);
        ResponseHelper::sendSuccess(
            ['id' => $invoiceId, 'invoice_number' => $invoiceNumber, 'offer_id' => $id],
            'Offer converted to invoice successfully',
            201
        );
    } catch (Exception $e) {
        Logger::error('Convert offer to invoice error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to convert offer to invoice', 500);
    }
}

// ── POST /offers/:id/send — email the offer to the customer ──
if ($method === 'POST' && $id && $action === 'send') {
    Auth::requireAuth('admin');
    try {
        $data          = json_decode(file_get_contents('php://input'), true) ?? [];
        $customMessage = !empty($data['message']) ? trim($data['message']) : null;
        $customSubject = !empty($data['subject']) ? trim($data['subject']) : null;

        $offer = $conn->fetch(
            "SELECT id, status FROM remquip_offers WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$offer) { ResponseHelper::sendError('Offer not found', 404); }

        $sent = remquip_notify_offer_sent($conn, $id, $customMessage, $customSubject);

        // Auto-advance status from draft → sent when emailing the customer
        if ($offer['status'] === 'draft') {
            $conn->execute(
                "UPDATE remquip_offers SET status = 'sent', updated_at = NOW() WHERE id = :id",
                ['id' => $id]
            );
        }

        if ($sent) {
            Logger::info('Offer emailed to customer', ['offer_id' => $id]);
            ResponseHelper::sendSuccess(['sent' => true], 'Offer sent to customer successfully');
        } else {
            ResponseHelper::sendError('Failed to send email — check SMTP configuration', 500);
        }
    } catch (Exception $e) {
        Logger::error('Send offer email error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to send offer email', 500);
    }
}

// ── POST /offers/:id/documents — upload document ──
if ($method === 'POST' && $id && $action === 'documents') {
    Auth::requireAuth('admin');
    try {
        if (empty($_FILES['file'])) { ResponseHelper::sendError('No file uploaded', 400); }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) { ResponseHelper::sendError('File upload error', 400); }
        if ($file['size'] > 10 * 1024 * 1024) { ResponseHelper::sendError('File too large (max 10MB)', 400); }

        $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed  = ['pdf','doc','docx','xls','xlsx','csv','jpg','jpeg','png','gif','webp'];
        if (!in_array($ext, $allowed, true)) { ResponseHelper::sendError('File type not allowed', 400); }

        $uploadDir = __DIR__ . '/../uploads/offer_documents/';
        if (!is_dir($uploadDir)) { mkdir($uploadDir, 0755, true); }

        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $file['name']);
        $dest     = $uploadDir . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $dest)) { ResponseHelper::sendError('Failed to save file', 500); }

        $fileUrl = '/Backend/uploads/offer_documents/' . $safeName;

        $tok     = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $uploader = 'Admin';
        if ($payload && !empty($payload['user_id'])) {
            $u = $conn->fetch('SELECT full_name FROM remquip_users WHERE id = :id', ['id' => $payload['user_id']]);
            if ($u && !empty($u['full_name'])) $uploader = $u['full_name'];
        }

        $docType = $_POST['document_type'] ?? 'attachment';
        $docId   = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_offer_documents (id, offer_id, file_url, file_name, document_type, uploaded_by) VALUES (:id, :oid, :url, :fname, :dtype, :by)",
            ['id' => $docId, 'oid' => $id, 'url' => $fileUrl, 'fname' => $file['name'], 'dtype' => $docType, 'by' => $uploader]
        );

        ResponseHelper::sendSuccess(['id' => $docId, 'file_url' => $fileUrl, 'file_name' => $file['name']], 'Document uploaded', 201);
    } catch (Exception $e) {
        Logger::error('Upload offer document error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to upload document', 500);
    }
}

// ── GET /offers/:id/documents — list documents ──
if ($method === 'GET' && $id && $action === 'documents') {
    Auth::requireAuth('admin');
    try {
        $docs = $conn->fetchAll(
            "SELECT id, file_url, file_name, document_type, uploaded_by, created_at FROM remquip_offer_documents WHERE offer_id = :id ORDER BY created_at DESC",
            ['id' => $id]
        );
        ResponseHelper::sendSuccess($docs, 'Offer documents retrieved');
    } catch (Exception $e) {
        Logger::error('Get offer documents error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve documents', 500);
    }
}

// ── DELETE /offers/:id/documents (with doc ID in routeSegments[2]) ──
if ($method === 'DELETE' && $id && $action === 'documents') {
    Auth::requireAuth('admin');
    $docId = $routeSegments[2] ?? null;
    if (!$docId) { ResponseHelper::sendError('Document ID required', 400); }
    try {
        $conn->execute("DELETE FROM remquip_offer_documents WHERE id = :did AND offer_id = :oid", ['did' => $docId, 'oid' => $id]);
        ResponseHelper::sendSuccess(null, 'Document removed');
    } catch (Exception $e) {
        Logger::error('Delete offer document error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to remove document', 500);
    }
}

// ── DELETE /offers/:id — soft delete ──
if ($method === 'DELETE' && $id && !$action) {
    Auth::requireAuth('admin');
    try {
        $offer = $conn->fetch(
            'SELECT status FROM remquip_offers WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$offer) {
            ResponseHelper::sendError('Offer not found', 404);
        }
        if ($offer['status'] === 'converted') {
            ResponseHelper::sendError('Cannot delete an offer that has already been converted to an order', 400);
        }

        $conn->execute('UPDATE remquip_offers SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', ['id' => $id]);
        Logger::info('Offer soft-deleted', ['offer_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Offer deleted successfully');
    } catch (Exception $e) {
        Logger::error('Delete offer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete offer', 500);
    }
}

ResponseHelper::sendError('Offer endpoint not found', 404);
?>

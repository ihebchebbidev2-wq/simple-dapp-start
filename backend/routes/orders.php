<?php
/**
 * ORDERS ROUTES - Order management
 */

$method = $_SERVER['REQUEST_METHOD'];

// GET /orders — list (also GET /orders/search?q= for frontend api.searchOrders)
if ($method === 'GET' && (!$id || $id === 'search')) {
    Auth::requireAuth('admin');
    
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        if ($id === 'search') {
            $search = trim($_GET['q'] ?? $_GET['search'] ?? '');
        }
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        
        $where = ['o.deleted_at IS NULL'];
        $params = [];
        
        if ($search) {
            $where[] = "(o.order_number LIKE :search OR c.company_name LIKE :search OR c.email LIKE :search)";
            $params['search'] = "%$search%";
        }
        
        if ($status) {
            $where[] = "o.status = :status";
            $params['status'] = $status;
        }
        
        $whereClause = implode(' AND ', $where);
        
        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_orders o LEFT JOIN remquip_customers c ON o.customer_id = c.id WHERE $whereClause",
            $params
        )['total'] ?? 0;
        
        $params['limit'] = $limit;
        $params['offset'] = $offset;
        
        $orders = $conn->fetchAll(
            "SELECT o.id, o.order_number, o.customer_id,
                    c.company_name as customer, c.email as customer_email, c.phone,
                    (SELECT COUNT(*) FROM remquip_order_items WHERE order_id = o.id) as items,
                    o.total, o.total as total_amount, o.status, o.payment_status,
                    o.payment_method, o.installment_count, o.requires_contract,
                    o.stripe_payment_intent_id, o.paid_at,
                    o.created_at, o.created_at as order_date, o.created_at as date
             FROM remquip_orders o
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE $whereClause
             ORDER BY o.created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );
        
        ResponseHelper::sendPaginated($orders, $total, $limit, $offset, 'Orders retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get orders error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve orders', 500);
    }
}

// GET /orders/:id - Get order details
if ($method === 'GET' && $id && !$action) {
    Auth::requireAuth('admin');
    
    try {
        $order = $conn->fetch(
            "SELECT o.*, o.stripe_session_id, o.stripe_payment_intent_id, o.payment_method, o.paid_at,
                    c.company_name, c.email, c.phone
             FROM remquip_orders o
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE o.id = :id AND o.deleted_at IS NULL",
            ['id' => $id]
        );
        
        if (!$order) {
            ResponseHelper::sendError('Order not found', 404);
        }
        
        $items = $conn->fetchAll(
            "SELECT oi.id, oi.quantity, oi.unit_price, p.name, p.sku FROM remquip_order_items oi
             LEFT JOIN remquip_products p ON oi.product_id = p.id
             WHERE oi.order_id = :id",
            ['id' => $id]
        );
        
        $notes = $conn->fetchAll(
            "SELECT n.`date`, n.`user`, n.`text` FROM remquip_order_notes n
             WHERE n.order_id = :id ORDER BY n.date DESC",
            ['id' => $id]
        );
        
        $order['items'] = $items;
        $order['notes'] = $notes;

        // Include installments if applicable
        if ($order['payment_method'] === 'installments' && !empty($order['installment_count'])) {
            try {
                $installments = $conn->fetchAll(
                    "SELECT * FROM remquip_order_installments WHERE order_id = :id ORDER BY installment_number ASC",
                    ['id' => $id]
                );
                $order['installments'] = $installments;
            } catch (Exception $_) {
                $order['installments'] = [];
            }
        }
        
        ResponseHelper::sendSuccess($order, 'Order details retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get order error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve order', 500);
    }
}

// GET /orders/:id/notes — notes only (Admin); matches api.getOrderNotes / ORDERS.GET_NOTES
if ($method === 'GET' && $id && $action === 'notes') {
    Auth::requireAuth('admin');

    try {
        $exists = $conn->fetch(
            'SELECT id FROM remquip_orders WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$exists) {
            ResponseHelper::sendError('Order not found', 404);
        }

        $notes = $conn->fetchAll(
            "SELECT n.`date`, n.`user`, n.`text` FROM remquip_order_notes n
             WHERE n.order_id = :id ORDER BY n.date DESC",
            ['id' => $id]
        );

        ResponseHelper::sendSuccess($notes, 'Order notes retrieved');
    } catch (Exception $e) {
        Logger::error('Get order notes error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve order notes', 500);
    }
}

// PATCH/PUT /orders/:id - Partial update (Admin) — aligns with frontend api.updateOrder (PUT)
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    Auth::requireAuth('admin');
    
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $id];
        
        if (isset($data['status'])) {
            $updates[] = 'status = :status';
            $params['status'] = $data['status'];
        }
        if (isset($data['payment_status'])) {
            $updates[] = 'payment_status = :payment_status';
            $params['payment_status'] = $data['payment_status'];
        }
        if (isset($data['subtotal'])) {
            $updates[] = 'subtotal = :subtotal';
            $params['subtotal'] = (float)$data['subtotal'];
        }
        if (isset($data['tax'])) {
            $updates[] = 'tax = :tax';
            $params['tax'] = (float)$data['tax'];
        }
        if (isset($data['shipping'])) {
            $updates[] = 'shipping = :shipping';
            $params['shipping'] = (float)$data['shipping'];
        }
        if (isset($data['total'])) {
            $updates[] = 'total = :total';
            $params['total'] = (float)$data['total'];
        }
        if (isset($data['shippingAddress'])) {
            $updates[] = 'shipping_address = :shipping_address';
            $params['shipping_address'] = is_string($data['shippingAddress'])
                ? $data['shippingAddress']
                : json_encode($data['shippingAddress']);
        }
        
        if (!$updates) {
            ResponseHelper::sendError('No fields to update', 400);
        }

        $prevStatus = null;
        if (isset($data['status'])) {
            $prevRow = $conn->fetch(
                'SELECT status FROM remquip_orders WHERE id = :id AND deleted_at IS NULL',
                ['id' => $id]
            );
            $prevStatus = $prevRow['status'] ?? null;
        }
        
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_orders SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);

        if (isset($data['status']) && $prevStatus !== null) {
            remquip_notify_order_status_changed($conn, $id, (string)$prevStatus, (string)$data['status']);

            // Deduct stock when order transitions to a confirmed/processing state
            $confirmedStatuses = ['processing', 'confirmed', 'shipped'];
            $unconfirmedStatuses = ['pending', 'pending_payment', 'cancelled'];
            if (in_array($data['status'], $confirmedStatuses) && in_array($prevStatus, $unconfirmedStatuses)) {
                remquip_deduct_stock_for_order($conn, $id);
            }

            // Restore stock when order is cancelled or refunded
            $cancelledStatuses = ['cancelled', 'refunded'];
            if (in_array($data['status'], $cancelledStatuses) && !in_array($prevStatus, $cancelledStatuses)) {
                remquip_restore_stock_for_order($conn, $id);
            }
        }
        
        Logger::info('Order updated', ['order_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Order updated successfully');
        
    } catch (Exception $e) {
        Logger::error('Update order error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update order', 500);
    }
}

// POST /orders - Create order (guest checkout: customer_email + billing_address, or customerId)
if ($method === 'POST' && !$id) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $rawItems = $data['items'] ?? [];
        if (!is_array($rawItems) || empty($rawItems)) {
            ResponseHelper::sendError('Invalid order data: items required', 400);
        }

        $items = [];
        foreach ($rawItems as $item) {
            $pid = $item['productId'] ?? $item['product_id'] ?? null;
            $qty = (int)($item['quantity'] ?? 0);
            $up = (float)($item['unitPrice'] ?? $item['unit_price'] ?? 0);
            if (!$pid || $qty < 1 || $up < 0) {
                continue;
            }
            $items[] = ['productId' => $pid, 'quantity' => $qty, 'unitPrice' => $up];
        }
        if (empty($items)) {
            ResponseHelper::sendError('Invalid order data: no valid line items', 400);
        }

        $email = '';
        $customerId = $data['customerId'] ?? $data['customer_id'] ?? null;
        if (!$customerId) {
            $email = trim($data['customer_email'] ?? $data['email'] ?? '');
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                ResponseHelper::sendError('customer_email or customerId is required', 400);
            }
            $existing = $conn->fetch(
                'SELECT id FROM remquip_customers WHERE email = :e AND deleted_at IS NULL',
                ['e' => $email]
            );
            if ($existing) {
                $customerId = $existing['id'];
            } else {
                $ba = $data['billing_address'] ?? [];
                $company = trim($ba['company'] ?? '');
                if ($company === '') {
                    $company = 'Web Customer';
                }
                $contact = trim(($ba['first_name'] ?? '') . ' ' . ($ba['last_name'] ?? ''));
                if ($contact === '') {
                    $contact = 'Customer';
                }
                $customerId = $conn->fetch('SELECT UUID() AS u')['u'];
                $conn->execute(
                    "INSERT INTO remquip_customers (id, company_name, contact_person, email, phone, customer_type, status, address, city, province, postal_code, country)
                     VALUES (:id, :co, :cp, :em, :ph, 'Fleet', 'active', :ad, :ci, :pr, :pc, :cty)",
                    [
                        'id' => $customerId,
                        'co' => $company,
                        'cp' => $contact,
                        'em' => $email,
                        'ph' => $ba['phone'] ?? '',
                        'ad' => $ba['address_line1'] ?? '',
                        'ci' => $ba['city'] ?? '',
                        'pr' => $ba['state'] ?? '',
                        'pc' => $ba['postal_code'] ?? '',
                        'cty' => $ba['country'] ?? '',
                    ]
                );
            }
        }

        $subtotal = isset($data['subtotal']) ? (float)$data['subtotal'] : 0;
        if ($subtotal <= 0) {
            $subtotal = 0;
            foreach ($items as $item) {
                $subtotal += $item['quantity'] * $item['unitPrice'];
            }
        }
        $subtotal = round(max(0, $subtotal), 2);
        $rates = settings_storefront_rates($conn);
        $tot = compute_order_totals_from_subtotal($subtotal, $rates);
        $tax = $tot['tax'];
        $shipping = $tot['shipping'];
        $total = $tot['total'];
        $taxBreakdownJson = !empty($tot['tax_breakdown']) ? json_encode($tot['tax_breakdown']) : null;

        $shipAddr = $data['shipping_address'] ?? $data['shippingAddress'] ?? [];
        $billAddr = $data['billing_address'] ?? $data['billingAddress'] ?? [];
        $paymentMethod = trim($data['payment_method'] ?? $data['paymentMethod'] ?? 'stripe');
        $notes = $data['notes'] ?? null;
        $installmentCount = isset($data['installment_count']) ? (int)$data['installment_count'] : null;

        // Validate installment payments require contract customer
        if ($paymentMethod === 'installments') {
            if (!$installmentCount || $installmentCount < 2 || $installmentCount > 12) {
                ResponseHelper::sendError('Installment count must be between 2 and 12', 400);
            }
            // Verify customer is a validated contract customer
            $custCheck = $conn->fetch(
                "SELECT category, contract_validated FROM remquip_customers WHERE id = :id AND deleted_at IS NULL",
                ['id' => $customerId]
            );
            if (!$custCheck || $custCheck['category'] !== 'contract' || !$custCheck['contract_validated']) {
                ResponseHelper::sendError('Installment payments require an approved contract account', 403);
            }
        }

        $orderNumber = 'RMQ-' . date('YmdHis');

        $orderId = $conn->fetch('SELECT UUID() AS u')['u'];
        // For Stripe orders, set status to 'pending_payment' — order is only confirmed after successful payment
        // For contract orders, set status to 'pending' with payment_status 'contract' (invoiced later)
        if ($paymentMethod === 'stripe') {
            $initialStatus = 'pending_payment';
            $initialPaymentStatus = 'awaiting_payment';
        } elseif ($paymentMethod === 'contract') {
            $initialStatus = 'pending';
            $initialPaymentStatus = 'contract';
        } elseif ($paymentMethod === 'installments') {
            $initialStatus = 'pending';
            $initialPaymentStatus = 'installments';
        } else {
            $initialStatus = 'pending';
            $initialPaymentStatus = 'pending';
        }

        $conn->execute(
            "INSERT INTO remquip_orders (id, customer_id, order_number, subtotal, tax, shipping, total, tax_breakdown, payment_status, payment_method, status, shipping_address, notes, installment_count, requires_contract)
             VALUES (:id, :customerId, :orderNumber, :subtotal, :tax, :shipping, :total, :taxBreakdown, :paymentStatus, :paymentMethod, :status, :shippingAddress, :notes, :instCount, :reqContract)",
            [
                'id' => $orderId,
                'customerId' => $customerId,
                'orderNumber' => $orderNumber,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'shipping' => $shipping,
                'total' => $total,
                'taxBreakdown' => $taxBreakdownJson,
                'paymentStatus' => $initialPaymentStatus,
                'paymentMethod' => $paymentMethod,
                'status' => $initialStatus,
                'shippingAddress' => !empty($shipAddr) ? json_encode($shipAddr) : null,
                'notes' => $notes,
                'instCount' => $installmentCount,
                'reqContract' => ($paymentMethod === 'installments' || $paymentMethod === 'contract') ? 1 : 0,
            ]
        );

        // Create installment schedule for installment payments
        if ($paymentMethod === 'installments' && $installmentCount >= 2) {
            $installmentAmount = round($total / $installmentCount, 2);
            $remainder = round($total - ($installmentAmount * $installmentCount), 2);
            for ($i = 1; $i <= $installmentCount; $i++) {
                $instId = $conn->fetch('SELECT UUID() AS u')['u'];
                $amt = $installmentAmount;
                if ($i === $installmentCount) {
                    $amt = round($amt + $remainder, 2); // adjust last installment for rounding
                }
                $dueDate = date('Y-m-d', strtotime("+{$i} months"));
                $conn->execute(
                    "INSERT INTO remquip_order_installments (id, order_id, installment_number, amount, due_date, status)
                     VALUES (:id, :orderId, :num, :amount, :dueDate, 'pending')",
                    [
                        'id' => $instId,
                        'orderId' => $orderId,
                        'num' => $i,
                        'amount' => $amt,
                        'dueDate' => $dueDate,
                    ]
                );
            }
        }

        // Promote Lead to Customer upon their first purchase
        try {
            $conn->execute(
                "UPDATE remquip_customers SET category = 'customer', updated_at = NOW() WHERE id = :id AND category = 'lead'",
                ['id' => $customerId]
            );
        } catch (Exception $promotErr) {
            Logger::warning('Failed to promote lead to customer', ['error' => $promotErr->getMessage(), 'customer_id' => $customerId]);
        }

        // Store billing_address separately — column added via migrate_orders_billing_address.sql.
        // Wrapped in try/catch so order creation never fails if migration hasn't run yet.
        if (!empty($billAddr)) {
            try {
                $conn->execute(
                    "UPDATE remquip_orders SET billing_address = :ba WHERE id = :id",
                    ['ba' => json_encode($billAddr), 'id' => $orderId]
                );
            } catch (Exception $_) {
                // Column may not exist yet — silently skip.
            }
        }

        foreach ($items as $item) {
            $lineId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_order_items (id, order_id, product_id, quantity, unit_price, line_total)
                 VALUES (:id, :orderId, :productId, :quantity, :unitPrice, :lineTotal)",
                [
                    'id' => $lineId,
                    'orderId' => $orderId,
                    'productId' => $item['productId'],
                    'quantity' => $item['quantity'],
                    'unitPrice' => $item['unitPrice'],
                    'lineTotal' => $item['quantity'] * $item['unitPrice'],
                ]
            );
        }

        Logger::info('Order created', ['order_id' => $orderId, 'order_number' => $orderNumber]);
        
        // Mark abandoned carts for this email as completed
        // $email may be empty when order was created via customerId — look it up
        if ($email === '') {
            try {
                $custRow = $conn->fetch('SELECT email FROM remquip_customers WHERE id = :id AND deleted_at IS NULL', ['id' => $customerId]);
                $email = $custRow['email'] ?? '';
            } catch (Exception $_) {}
        }
        if ($email !== '') {
            try {
                $conn->execute(
                    "UPDATE abandoned_carts SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE email = :email AND status = 'abandoned'",
                    ['email' => $email]
                );
            } catch (Exception $e) {
                // Table may not exist or use different prefix — non-fatal
                Logger::warning('Failed to mark cart as completed', ['error' => $e->getMessage()]);
            }
        }
        
        remquip_notify_new_order($conn, $orderId, $orderNumber, (string)$total);
        
        // Send order confirmation email to customer (all payment methods)
        remquip_notify_order_confirmation_customer($conn, $orderId, $orderNumber, (string)$total, $paymentMethod);
        
        ResponseHelper::sendSuccess(['id' => $orderId, 'orderNumber' => $orderNumber], 'Order created successfully', 201);
    } catch (Exception $e) {
        Logger::error('Create order error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create order', 500);
    }
}

// PATCH/PUT /orders/:id/status - Update order status (Admin)
if (($method === 'PATCH' || $method === 'PUT') && $id && $action === 'status') {
    Auth::requireAuth('admin');
    
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (empty($data['status'])) {
            ResponseHelper::sendError('Status is required', 400);
        }
        
        $prev = $conn->fetch('SELECT status FROM remquip_orders WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
        if (!$prev) {
            ResponseHelper::sendError('Order not found', 404);
        }
        $prevStatus = (string)($prev['status'] ?? '');
        $newStatus  = (string)$data['status'];

        $conn->execute(
            "UPDATE remquip_orders SET status = :status, updated_at = NOW() WHERE id = :id",
            ['status' => $newStatus, 'id' => $id]
        );

        remquip_notify_order_status_changed($conn, $id, $prevStatus, $newStatus);

        // Deduct stock when transitioning to confirmed/processing/shipped
        $confirmedStatuses  = ['processing', 'confirmed', 'shipped'];
        $unconfirmedStatuses = ['pending', 'pending_payment', 'cancelled'];
        if (in_array($newStatus, $confirmedStatuses) && in_array($prevStatus, $unconfirmedStatuses)) {
            remquip_deduct_stock_for_order($conn, $id);
        }

        // Restore stock when order is cancelled or refunded
        $cancelledStatuses = ['cancelled', 'refunded'];
        if (in_array($newStatus, $cancelledStatuses) && !in_array($prevStatus, $cancelledStatuses)) {
            remquip_restore_stock_for_order($conn, $id);
        }

        Logger::info('Order status updated', ['order_id' => $id, 'status' => $newStatus]);
        ResponseHelper::sendSuccess(['id' => $id, 'status' => $data['status']], 'Order status updated');
        
    } catch (Exception $e) {
        Logger::error('Update order status error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update order status', 500);
    }
}

// PATCH/PUT /orders/:id/mark-paid — Admin: mark order as paid (for cash/check/bank/contract)
if (($method === 'PATCH' || $method === 'PUT') && $id && ($action === 'mark-paid' || $action === 'markpaid')) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $paymentRef = trim($data['payment_ref'] ?? $data['reference'] ?? '');

        $order = $conn->fetch('SELECT id, payment_status, payment_method FROM remquip_orders WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
        if (!$order) {
            ResponseHelper::sendError('Order not found', 404);
        }
        if ($order['payment_status'] === 'paid') {
            ResponseHelper::sendError('Order is already marked as paid', 400);
        }

        $updates = "payment_status = 'paid', paid_at = NOW(), updated_at = NOW()";
        $params = ['id' => $id];
        if ($paymentRef !== '') {
            $updates .= ", stripe_payment_intent_id = :ref";
            $params['ref'] = $paymentRef;
        }
        $conn->execute("UPDATE remquip_orders SET $updates WHERE id = :id", $params);

        Logger::info('Order marked as paid', ['order_id' => $id, 'method' => $order['payment_method'], 'ref' => $paymentRef]);
        ResponseHelper::sendSuccess(['id' => $id, 'payment_status' => 'paid'], 'Order marked as paid');
    } catch (Exception $e) {
        Logger::error('Mark order paid error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to mark order as paid', 500);
    }
}

if (($method === 'PATCH' || $method === 'PUT') && $id && ($action === 'shipment' || $action === 'tracking')) {
    Auth::requireAuth('admin');
    
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (empty($data['carrier']) || empty($data['trackingNumber'])) {
            ResponseHelper::sendError('Carrier and tracking number required', 400);
        }
        
        $conn->execute(
            "UPDATE remquip_orders SET status = 'shipped', updated_at = NOW() WHERE id = :id",
            ['id' => $id]
        );

        remquip_notify_order_shipped_to_customer($conn, $id, $data['carrier'], $data['trackingNumber']);

        Logger::info('Shipment updated', ['order_id' => $id, 'carrier' => $data['carrier']]);
        ResponseHelper::sendSuccess(
            ['id' => $id, 'carrier' => $data['carrier'], 'trackingNumber' => $data['trackingNumber']],
            'Shipment information updated'
        );
        
    } catch (Exception $e) {
        Logger::error('Update shipment error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update shipment', 500);
    }
}

// POST /orders/:id/notes - Add order note (Admin)
if ($method === 'POST' && $id && $action === 'notes') {
    Auth::requireAuth('admin');
    
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (empty($data['note'])) {
            ResponseHelper::sendError('Note content is required', 400);
        }
        
        $tok = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $noteAuthor = 'Admin';
        if ($payload && !empty($payload['user_id'])) {
            $noteUser = $conn->fetch('SELECT full_name FROM remquip_users WHERE id = :id AND deleted_at IS NULL', ['id' => $payload['user_id']]);
            if ($noteUser && !empty($noteUser['full_name'])) {
                $noteAuthor = $noteUser['full_name'];
            }
        }

        $noteId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_order_notes (id, order_id, `user`, `text`, `date`) VALUES (:nid, :orderId, :user, :text, NOW())",
            [
                'nid' => $noteId,
                'orderId' => $id,
                'user' => $noteAuthor,
                'text' => $data['note']
            ]
        );
        
        Logger::info('Order note added', ['order_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Note added to order');
        
    } catch (Exception $e) {
        Logger::error('Add order note error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to add note', 500);
    }
}

// ── Helper: recalc order totals from current items ──
if (!function_exists('remquip_recalc_order_totals')) {
    function remquip_recalc_order_totals($conn, string $orderId): void {
        $row = $conn->fetch(
            'SELECT COALESCE(SUM(quantity * unit_price), 0) AS subtotal
             FROM remquip_order_items WHERE order_id = :id',
            ['id' => $orderId]
        );
        $subtotal = (float)($row['subtotal'] ?? 0);

        $order = $conn->fetch(
            'SELECT subtotal AS old_subtotal, tax, shipping, total FROM remquip_orders WHERE id = :id',
            ['id' => $orderId]
        );
        $tax      = (float)($order['tax'] ?? 0);
        $shipping = (float)($order['shipping'] ?? 0);
        $oldTotal = (float)($order['total'] ?? 0);
        $oldSub   = (float)($order['old_subtotal'] ?? 0);

        // Preserve any extra (discount) by computing delta on subtotal only
        $delta = $subtotal - $oldSub;
        $newTotal = max(0, $oldTotal + $delta);

        $conn->execute(
            'UPDATE remquip_orders
             SET subtotal = :sub, total = :tot, updated_at = NOW()
             WHERE id = :id',
            ['sub' => $subtotal, 'tot' => $newTotal, 'id' => $orderId]
        );
    }
}

// PATCH /orders/:id/items/:itemId — update quantity (Admin)
if (($method === 'PATCH' || $method === 'PUT') && $id && $action === 'items' && !empty($routeSegments[2])) {
    Auth::requireAuth('admin');
    $itemId = $routeSegments[2];

    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $newQty = isset($data['quantity']) ? (int)$data['quantity'] : -1;
        if ($newQty < 1) {
            ResponseHelper::sendError('Quantity must be >= 1', 400);
        }

        $order = $conn->fetch(
            'SELECT id, status, stock_deducted FROM remquip_orders WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$order) { ResponseHelper::sendError('Order not found', 404); }
        if (in_array($order['status'], ['shipped', 'delivered'], true)) {
            ResponseHelper::sendError('Cannot edit items on a shipped or delivered order', 400);
        }

        $item = $conn->fetch(
            'SELECT id, product_id, quantity, unit_price FROM remquip_order_items WHERE id = :iid AND order_id = :oid',
            ['iid' => $itemId, 'oid' => $id]
        );
        if (!$item) { ResponseHelper::sendError('Order item not found', 404); }

        $oldQty = (int)$item['quantity'];
        $delta  = $newQty - $oldQty;

        // If stock was already deducted for this order, adjust by delta
        if (!empty($order['stock_deducted']) && $delta !== 0) {
            $pid = $item['product_id'];

            // Check stock availability if increasing
            if ($delta > 0) {
                $prod = $conn->fetch('SELECT stock_quantity FROM remquip_products WHERE id = :pid', ['pid' => $pid]);
                if ($prod && (int)$prod['stock_quantity'] < $delta) {
                    ResponseHelper::sendError('Not enough stock available (need ' . $delta . ' more, have ' . (int)$prod['stock_quantity'] . ')', 400);
                }
            }

            // Apply delta: positive delta = deduct more, negative = restore
            $conn->execute(
                'UPDATE remquip_products
                 SET stock_quantity = GREATEST(0, stock_quantity - :d), updated_at = NOW()
                 WHERE id = :pid',
                ['d' => $delta, 'pid' => $pid]
            );

            $inv = $conn->fetch('SELECT quantity_on_hand, quantity_available FROM remquip_inventory WHERE product_id = :pid', ['pid' => $pid]);
            if ($inv) {
                $newOH = max(0, (int)$inv['quantity_on_hand'] - $delta);
                $newAV = max(0, (int)$inv['quantity_available'] - $delta);
                $conn->execute(
                    'UPDATE remquip_inventory SET quantity_on_hand = :oh, quantity_available = :av, updated_at = NOW() WHERE product_id = :pid',
                    ['oh' => $newOH, 'av' => $newAV, 'pid' => $pid]
                );
                try {
                    $logId = bin2hex(random_bytes(18));
                    $conn->execute(
                        "INSERT INTO remquip_inventory_logs (id, product_id, action, quantity_change, reason, old_quantity, new_quantity, created_at)
                         VALUES (:id, :pid, 'order_item_edit', :change, :reason, :old, :new, NOW())",
                        [
                            'id' => $logId, 'pid' => $pid,
                            'change' => -$delta,
                            'reason' => 'Order item quantity changed: ' . $id,
                            'old' => $inv['quantity_on_hand'], 'new' => $newOH,
                        ]
                    );
                } catch (Exception $_) {}
            }
        }

        $conn->execute(
            'UPDATE remquip_order_items SET quantity = :q WHERE id = :iid',
            ['q' => $newQty, 'iid' => $itemId]
        );

        remquip_recalc_order_totals($conn, $id);

        Logger::info('Order item quantity updated', ['order_id' => $id, 'item_id' => $itemId, 'old' => $oldQty, 'new' => $newQty]);
        ResponseHelper::sendSuccess(['id' => $itemId, 'quantity' => $newQty], 'Order item updated');
    } catch (Exception $e) {
        Logger::error('Update order item error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update order item', 500);
    }
}

// DELETE /orders/:id/items/:itemId — remove a line item (Admin)
if ($method === 'DELETE' && $id && $action === 'items' && !empty($routeSegments[2])) {
    Auth::requireAuth('admin');
    $itemId = $routeSegments[2];

    try {
        $order = $conn->fetch(
            'SELECT id, status, stock_deducted FROM remquip_orders WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$order) { ResponseHelper::sendError('Order not found', 404); }
        if (in_array($order['status'], ['shipped', 'delivered'], true)) {
            ResponseHelper::sendError('Cannot remove items from a shipped or delivered order', 400);
        }

        $item = $conn->fetch(
            'SELECT id, product_id, quantity FROM remquip_order_items WHERE id = :iid AND order_id = :oid',
            ['iid' => $itemId, 'oid' => $id]
        );
        if (!$item) { ResponseHelper::sendError('Order item not found', 404); }

        // Refuse to remove the last remaining item — admin should cancel/delete the order instead
        $remaining = $conn->fetch(
            'SELECT COUNT(*) AS c FROM remquip_order_items WHERE order_id = :oid',
            ['oid' => $id]
        );
        if ((int)($remaining['c'] ?? 0) <= 1) {
            ResponseHelper::sendError('Cannot remove the last item — cancel or delete the order instead', 400);
        }

        // Restore stock if previously deducted
        if (!empty($order['stock_deducted'])) {
            $pid = $item['product_id'];
            $qty = (int)$item['quantity'];
            $conn->execute(
                'UPDATE remquip_products SET stock_quantity = stock_quantity + :q, updated_at = NOW() WHERE id = :pid',
                ['q' => $qty, 'pid' => $pid]
            );
            $inv = $conn->fetch('SELECT quantity_on_hand, quantity_available FROM remquip_inventory WHERE product_id = :pid', ['pid' => $pid]);
            if ($inv) {
                $newOH = (int)$inv['quantity_on_hand'] + $qty;
                $newAV = (int)$inv['quantity_available'] + $qty;
                $conn->execute(
                    'UPDATE remquip_inventory SET quantity_on_hand = :oh, quantity_available = :av, updated_at = NOW() WHERE product_id = :pid',
                    ['oh' => $newOH, 'av' => $newAV, 'pid' => $pid]
                );
                try {
                    $logId = bin2hex(random_bytes(18));
                    $conn->execute(
                        "INSERT INTO remquip_inventory_logs (id, product_id, action, quantity_change, reason, old_quantity, new_quantity, created_at)
                         VALUES (:id, :pid, 'order_item_removed', :change, :reason, :old, :new, NOW())",
                        [
                            'id' => $logId, 'pid' => $pid,
                            'change' => $qty,
                            'reason' => 'Order item removed: ' . $id,
                            'old' => $inv['quantity_on_hand'], 'new' => $newOH,
                        ]
                    );
                } catch (Exception $_) {}
            }
        }

        $conn->execute('DELETE FROM remquip_order_items WHERE id = :iid', ['iid' => $itemId]);
        remquip_recalc_order_totals($conn, $id);

        Logger::info('Order item removed', ['order_id' => $id, 'item_id' => $itemId]);
        ResponseHelper::sendSuccess(['id' => $itemId], 'Order item removed');
    } catch (Exception $e) {
        Logger::error('Delete order item error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to remove order item', 500);
    }
}

// DELETE /orders/:id — soft delete (Admin)
if ($method === 'DELETE' && $id && !$action) {
    Auth::requireAuth('admin');
    
    try {
        // Prevent deletion of shipped or delivered orders
        $order = $conn->fetch(
            'SELECT status FROM remquip_orders WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$order) {
            ResponseHelper::sendError('Order not found', 404);
        }
        $nonDeletable = ['shipped', 'delivered'];
        if (in_array($order['status'], $nonDeletable, true)) {
            ResponseHelper::sendError('Cannot delete an order that has been shipped or delivered', 400);
        }

        // Restore stock if order was in a confirmed state
        $confirmedStatuses = ['processing', 'confirmed'];
        if (in_array($order['status'], $confirmedStatuses, true)) {
            remquip_restore_stock_for_order($conn, $id);
        }

        $conn->execute('UPDATE remquip_orders SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', ['id' => $id]);
        Logger::info('Order soft-deleted', ['order_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Order deleted successfully');
    } catch (Exception $e) {
        Logger::error('Delete order error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete order', 500);
    }
}

// ── POST /orders/:id/send — email the customer about this order ──
if ($method === 'POST' && $id && $action === 'send') {
    Auth::requireAuth('admin');
    try {
        $data          = json_decode(file_get_contents('php://input'), true) ?? [];
        $emailType     = trim($data['email_type'] ?? 'status');   // 'status' | 'confirmation' | 'custom'
        $customMessage = !empty($data['message']) ? trim($data['message']) : null;
        $customSubject = !empty($data['subject']) ? trim($data['subject']) : null;

        $row = $conn->fetch(
            'SELECT o.order_number, o.status, o.total,
                    c.email, c.contact_person, c.company_name
             FROM remquip_orders o
             INNER JOIN remquip_customers c ON c.id = o.customer_id AND c.deleted_at IS NULL
             WHERE o.id = :id AND o.deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$row) { ResponseHelper::sendError('Order not found', 404); }

        $to = filter_var($row['email'], FILTER_VALIDATE_EMAIL);
        if (!$to) { ResponseHelper::sendError('Customer has no valid email address', 422); }

        $orderNumber = $row['order_number'];

        if ($emailType === 'custom' && $customMessage) {
            // Custom freeform email using the status template as base
            $subject = $customSubject ?: ('REMQUIP: Regarding Order ' . $orderNumber);
            $tpl = remquip_tpl_order_status_customer([
                'order_number' => $orderNumber,
                'status'       => $customMessage,
            ]);
            // Override inner content with freeform message
            $name = trim(($row['contact_person'] ?? '') . ' ' . ($row['company_name'] ?? ''));
            if ($name === '') $name = $to;
            $innerHtml = '<p style="margin:0 0 16px;">Dear ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ',</p>'
                . '<p style="margin:0 0 16px;white-space:pre-wrap;">' . htmlspecialchars($customMessage, ENT_QUOTES, 'UTF-8') . '</p>'
                . '<p style="margin:24px 0 0;font-size:14px;">If you have questions, reply to this email or contact our team.</p>';
            $html = remquip_email_layout(
                'Regarding order ' . $orderNumber,
                'Message from REMQUIP',
                $innerHtml
            );
            $sent = remquip_send_customer_mail($conn, $to, $subject, $html, $customMessage);
        } else {
            // Status notification email
            $subject = $customSubject ?: ('REMQUIP: Order ' . $orderNumber . ' — ' . $row['status']);
            $tpl  = remquip_tpl_order_status_customer(['order_number' => $orderNumber, 'status' => $row['status']]);
            $sent = remquip_send_customer_mail($conn, $to, $subject, $tpl['html'], $tpl['text']);
        }

        if ($sent) {
            Logger::info('Order email sent to customer', ['order_id' => $id, 'type' => $emailType]);
            ResponseHelper::sendSuccess(['sent' => true], 'Email sent to customer successfully');
        } else {
            ResponseHelper::sendError('Failed to send email — check SMTP configuration', 500);
        }
    } catch (Exception $e) {
        Logger::error('Send order email error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to send order email', 500);
    }
}

// ── GET /orders/:id/documents — list documents ──
if ($method === 'GET' && $id && $action === 'documents') {
    Auth::requireAuth('admin');
    try {
        $docs = $conn->fetchAll(
            "SELECT id, file_url, file_name, document_type, uploaded_by, created_at FROM remquip_order_documents WHERE order_id = :id ORDER BY created_at DESC",
            ['id' => $id]
        );
        ResponseHelper::sendSuccess($docs, 'Order documents retrieved');
    } catch (Exception $e) {
        Logger::error('Get order documents error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve documents', 500);
    }
}

// ── POST /orders/:id/documents — upload document ──
if ($method === 'POST' && $id && $action === 'documents') {
    Auth::requireAuth('admin');
    try {
        if (empty($_FILES['file'])) { ResponseHelper::sendError('No file uploaded', 400); }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) { ResponseHelper::sendError('File upload error', 400); }
        if ($file['size'] > 10 * 1024 * 1024) { ResponseHelper::sendError('File too large (max 10MB)', 400); }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['pdf','doc','docx','xls','xlsx','csv','jpg','jpeg','png','gif','webp'];
        if (!in_array($ext, $allowed, true)) { ResponseHelper::sendError('File type not allowed', 400); }

        $uploadDir = __DIR__ . '/../uploads/order_documents/';
        if (!is_dir($uploadDir)) { mkdir($uploadDir, 0755, true); }

        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $file['name']);
        $dest = $uploadDir . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $dest)) { ResponseHelper::sendError('Failed to save file', 500); }

        $fileUrl = '/Backend/uploads/order_documents/' . $safeName;
        $tok = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $uploader = 'Admin';
        if ($payload && !empty($payload['user_id'])) {
            $u = $conn->fetch('SELECT full_name FROM remquip_users WHERE id = :id', ['id' => $payload['user_id']]);
            if ($u && !empty($u['full_name'])) $uploader = $u['full_name'];
        }

        $docType = $_POST['document_type'] ?? 'attachment';
        $docId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_order_documents (id, order_id, file_url, file_name, document_type, uploaded_by) VALUES (:id, :oid, :url, :fname, :dtype, :by)",
            ['id' => $docId, 'oid' => $id, 'url' => $fileUrl, 'fname' => $file['name'], 'dtype' => $docType, 'by' => $uploader]
        );

        ResponseHelper::sendSuccess(['id' => $docId, 'file_url' => $fileUrl, 'file_name' => $file['name']], 'Document uploaded', 201);
    } catch (Exception $e) {
        Logger::error('Upload order document error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to upload document', 500);
    }
}

// ── DELETE /orders/:id/documents/:docId ──
if ($method === 'DELETE' && $id && $action === 'documents') {
    Auth::requireAuth('admin');
    $docId = $routeSegments[2] ?? null;
    if (!$docId) { ResponseHelper::sendError('Document ID required', 400); }
    try {
        $conn->execute("DELETE FROM remquip_order_documents WHERE id = :did AND order_id = :oid", ['did' => $docId, 'oid' => $id]);
        ResponseHelper::sendSuccess(null, 'Document removed');
    } catch (Exception $e) {
        Logger::error('Delete order document error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to remove document', 500);
    }
}

// ── GET /orders/:id/installments — list installments for an order ──
if ($method === 'GET' && $id && $action === 'installments') {
    Auth::requireAuth('admin');
    try {
        $installments = $conn->fetchAll(
            "SELECT * FROM remquip_order_installments WHERE order_id = :id ORDER BY installment_number ASC",
            ['id' => $id]
        );
        ResponseHelper::sendSuccess($installments, 'Installments retrieved');
    } catch (Exception $e) {
        Logger::error('Get installments error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve installments', 500);
    }
}

// ── PATCH /orders/:id/installments/:instNum — mark installment as paid ──
if (($method === 'PATCH' || $method === 'PUT') && $id && $action === 'installments') {
    Auth::requireAuth('admin');
    $instId = $routeSegments[2] ?? null;
    if (!$instId) { ResponseHelper::sendError('Installment ID required', 400); }
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $newStatus = trim($data['status'] ?? 'paid');
        $paymentRef = $data['payment_ref'] ?? null;

        $conn->execute(
            "UPDATE remquip_order_installments SET status = :status, paid_at = IF(:status = 'paid', NOW(), NULL), payment_ref = :ref, updated_at = NOW() WHERE id = :id AND order_id = :oid",
            ['status' => $newStatus, 'ref' => $paymentRef, 'id' => $instId, 'oid' => $id]
        );

        // Check if all installments are paid — if so, update order payment_status
        $remaining = $conn->fetch(
            "SELECT COUNT(*) as cnt FROM remquip_order_installments WHERE order_id = :oid AND status != 'paid'",
            ['oid' => $id]
        );
        if ((int)($remaining['cnt'] ?? 1) === 0) {
            $conn->execute(
                "UPDATE remquip_orders SET payment_status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = :id",
                ['id' => $id]
            );
        }

        Logger::info('Installment updated', ['order_id' => $id, 'installment_id' => $instId, 'status' => $newStatus]);
        ResponseHelper::sendSuccess(['id' => $instId, 'status' => $newStatus], 'Installment updated');
    } catch (Exception $e) {
        Logger::error('Update installment error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update installment', 500);
    }
}

ResponseHelper::sendError('Order endpoint not found', 404);
?>

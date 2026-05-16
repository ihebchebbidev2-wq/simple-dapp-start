<?php
/**
 * /user/dashboard/* — customer portal (matches USER_DASHBOARD in api-endpoints.ts)
 * Links orders to customers where customers.email = users.email (B2B account match).
 */

$auth = Auth::requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

$user = $conn->fetch(
    "SELECT id, email, full_name, role, phone, avatar_url, status, created_at, account_origin FROM remquip_users WHERE id = :id AND deleted_at IS NULL",
    ['id' => $auth['user_id']]
);
if (!$user) {
    ResponseHelper::sendError('User not found', 404);
}

$customer = $conn->fetch(
    "SELECT * FROM remquip_customers WHERE email = :email AND deleted_at IS NULL LIMIT 1",
    ['email' => $user['email']]
);

try {
    // GET /user/dashboard/profile
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'profile' && !isset($rs[2])) {
        $augmentation = (float)($customer['price_augmentation_percent'] ?? 0);

        // Per-product augmentations map { product_id => percent }
        $productAugmentations = [];
        if ($customer) {
            $paRows = $conn->fetchAll(
                "SELECT product_id, augmentation_percent FROM remquip_customer_product_prices WHERE customer_id = :cid",
                ['cid' => $customer['id']]
            );
            foreach ($paRows as $pa) {
                $productAugmentations[$pa['product_id']] = (float)$pa['augmentation_percent'];
            }
        }

        $contractValidated = $customer ? (bool)(int)($customer['contract_validated'] ?? 0) : false;
        $customerCategory = $customer ? ($customer['category'] ?? 'lead') : 'lead';
        $accountOrigin = $user['account_origin'] ?? 'register';

        ResponseHelper::sendSuccess(array_merge($user, [
            'customer' => $customer,
            'price_augmentation_percent' => $augmentation,
            'product_augmentations' => $productAugmentations,
            'contract_validated' => $contractValidated,
            'customer_category' => $customerCategory,
            'account_origin' => $accountOrigin,
        ]), 'Profile');
    }

    // GET /user/dashboard/orders
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'orders' && !isset($rs[2])) {
        if (!$customer) {
            ResponseHelper::sendPaginated([], 0, 20, 0, 'No linked customer record for your email');
            exit;
        }
        $limit = min((int)($_GET['limit'] ?? 20), 100);
        $offset = (int)($_GET['offset'] ?? 0);
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $total = (int)($conn->fetch(
            "SELECT COUNT(*) as t FROM remquip_orders WHERE customer_id = :cid AND deleted_at IS NULL",
            ['cid' => $customer['id']]
        )['t'] ?? 0);
        $orders = $conn->fetchAll(
            "SELECT o.id, o.order_number, o.status, o.total, o.payment_status, o.created_at,
                    (SELECT COUNT(*) FROM remquip_order_items oi WHERE oi.order_id = o.id) AS items_count
             FROM remquip_orders o
             WHERE o.customer_id = :cid AND o.deleted_at IS NULL
             ORDER BY o.created_at DESC LIMIT :limit OFFSET :offset",
            ['cid' => $customer['id'], 'limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($orders, $total, $limit, $offset, 'Your orders');
    }

    // GET /user/dashboard/orders/summary
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'orders' && ($rs[2] ?? '') === 'summary') {
        if (!$customer) {
            ResponseHelper::sendSuccess(['orderCount' => 0, 'totalSpent' => 0], 'Summary');
            exit;
        }
        $sum = $conn->fetch(
            "SELECT COUNT(*) as c, COALESCE(SUM(total), 0) as s FROM remquip_orders WHERE customer_id = :cid AND deleted_at IS NULL",
            ['cid' => $customer['id']]
        );
        ResponseHelper::sendSuccess([
            'orderCount' => (int)($sum['c'] ?? 0),
            'totalSpent' => (float)($sum['s'] ?? 0),
        ], 'Order summary');
    }

    // GET /user/dashboard/orders/:id/receipt
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'orders' && isset($rs[2]) && ($rs[3] ?? '') === 'receipt') {
        if (!$customer) {
            ResponseHelper::sendError('No linked customer record for your email', 404);
            exit;
        }

        $orderId = (string)$rs[2];
        try {
            $order = $conn->fetch(
                "SELECT
                    o.id,
                    o.order_number,
                    o.status,
                    o.payment_status,
                    o.created_at as order_date,
                    o.subtotal as subtotal,
                    o.tax as tax_amount,
                    o.shipping as shipping_amount,
                    o.discount as discount_amount,
                    o.total as total_amount,
                    o.shipping_address,
                    o.notes
                 FROM remquip_orders o
                 WHERE o.customer_id = :cid AND o.id = :id AND o.deleted_at IS NULL",
                ['cid' => $customer['id'], 'id' => $orderId]
            );

            if (!$order) {
                ResponseHelper::sendError('Order not found', 404);
            }

            $items = $conn->fetchAll(
                "SELECT
                    oi.id,
                    oi.order_id,
                    oi.product_id,
                    p.name as product_name,
                    p.sku as product_sku,
                    oi.quantity,
                    oi.unit_price,
                    oi.line_total as subtotal,
                    oi.created_at
                 FROM remquip_order_items oi
                 LEFT JOIN remquip_products p ON oi.product_id = p.id
                 WHERE oi.order_id = :id
                 ORDER BY oi.created_at ASC",
                ['id' => $orderId]
            );

            $order['items'] = $items;
            ResponseHelper::sendSuccess($order, 'Order receipt retrieved');
        } catch (Exception $e) {
            Logger::error('User order receipt error', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to retrieve order receipt', 500);
        }
    }

    // GET /user/dashboard/addresses
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'addresses' && !isset($rs[2])) {
        if (!$customer) {
            ResponseHelper::sendSuccess([], 'Addresses');
            exit;
        }
        $addresses = [];
        // Primary / billing address
        if (($customer['address'] ?? '') !== '' || ($customer['billing_address'] ?? '') !== '' || ($customer['city'] ?? '') !== '') {
            $addresses[] = [
                'type' => 'billing',
                'address' => $customer['billing_address'] ?? $customer['address'] ?? '',
                'address_2' => $customer['billing_address_2'] ?? $customer['address_2'] ?? '',
                'city' => $customer['billing_city'] ?? $customer['city'] ?? '',
                'province' => $customer['billing_province'] ?? $customer['province'] ?? '',
                'postal_code' => $customer['billing_postal_code'] ?? $customer['postal_code'] ?? '',
                'country' => $customer['billing_country'] ?? $customer['country'] ?? '',
            ];
        }
        // Shipping address (only if distinct fields exist)
        if (($customer['shipping_address'] ?? '') !== '' || ($customer['shipping_city'] ?? '') !== '') {
            $addresses[] = [
                'type' => 'shipping',
                'address' => $customer['shipping_address'] ?? '',
                'address_2' => $customer['shipping_address_2'] ?? '',
                'city' => $customer['shipping_city'] ?? '',
                'province' => $customer['shipping_province'] ?? '',
                'postal_code' => $customer['shipping_postal_code'] ?? '',
                'country' => $customer['shipping_country'] ?? '',
            ];
        }
        ResponseHelper::sendSuccess($addresses, 'Addresses');
    }

    // GET /user/dashboard/settings — merge `settings` keys portal_* + default toggles
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'settings' && !isset($rs[2])) {
        $emailNotif = true;
        try {
            $row = $conn->fetch(
                "SELECT setting_value FROM remquip_settings WHERE setting_key = 'portal_email_notifications_default' LIMIT 1"
            );
            if ($row && isset($row['setting_value'])) {
                $v = strtolower(trim((string)$row['setting_value']));
                $emailNotif = $v === '1' || $v === 'true' || $v === 'yes';
            }
        } catch (Exception $e) {
            // ignore
        }
        ResponseHelper::sendSuccess([
            'emailNotifications' => $emailNotif,
            'phone' => $user['phone'] ?? '',
        ], 'Settings');
    }

    // PUT /user/dashboard/settings
    if (($method === 'PUT' || $method === 'PATCH') && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'settings' && !isset($rs[2])) {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (isset($data['phone'])) {
            $conn->execute(
                "UPDATE remquip_users SET phone = :phone, updated_at = NOW() WHERE id = :id",
                ['phone' => trim($data['phone']), 'id' => $auth['user_id']]
            );
        }
        ResponseHelper::sendSuccess([], 'Settings updated');
    }

    // PUT /user/dashboard/address — save billing/shipping address back to linked customer
    if (($method === 'PUT' || $method === 'PATCH') && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'address' && !isset($rs[2])) {
        if (!$customer) {
            ResponseHelper::sendError('No linked customer record', 404);
            exit;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $customer['id']];

        // Allowed fields a customer may self-update (addresses + tax)
        $allowedFields = [
            'phone', 'tax_number',
            'address', 'address_2', 'city', 'province', 'postal_code', 'country',
            'billing_address', 'billing_address_2', 'billing_city', 'billing_province', 'billing_postal_code', 'billing_country',
            'shipping_address', 'shipping_address_2', 'shipping_city', 'shipping_province', 'shipping_postal_code', 'shipping_country',
        ];
        foreach ($allowedFields as $f) {
            if (array_key_exists($f, $data)) {
                $updates[] = "$f = :$f";
                $params[$f] = $data[$f] ?? '';
            }
        }
        if (empty($updates)) {
            ResponseHelper::sendSuccess(['id' => $customer['id']], 'No changes');
            exit;
        }
        $updates[] = 'updated_at = NOW()';
        try {
            $conn->execute('UPDATE remquip_customers SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);
            ResponseHelper::sendSuccess(['id' => $customer['id']], 'Address updated');
        } catch (Exception $e) {
            Logger::error('User address update error', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to update address', 500);
        }
        exit;
    }
    // GET /user/dashboard/contacts — same directory as admin-contacts/available (for api.getAdminContacts)
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'contacts' && !isset($rs[2])) {
        try {
            $rows = $conn->fetchAll(
                "SELECT id, name, email, phone, department, specialization, is_available, display_order AS sort_order, created_at, updated_at
                 FROM remquip_admin_contacts
                 WHERE is_available = 1
                 ORDER BY display_order ASC, name ASC"
            );

            // If this customer has an assigned owner, show them first in the portal list.
            $assignedId = $customer['assigned_contact_id'] ?? null;
            if ($assignedId) {
                usort($rows, function ($a, $b) use ($assignedId) {
                    if (($a['id'] ?? null) === $assignedId) return -1;
                    if (($b['id'] ?? null) === $assignedId) return 1;
                    return 0;
                });
            }
            ResponseHelper::sendSuccess(['items' => $rows], 'Contacts');
        } catch (Exception $e) {
            ResponseHelper::sendSuccess(['items' => []], 'Contacts');
        }
    }

    // GET /user/dashboard/notes — public (is_internal = 0) customer notes
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'notes' && !isset($rs[2])) {
        if (!$customer) {
            ResponseHelper::sendSuccess(['items' => []], 'Notes');
            exit;
        }
        try {
            $limit = min((int)($_GET['limit'] ?? 20), 100);
            $offset = (int)($_GET['offset'] ?? 0);
            if (isset($_GET['page'])) {
                $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
            }

            $total = (int)($conn->fetch(
                "SELECT COUNT(*) as t FROM remquip_customer_notes WHERE customer_id = :cid AND is_internal = 0",
                ['cid' => $customer['id']]
            )['t'] ?? 0);

            $rows = $conn->fetchAll(
                "SELECT id, note, is_internal, created_at
                 FROM remquip_customer_notes
                 WHERE customer_id = :cid AND is_internal = 0
                 ORDER BY created_at DESC
                 LIMIT :limit OFFSET :offset",
                ['cid' => $customer['id'], 'limit' => $limit, 'offset' => $offset]
            );

            ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Notes');
        } catch (Exception $e) {
            Logger::error('User dashboard notes error', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to retrieve notes', 500);
        }
    }

    // GET /user/dashboard/installments — list all installments for this customer's orders
    if ($method === 'GET' && ($rs[0] ?? '') === 'dashboard' && ($rs[1] ?? '') === 'installments' && !isset($rs[2])) {
        if (!$customer) {
            ResponseHelper::sendSuccess([], 'Installments');
            exit;
        }
        try {
            $rows = $conn->fetchAll(
                "SELECT i.id, i.order_id, i.installment_number, i.amount, i.due_date, i.status, i.paid_at, i.payment_ref,
                        o.order_number, o.total as order_total, o.installment_count, o.status as order_status
                 FROM remquip_order_installments i
                 INNER JOIN remquip_orders o ON i.order_id = o.id AND o.deleted_at IS NULL
                 WHERE o.customer_id = :cid
                 ORDER BY i.due_date ASC, i.installment_number ASC",
                ['cid' => $customer['id']]
            );
            ResponseHelper::sendSuccess($rows, 'Installments retrieved');
        } catch (Exception $e) {
            Logger::error('User installments error', ['error' => $e->getMessage()]);
            ResponseHelper::sendSuccess([], 'Installments');
        }
    }
} catch (Exception $e) {
    Logger::error('User dashboard error', ['error' => $e->getMessage()]);
    ResponseHelper::sendError('User dashboard request failed', 500);
}

ResponseHelper::sendError('User endpoint not found', 404);

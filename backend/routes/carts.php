<?php
/**
 * Abandoned Carts API
 *
 * POST /carts          - Upsert an abandoned cart (Public/Customer)
 * GET  /carts          - List abandoned carts (Admin only)
 * PATCH /carts/:id     - Update cart status (Admin only)
 *
 * Uses the `$conn` Database instance and `$id`/`$method` vars injected by router.php.
 */

// POST /carts — public, no auth required
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (empty($data['email'])) {
        ResponseHelper::sendError('Email is required', 400);
    }

    $email = trim((string)$data['email']);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ResponseHelper::sendError('Invalid email format', 400);
    }

    $cartJson = json_encode($data['cart_data'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    try {
        $existing = $conn->fetch(
            "SELECT id FROM abandoned_carts WHERE email = :email AND status = 'abandoned' ORDER BY created_at DESC LIMIT 1",
            ['email' => $email]
        );

        if ($existing) {
            $conn->execute(
                "UPDATE abandoned_carts SET cart_data = :cart_data, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
                ['cart_data' => $cartJson, 'id' => $existing['id']]
            );
            $cartId = $existing['id'];
        } else {
            $conn->execute(
                "INSERT INTO abandoned_carts (email, cart_data, status) VALUES (:email, :cart_data, 'abandoned')",
                ['email' => $email, 'cart_data' => $cartJson]
            );
            $cartId = $conn->lastInsertId();
        }

        ResponseHelper::sendSuccess(['id' => $cartId, 'status' => 'tracked'], 'Cart tracked');
    } catch (Exception $e) {
        Logger::error('Failed to track abandoned cart', ['error' => $e->getMessage()]);
        // Fail silently so it doesn't break checkout flow
        ResponseHelper::sendSuccess(['status' => 'ignored'], 'Tracked ignored');
    }
}

// GET /carts — admin only: list abandoned carts
if ($method === 'GET') {
    Auth::requireAuth('admin');

    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;
    $status = trim($_GET['status'] ?? '');

    try {
        $where  = $status !== '' ? 'WHERE status = :status' : '';
        $params = $status !== '' ? ['status' => $status] : [];

        $total = (int)($conn->fetch("SELECT COUNT(*) as t FROM abandoned_carts $where", $params)['t'] ?? 0);

        $rows = $conn->fetchAll(
            "SELECT * FROM abandoned_carts $where ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
            array_merge($params, ['limit' => $limit, 'offset' => $offset])
        );

        foreach ($rows as &$row) {
            $row['cart_data'] = json_decode((string)($row['cart_data'] ?? '[]'), true);
        }
        unset($row);

        ResponseHelper::sendPaginated($rows, $total, $limit, ($page - 1) * $limit, 'Abandoned carts');
    } catch (Exception $e) {
        Logger::error('Failed to fetch abandoned carts', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch abandoned carts', 500);
    }
}

// PATCH /carts/:id — admin only: update cart status
if ($method === 'PATCH' && $id) {
    Auth::requireAuth('admin');

    $data      = json_decode(file_get_contents('php://input'), true) ?? [];
    $newStatus = $data['status'] ?? '';

    if (!in_array($newStatus, ['abandoned', 'recovered', 'completed'], true)) {
        ResponseHelper::sendError('Invalid status. Must be abandoned, recovered, or completed', 400);
    }

    try {
        $conn->execute(
            "UPDATE abandoned_carts SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
            ['status' => $newStatus, 'id' => $id]
        );
        ResponseHelper::sendSuccess(null, 'Cart status updated');
    } catch (Exception $e) {
        Logger::error('Failed to update cart status', ['error' => $e->getMessage(), 'id' => $id]);
        ResponseHelper::sendError('Failed to update status', 500);
    }
}

ResponseHelper::sendError('Method not allowed', 405);

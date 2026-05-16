<?php
/**
 * INVENTORY ROUTES - Stock management
 * Also: POST /inventory/adjust, GET /inventory/logs, GET /inventory/low-stock,
 * GET /inventory/product/:id/history (api-endpoints INVENTORY.*)
 */

$method = $_SERVER['REQUEST_METHOD'];
Auth::requireAuth('admin');

$rs = $routeSegments ?? [];

// POST /inventory/adjust — body: product_id, quantity_change, notes (matches api.adjustInventory)
if ($method === 'POST' && ($rs[0] ?? '') === 'adjust') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $productId = $data['product_id'] ?? $data['productId'] ?? null;
    $delta = isset($data['quantity_change']) ? (int)$data['quantity_change'] : null;
    if (!$productId || $delta === null) {
        ResponseHelper::sendError('product_id and quantity_change are required', 400);
    }
    try {
        $old = $conn->fetch(
            'SELECT inv.quantity_on_hand, inv.quantity_reserved, inv.reorder_level, p.sku, p.name
             FROM remquip_inventory inv INNER JOIN remquip_products p ON p.id = inv.product_id AND p.deleted_at IS NULL
             WHERE inv.product_id = :id',
            ['id' => $productId]
        );
        if (!$old) {
            ResponseHelper::sendError('Inventory not found for product', 404);
        }
        $reserved = (int)$old['quantity_reserved'];
        $oldOnHand = (int)$old['quantity_on_hand'];
        $oldAvail = $oldOnHand - $reserved;
        $reorderLevel = (int)$old['reorder_level'];
        $newQty = $oldOnHand + $delta;
        if ($newQty < 0) {
            ResponseHelper::sendError('Insufficient stock', 400);
        }
        $conn->execute(
            'UPDATE remquip_inventory SET quantity_on_hand = :q, updated_at = NOW() WHERE product_id = :id',
            ['q' => $newQty, 'id' => $productId]
        );
        $newAvail = $newQty - $reserved;
        if ($reorderLevel > 0 && $oldAvail > $reorderLevel && $newAvail <= $reorderLevel) {
            remquip_notify_low_stock($conn, $old['sku'], $old['name'], $newAvail, $reorderLevel);
        }
        $tok = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $conn->execute(
            'INSERT INTO remquip_inventory_logs (product_id, user_id, action, quantity_change, reason, old_quantity, new_quantity)
             VALUES (:pid, :uid, :act, :chg, :reason, :oldq, :newq)',
            [
                'pid' => $productId,
                'uid' => $payload['user_id'] ?? null,
                'act' => 'adjustment',
                'chg' => $delta,
                'reason' => $data['notes'] ?? $data['reason'] ?? 'Adjust',
                'oldq' => $old['quantity_on_hand'],
                'newq' => $newQty,
            ]
        );
        ResponseHelper::sendSuccess(['product_id' => $productId, 'quantity_on_hand' => $newQty], 'Stock adjusted');
    } catch (Exception $e) {
        Logger::error('Inventory adjust error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Adjust failed', 500);
    }
}

// GET /inventory/logs — global log (admin)
if ($method === 'GET' && ($rs[0] ?? '') === 'logs' && ($rs[1] ?? '') !== 'users' && !isset($rs[1])) {
    try {
        $limit = min((int)($_GET['limit'] ?? 50), 200);
        $offset = (int)($_GET['offset'] ?? 0);
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $total = (int)($conn->fetch('SELECT COUNT(*) as t FROM remquip_inventory_logs')['t'] ?? 0);
        $rows = $conn->fetchAll(
            'SELECT il.*, u.full_name as user_name, p.sku
             FROM remquip_inventory_logs il
             LEFT JOIN remquip_users u ON il.user_id = u.id
             LEFT JOIN remquip_products p ON il.product_id = p.id
             ORDER BY il.created_at DESC
             LIMIT :limit OFFSET :offset',
            ['limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Inventory logs');
    } catch (Exception $e) {
        Logger::error('Inventory logs list error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load logs', 500);
    }
}

// GET /inventory/low-stock
if ($method === 'GET' && ($rs[0] ?? '') === 'low-stock') {
    try {
        $rows = $conn->fetchAll(
            'SELECT p.id, p.sku, p.name, inv.quantity_on_hand, inv.reorder_level, inv.quantity_available
             FROM remquip_inventory inv
             INNER JOIN remquip_products p ON inv.product_id = p.id AND p.deleted_at IS NULL
             WHERE inv.quantity_available <= inv.reorder_level
             ORDER BY inv.quantity_available ASC
             LIMIT 100'
        );
        ResponseHelper::sendSuccess($rows, 'Low stock products');
    } catch (Exception $e) {
        Logger::error('Low stock error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load low stock', 500, ['error' => $e->getMessage()]);
    }
}

// GET /inventory/product/:productId/history
if ($method === 'GET' && ($rs[0] ?? '') === 'product' && isset($rs[1]) && ($rs[2] ?? '') === 'history') {
    $pid = $rs[1];
    try {
        $limit = min((int)($_GET['limit'] ?? 50), 200);
        $offset = (int)($_GET['offset'] ?? 0);
        $total = (int)($conn->fetch('SELECT COUNT(*) as t FROM remquip_inventory_logs WHERE product_id = :id', ['id' => $pid])['t'] ?? 0);
        $rows = $conn->fetchAll(
            'SELECT il.*, u.full_name as user_name FROM remquip_inventory_logs il
             LEFT JOIN remquip_users u ON il.user_id = u.id
             WHERE il.product_id = :id
             ORDER BY il.created_at DESC
             LIMIT :limit OFFSET :offset',
            ['id' => $pid, 'limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Product inventory history');
    } catch (Exception $e) {
        Logger::error('Product inventory history error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load history', 500);
    }
}

// GET /inventory - List inventory (Admin)
if ($method === 'GET' && !$id) {
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $lowStock = isset($_GET['lowStock']) ? $_GET['lowStock'] === 'true' : false;
        
        $where = ['p.deleted_at IS NULL'];
        $params = [];
        
        if ($search) {
            $where[] = "(p.sku LIKE :search OR p.name LIKE :search)";
            $params['search'] = "%$search%";
        }
        
        if ($lowStock) {
            $where[] = "inv.quantity_available <= inv.reorder_level";
        }
        
        $whereClause = implode(' AND ', $where);
        
        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_inventory inv LEFT JOIN remquip_products p ON inv.product_id = p.id WHERE $whereClause",
            $params
        )['total'] ?? 0;
        
        $params['limit'] = $limit;
        $params['offset'] = $offset;
        
        $inventory = $conn->fetchAll(
            "SELECT p.id as productId, p.sku, p.name,
                    inv.quantity_on_hand as onHand, inv.quantity_reserved as reserved,
                    inv.quantity_available as available, inv.reorder_level, inv.reorder_quantity,
                    inv.warehouse_location
             FROM remquip_inventory inv
             LEFT JOIN remquip_products p ON inv.product_id = p.id
             WHERE $whereClause
             ORDER BY inv.quantity_available ASC
             LIMIT :limit OFFSET :offset",
            $params
        );
        
        ResponseHelper::sendPaginated($inventory, $total, $limit, $offset, 'Inventory retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get inventory error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve inventory', 500);
    }
}

// PATCH/PUT /inventory/:id - Adjust stock (Admin)
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (!isset($data['quantityOnHand'])) {
            ResponseHelper::sendError('Quantity is required', 400);
        }
        
        $oldInventory = $conn->fetch(
            "SELECT quantity_on_hand FROM remquip_inventory WHERE product_id = :id",
            ['id' => $id]
        );
        
        if (!$oldInventory) {
            ResponseHelper::sendError('Inventory record not found', 404);
        }
        
        $quantityChange = $data['quantityOnHand'] - $oldInventory['quantity_on_hand'];
        
        $conn->execute(
            "UPDATE remquip_inventory SET quantity_on_hand = :qty, warehouse_location = :location, updated_at = NOW() WHERE product_id = :id",
            [
                'qty' => $data['quantityOnHand'],
                'location' => $data['warehouseLocation'] ?? '',
                'id' => $id
            ]
        );
        
        // Log the change (token optional when ADMIN_NO_AUTH is enabled)
        $tok = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $conn->execute(
            "INSERT INTO remquip_inventory_logs (product_id, user_id, action, quantity_change, reason, old_quantity, new_quantity)
             VALUES (:productId, :userId, :action, :change, :reason, :oldQty, :newQty)",
            [
                'productId' => $id,
                'userId' => $payload['user_id'] ?? null,
                'action' => 'adjustment',
                'change' => $quantityChange,
                'reason' => $data['reason'] ?? 'Manual adjustment',
                'oldQty' => $oldInventory['quantity_on_hand'],
                'newQty' => $data['quantityOnHand']
            ]
        );
        
        Logger::info('Inventory adjusted', ['product_id' => $id, 'change' => $quantityChange]);
        ResponseHelper::sendSuccess(['id' => $id, 'quantityOnHand' => $data['quantityOnHand']], 'Inventory updated');
        
    } catch (Exception $e) {
        Logger::error('Update inventory error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update inventory', 500);
    }
}

// GET /inventory/:id/logs - Get inventory change history
if ($method === 'GET' && $id && $action === 'logs') {
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_inventory_logs WHERE product_id = :id",
            ['id' => $id]
        )['total'] ?? 0;
        
        $logs = $conn->fetchAll(
            "SELECT il.*, u.full_name as user_name
             FROM remquip_inventory_logs il
             LEFT JOIN remquip_users u ON il.user_id = u.id
             WHERE il.product_id = :id
             ORDER BY il.created_at DESC
             LIMIT :limit OFFSET :offset",
            ['id' => $id, 'limit' => $limit, 'offset' => $offset]
        );
        
        ResponseHelper::sendPaginated($logs, $total, $limit, $offset, 'Inventory logs retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get inventory logs error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve logs', 500);
    }
}
?>

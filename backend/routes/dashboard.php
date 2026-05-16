<?php
/**
 * GET /dashboard/* — Admin overview widgets (matches api-endpoints DASHBOARD.*)
 */

Auth::requireAuth('admin');

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

try {
    // GET /dashboard/stats
    if ($method === 'GET' && ($rs[0] ?? '') === 'stats' && !isset($rs[1])) {
        $orderCount = (int)($conn->fetch("SELECT COUNT(*) as c FROM remquip_orders WHERE deleted_at IS NULL")['c'] ?? 0);
        $revenue = (float)($conn->fetch(
            "SELECT COALESCE(SUM(total), 0) as r FROM remquip_orders WHERE deleted_at IS NULL AND status IN ('shipped', 'delivered', 'completed')"
        )['r'] ?? 0);
        $productCount = (int)($conn->fetch("SELECT COUNT(*) as c FROM remquip_products WHERE deleted_at IS NULL")['c'] ?? 0);
        $customerCount = (int)($conn->fetch("SELECT COUNT(*) as c FROM remquip_customers WHERE deleted_at IS NULL")['c'] ?? 0);

        ResponseHelper::sendSuccess([
            'totalOrders' => $orderCount,
            'totalRevenue' => $revenue,
            'totalProducts' => $productCount,
            'totalCustomers' => $customerCount,
        ], 'Dashboard stats');
    }

    // GET /dashboard/recent-orders
    if ($method === 'GET' && ($rs[0] ?? '') === 'recent-orders' && !isset($rs[1])) {
        $rows = $conn->fetchAll(
            "SELECT o.id, o.order_number, o.total, o.status, o.created_at, c.company_name as customer
             FROM remquip_orders o
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE o.deleted_at IS NULL
             ORDER BY o.created_at DESC
             LIMIT 10"
        );
        ResponseHelper::sendSuccess($rows, 'Recent orders');
    }

    // GET /dashboard/activity-log
    if ($method === 'GET' && ($rs[0] ?? '') === 'activity-log' && !isset($rs[1])) {
        try {
            $rows = $conn->fetchAll(
                "SELECT id, user_id, entity_type, entity_id, action, created_at
                 FROM remquip_audit_logs
                 ORDER BY created_at DESC
                 LIMIT 50"
            );
        } catch (Exception $e) {
            $rows = [];
        }
        ResponseHelper::sendSuccess($rows, 'Activity log');
    }

    // GET /dashboard/top-products
    if ($method === 'GET' && ($rs[0] ?? '') === 'top-products' && !isset($rs[1])) {
        $rows = $conn->fetchAll(
            "SELECT p.id, p.sku, p.name, SUM(oi.quantity) as units_sold, SUM(oi.line_total) as revenue
             FROM remquip_order_items oi
             INNER JOIN remquip_products p ON oi.product_id = p.id
             INNER JOIN remquip_orders o ON oi.order_id = o.id AND o.deleted_at IS NULL
             GROUP BY p.id
             ORDER BY revenue DESC
             LIMIT 10"
        );
        ResponseHelper::sendSuccess($rows, 'Top products');
    }
} catch (Exception $e) {
    Logger::error('Dashboard route error', ['error' => $e->getMessage()]);
    ResponseHelper::sendError('Dashboard request failed', 500, ['error' => $e->getMessage()]);
}

ResponseHelper::sendError('Dashboard endpoint not found', 404);

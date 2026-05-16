<?php
/**
 * ANALYTICS ROUTES - Dashboard metrics + `analytics` table (events)
 */

$method = $_SERVER['REQUEST_METHOD'];

// =====================================================================
// POST /analytics/events — public (optional Bearer → user_id); writes `analytics`
// =====================================================================
if ($method === 'POST' && $id === 'events' && !$action) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $eventType = preg_replace('/[^a-zA-Z0-9_.-]/', '', (string)($data['event_type'] ?? ''));
        if ($eventType === '' || strlen($eventType) > 100) {
            ResponseHelper::sendError('event_type required (alphanumeric, dot, hyphen, underscore; max 100)', 400);
        }

        $payloadJson = null;
        if (isset($data['data']) && (is_array($data['data']) || is_object($data['data']))) {
            $payloadJson = json_encode($data['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (strlen($payloadJson) > 16000) {
                $payloadJson = json_encode(['_truncated' => true], JSON_UNESCAPED_UNICODE);
            }
        }

        $userId = null;
        $customerId = null;
        $tok = Auth::getToken();
        if ($tok) {
            $pl = Auth::verifyToken($tok);
            if ($pl && !empty($pl['user_id'])) {
                $userId = $pl['user_id'];
            }
        }
        if (!empty($data['customer_id']) && is_string($data['customer_id']) && strlen($data['customer_id']) <= 40) {
            $customerId = $data['customer_id'];
        }

        $ipRaw = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
        $ip = trim(explode(',', $ipRaw)[0]);
        if (strlen($ip) > 45) {
            $ip = substr($ip, 0, 45);
        }
        $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 512);

        $eid = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_analytics (id, event_type, customer_id, user_id, data, ip_address, user_agent)
             VALUES (:id, :et, :cid, :uid, :data, :ip, :ua)',
            [
                'id' => $eid,
                'et' => $eventType,
                'cid' => $customerId,
                'uid' => $userId,
                'data' => $payloadJson,
                'ip' => $ip !== '' ? $ip : null,
                'ua' => $ua !== '' ? $ua : null,
            ]
        );

        ResponseHelper::sendSuccess(['id' => $eid], 'Event recorded', 201);
    } catch (Exception $e) {
        Logger::error('Analytics event error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to record event', 500);
    }
}

Auth::requireAuth('admin');

// =====================================================================
// GET /analytics/events/summary — counts from `analytics` table
// =====================================================================
if ($method === 'GET' && $id === 'events' && $action === 'summary') {
    try {
        $days = max(1, min(365, (int)($_GET['days'] ?? 30)));
        $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        $pageViews = (int)($conn->fetch(
            "SELECT COUNT(*) AS c FROM remquip_analytics WHERE event_type = 'page_view' AND created_at >= :s",
            ['s' => $since]
        )['c'] ?? 0);
        $total = (int)($conn->fetch(
            'SELECT COUNT(*) AS c FROM remquip_analytics WHERE created_at >= :s',
            ['s' => $since]
        )['c'] ?? 0);
        $byType = $conn->fetchAll(
            "SELECT event_type, COUNT(*) AS cnt FROM remquip_analytics WHERE created_at >= :s GROUP BY event_type ORDER BY cnt DESC LIMIT 25",
            ['s' => $since]
        );
        ResponseHelper::sendSuccess([
            'days' => $days,
            'since' => $since,
            'total_events' => $total,
            'page_views' => $pageViews,
            'by_event_type' => $byType,
        ], 'Analytics summary');
    } catch (Exception $e) {
        Logger::error('Analytics summary error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load summary', 500);
    }
}

// =====================================================================
// GET /analytics/events — paginated raw events (admin)
// =====================================================================
if ($method === 'GET' && $id === 'events' && !$action) {
    try {
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $type = isset($_GET['event_type']) ? preg_replace('/[^a-zA-Z0-9_.-]/', '', (string)$_GET['event_type']) : '';
        $where = '1=1';
        $paramsCount = [];
        if ($type !== '') {
            $where = 'event_type = :et';
            $paramsCount['et'] = $type;
        }
        $total = (int)($conn->fetch("SELECT COUNT(*) AS t FROM remquip_analytics WHERE $where", $paramsCount)['t'] ?? 0);
        $params = array_merge($paramsCount, ['limit' => $limit, 'offset' => $offset]);
        $rows = $conn->fetchAll(
            "SELECT id, event_type, customer_id, user_id, data, ip_address, user_agent, created_at
             FROM remquip_analytics WHERE $where ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
            $params
        );
        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Analytics events');
    } catch (Exception $e) {
        Logger::error('Analytics events list error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to list events', 500);
    }
}

// GET /analytics/dashboard - Dashboard overview
if ($method === 'GET' && $id === 'dashboard' && !$action) {
    try {
        // Total revenue
        $revenue = $conn->fetch(
            "SELECT SUM(total) as total_revenue FROM remquip_orders WHERE status IN ('shipped', 'delivered', 'completed') AND deleted_at IS NULL"
        )['total_revenue'] ?? 0;
        
        // Total orders
        $totalOrders = $conn->fetch(
            "SELECT COUNT(*) as count FROM remquip_orders WHERE deleted_at IS NULL"
        )['count'] ?? 0;
        
        // Total products
        $totalProducts = $conn->fetch(
            "SELECT COUNT(*) as count FROM remquip_products WHERE deleted_at IS NULL"
        )['count'] ?? 0;
        
        // Active customers
        $activeCustomers = $conn->fetch(
            "SELECT COUNT(*) as count FROM remquip_customers WHERE status = 'active' AND deleted_at IS NULL"
        )['count'] ?? 0;
        
        // Recent orders
        $recentOrders = $conn->fetchAll(
            "SELECT o.id, o.order_number, c.company_name as customer, o.total, o.status, o.created_at
             FROM remquip_orders o
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE o.deleted_at IS NULL
             ORDER BY o.created_at DESC LIMIT 5"
        );
        
        // Low stock products
        $lowStock = $conn->fetchAll(
            "SELECT p.id, p.sku, p.name, inv.quantity_available as stock, inv.reorder_level
             FROM remquip_inventory inv
             LEFT JOIN remquip_products p ON inv.product_id = p.id
             WHERE inv.quantity_available <= inv.reorder_level AND p.deleted_at IS NULL
             ORDER BY inv.quantity_available ASC LIMIT 10"
        );
        
        // Monthly revenue trend
        $monthlyRevenue = $conn->fetchAll(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(total) as revenue, COUNT(*) as orders
             FROM remquip_orders
            WHERE status IN ('shipped', 'delivered', 'completed') AND deleted_at IS NULL
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month DESC LIMIT 12"
        );

        $pageViews30d = (int)($conn->fetch(
            "SELECT COUNT(*) AS c FROM remquip_analytics WHERE event_type = 'page_view' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )['c'] ?? 0);
        $events30d = (int)($conn->fetch(
            "SELECT COUNT(*) AS c FROM remquip_analytics WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )['c'] ?? 0);
        
        ResponseHelper::sendSuccess([
            'summary' => [
                'totalRevenue' => (float)$revenue,
                'totalOrders' => (int)$totalOrders,
                'totalProducts' => (int)$totalProducts,
                'activeCustomers' => (int)$activeCustomers,
                'page_views' => $pageViews30d,
                'tracked_events_30d' => $events30d,
            ],
            'recentOrders' => $recentOrders,
            'lowStockProducts' => $lowStock,
            'monthlyRevenue' => $monthlyRevenue
        ], 'Dashboard data retrieved');
        
    } catch (Exception $e) {
        Logger::error('Dashboard analytics error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve dashboard data', 500, ['error' => $e->getMessage()]);
    }
}

// GET /analytics/metrics — date range (frontend: /api/analytics/metrics?start_date=&end_date=)
if ($method === 'GET' && $id === 'metrics' && !$action) {
    try {
        $start = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-d', strtotime('-30 days'));
        $end = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');
        $rows = $conn->fetchAll(
            "SELECT DATE(created_at) as day,
                    SUM(total) as revenue,
                    COUNT(*) as orders
             FROM remquip_orders
             WHERE deleted_at IS NULL
               AND DATE(created_at) BETWEEN :start AND :end
             GROUP BY DATE(created_at)
             ORDER BY day ASC",
            ['start' => $start, 'end' => $end]
        );
        ResponseHelper::sendSuccess($rows, 'Daily metrics retrieved');
    } catch (Exception $e) {
        Logger::error('Metrics analytics error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve metrics', 500);
    }
}

// GET /analytics/sales - Sales metrics by period
if ($method === 'GET' && $id === 'sales' && !$action) {
    try {
        $period = isset($_GET['period']) ? $_GET['period'] : 'month';
        
        // NOTE: Do not use PHP 8 `match()` here because the production host may run PHP < 8.
        switch ($period) {
            case 'day':
                $groupBy = 'DATE(created_at)';
                break;
            case 'week':
                $groupBy = 'WEEK(created_at)';
                break;
            case 'year':
                $groupBy = 'YEAR(created_at)';
                break;
            default:
                $groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
                break;
        }
        
        $sales = $conn->fetchAll(
            "SELECT $groupBy as period, 
                    SUM(total) as revenue,
                    COUNT(*) as orders,
                    AVG(total) as avgOrderValue,
                    MAX(total) as maxOrder,
                    MIN(total) as minOrder
             FROM remquip_orders
             WHERE status IN ('shipped', 'delivered', 'completed') AND deleted_at IS NULL
             GROUP BY $groupBy
             ORDER BY period DESC"
        );
        
        ResponseHelper::sendSuccess($sales, 'Sales metrics retrieved');
        
    } catch (Exception $e) {
        Logger::error('Sales analytics error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve sales data', 500);
    }
}

// GET /analytics/inventory - Inventory status
if ($method === 'GET' && $id === 'inventory' && !$action) {
    try {
        $inventory = [
            'totalProducts' => $conn->fetch("SELECT COUNT(*) as count FROM remquip_products WHERE deleted_at IS NULL")['count'],
            'lowStock' => $conn->fetch("SELECT COUNT(*) as count FROM remquip_inventory WHERE quantity_available <= reorder_level")['count'],
            'outOfStock' => $conn->fetch("SELECT COUNT(*) as count FROM remquip_inventory WHERE quantity_available = 0")['count'],
            'overStock' => $conn->fetch(
                "SELECT COUNT(*) as count FROM remquip_inventory WHERE quantity_on_hand > (quantity_available + quantity_reserved) * 2"
            )['count'],
            'stockByValue' => $conn->fetchAll(
                "SELECT p.sku, p.name, inv.quantity_on_hand as quantity, p.cost_price as cost,
                        (inv.quantity_on_hand * COALESCE(p.cost_price, 0)) as inventory_value
                 FROM remquip_inventory inv
                 LEFT JOIN remquip_products p ON inv.product_id = p.id
                 ORDER BY inventory_value DESC LIMIT 20"
            )
        ];
        
        ResponseHelper::sendSuccess($inventory, 'Inventory analytics retrieved');
        
    } catch (Exception $e) {
        Logger::error('Inventory analytics error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve inventory data', 500);
    }
}

// GET /analytics/customers - Customer analytics
if ($method === 'GET' && $id === 'customers' && !$action) {
    try {
        $analytics = [
            'byType' => $conn->fetchAll(
                "SELECT customer_type as type, COUNT(*) as count FROM remquip_customers WHERE deleted_at IS NULL GROUP BY customer_type"
            ),
            'byStatus' => $conn->fetchAll(
                "SELECT status, COUNT(*) as count FROM remquip_customers WHERE deleted_at IS NULL GROUP BY status"
            ),
            'topByRevenue' => $conn->fetchAll(
                "SELECT c.id, c.company_name, SUM(o.total) as total_spent, COUNT(o.id) as orders
                 FROM remquip_customers c
                 LEFT JOIN remquip_orders o ON c.id = o.customer_id AND o.deleted_at IS NULL
                 GROUP BY c.id ORDER BY total_spent DESC LIMIT 10"
            ),
            'newCustomersThisMonth' => $conn->fetch(
                "SELECT COUNT(*) as count FROM remquip_customers WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())"
            )['count']
        ];
        
        ResponseHelper::sendSuccess($analytics, 'Customer analytics retrieved');
        
    } catch (Exception $e) {
        Logger::error('Customer analytics error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve customer data', 500);
    }
}

// GET /analytics/revenue — alias for revenue stats (frontend getRevenueStats)
if ($method === 'GET' && $id === 'revenue' && !$action) {
    try {
        $start = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
        $end = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');
        $row = $conn->fetch(
            "SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as order_count
             FROM remquip_orders
             WHERE deleted_at IS NULL
               AND status IN ('shipped', 'delivered', 'completed')
               AND DATE(created_at) BETWEEN :start AND :end",
            ['start' => $start, 'end' => $end]
        );
        ResponseHelper::sendSuccess($row, 'Revenue summary retrieved');
    } catch (Exception $e) {
        Logger::error('Revenue analytics error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve revenue', 500);
    }
}

ResponseHelper::sendError('Analytics endpoint not found', 404);
?>

<?php
/**
 * GET /audit/logs, /audit/users/:userId/logs
 * Requires table audit_logs (see database/remquip_full_schema.sql)
 */

Auth::requireAuth('admin');

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

function audit_table_exists($conn) {
    try {
        $conn->fetch("SELECT 1 FROM remquip_audit_logs LIMIT 1");
        return true;
    } catch (Exception $e) {
        return false;
    }
}

try {
    if ($method === 'GET' && ($rs[0] ?? '') === 'logs' && ($rs[1] ?? '') !== 'users') {
        if (!audit_table_exists($conn)) {
            ResponseHelper::sendPaginated([], 0, (int)($_GET['limit'] ?? 20), (int)($_GET['offset'] ?? 0), 'No audit table — import database/remquip_full_schema.sql');
        }
        $limit = min((int)($_GET['limit'] ?? 20), 100);
        $offset = (int)($_GET['offset'] ?? 0);
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $total = (int)($conn->fetch("SELECT COUNT(*) as t FROM remquip_audit_logs")['t'] ?? 0);
        $rows = $conn->fetchAll(
            "SELECT * FROM remquip_audit_logs ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
            ['limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Audit logs');
    }

    if ($method === 'GET' && ($rs[0] ?? '') === 'users' && isset($rs[1]) && ($rs[2] ?? '') === 'logs') {
        $uid = $rs[1];
        if (!audit_table_exists($conn)) {
            ResponseHelper::sendPaginated([], 0, (int)($_GET['limit'] ?? 20), (int)($_GET['offset'] ?? 0), 'No audit table');
        }
        $limit = min((int)($_GET['limit'] ?? 20), 100);
        $offset = (int)($_GET['offset'] ?? 0);
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $total = (int)($conn->fetch("SELECT COUNT(*) as t FROM remquip_audit_logs WHERE user_id = :u", ['u' => $uid])['t'] ?? 0);
        $rows = $conn->fetchAll(
            "SELECT * FROM remquip_audit_logs WHERE user_id = :u ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
            ['u' => $uid, 'limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'User audit logs');
    }
} catch (Exception $e) {
    Logger::error('Audit route error', ['error' => $e->getMessage()]);
    ResponseHelper::sendError('Audit request failed', 500);
}

ResponseHelper::sendError('Audit endpoint not found', 404);

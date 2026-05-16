<?php
/**
 * /admin-contacts — directory (schema: admin_contacts in remquip_full_schema.sql)
 * GET /available — any authenticated user (customer portal).
 * Other routes — admin only.
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

$isAvailableList = $method === 'GET' && ($rs[0] ?? '') === 'available' && !isset($rs[1]);
if ($isAvailableList) {
    Auth::requireAuth();
} else {
    Auth::requireAuth('admin');
}

$selectCols = 'id, name, email, phone, department, specialization, is_available, display_order AS sort_order, created_at, updated_at';

try {
    if ($method === 'GET' && empty($rs)) {
        $rows = $conn->fetchAll(
            "SELECT $selectCols FROM remquip_admin_contacts ORDER BY display_order ASC, name ASC"
        );
        ResponseHelper::sendSuccess(['items' => $rows], 'Admin contacts');
    }

    if ($method === 'GET' && ($rs[0] ?? '') === 'department' && isset($rs[1])) {
        $dept = $rs[1];
        $rows = $conn->fetchAll(
            "SELECT $selectCols FROM remquip_admin_contacts WHERE department = :d ORDER BY display_order ASC, name ASC",
            ['d' => $dept]
        );
        ResponseHelper::sendSuccess(['items' => $rows], 'Contacts by department');
    }

    if ($method === 'GET' && ($rs[0] ?? '') === 'specialization' && isset($rs[1])) {
        $spec = $rs[1];
        $rows = $conn->fetchAll(
            "SELECT $selectCols FROM remquip_admin_contacts WHERE specialization = :s ORDER BY display_order ASC, name ASC",
            ['s' => $spec]
        );
        ResponseHelper::sendSuccess(['items' => $rows], 'Contacts by specialization');
    }

    if ($isAvailableList) {
        // Return real admin/manager users from remquip_users (not the contacts directory)
        $rows = $conn->fetchAll(
            "SELECT id, full_name AS name, email, phone, role, status
             FROM remquip_users
             WHERE role IN ('admin', 'super_admin', 'manager')
               AND status = 'active'
             ORDER BY full_name ASC"
        );
        ResponseHelper::sendSuccess(['items' => $rows], 'Available admin users');
    }

    // POST /admin-contacts — create (admin)
    if ($method === 'POST' && empty($rs)) {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty(trim($data['name'] ?? ''))) {
            ResponseHelper::sendError('Name is required', 400);
        }
        $newId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_admin_contacts (id, name, email, phone, department, specialization, is_available, display_order)
             VALUES (:id, :name, :email, :phone, :dept, :spec, :avail, :ord)',
            [
                'id' => $newId,
                'name' => trim($data['name']),
                'email' => trim($data['email'] ?? ''),
                'phone' => trim($data['phone'] ?? ''),
                'dept' => trim($data['department'] ?? ''),
                'spec' => trim($data['specialization'] ?? ''),
                'avail' => isset($data['is_available']) ? ((int) (bool) $data['is_available']) : 1,
                'ord' => isset($data['display_order']) ? (int) $data['display_order'] : (isset($data['sort_order']) ? (int) $data['sort_order'] : 0),
            ]
        );
        ResponseHelper::sendSuccess(['id' => $newId], 'Contact created', 201);
    }

    // PUT/PATCH /admin-contacts/:id — update (admin)
    if (($method === 'PUT' || $method === 'PATCH') && isset($rs[0]) && !isset($rs[1])) {
        $seg = $rs[0];
        if (in_array($seg, ['department', 'specialization', 'available'], true)) {
            ResponseHelper::sendError('Admin contacts endpoint not found', 404);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $seg];
        if (isset($data['name'])) {
            $updates[] = 'name = :name';
            $params['name'] = trim($data['name']);
        }
        if (array_key_exists('email', $data)) {
            $updates[] = 'email = :email';
            $params['email'] = trim((string) $data['email']);
        }
        if (array_key_exists('phone', $data)) {
            $updates[] = 'phone = :phone';
            $params['phone'] = trim((string) $data['phone']);
        }
        if (array_key_exists('department', $data)) {
            $updates[] = 'department = :department';
            $params['department'] = trim((string) $data['department']);
        }
        if (array_key_exists('specialization', $data)) {
            $updates[] = 'specialization = :specialization';
            $params['specialization'] = trim((string) $data['specialization']);
        }
        if (isset($data['is_available'])) {
            $updates[] = 'is_available = :is_available';
            $params['is_available'] = (int) (bool) $data['is_available'];
        }
        if (isset($data['display_order']) || isset($data['sort_order'])) {
            $updates[] = 'display_order = :display_order';
            $params['display_order'] = (int) ($data['display_order'] ?? $data['sort_order'] ?? 0);
        }
        if (!$updates) {
            ResponseHelper::sendError('No fields to update', 400);
        }
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_admin_contacts SET ' . implode(', ', $updates) . ' WHERE id = :id', $params);
        ResponseHelper::sendSuccess(['id' => $seg], 'Contact updated');
    }

    // DELETE /admin-contacts/:id — hard delete (admin)
    if ($method === 'DELETE' && isset($rs[0]) && !isset($rs[1])) {
        $seg = $rs[0];
        if (in_array($seg, ['department', 'specialization', 'available'], true)) {
            ResponseHelper::sendError('Admin contacts endpoint not found', 404);
        }
        $conn->execute('DELETE FROM remquip_admin_contacts WHERE id = :id', ['id' => $seg]);
        ResponseHelper::sendSuccess(null, 'Contact deleted');
    }

    // GET /admin-contacts/:id (UUID or numeric)
    if ($method === 'GET' && isset($rs[0]) && !isset($rs[1])) {
        $seg = $rs[0];
        if (in_array($seg, ['department', 'specialization', 'available'], true)) {
            ResponseHelper::sendError('Admin contacts endpoint not found', 404);
        }
        $row = $conn->fetch(
            "SELECT $selectCols FROM remquip_admin_contacts WHERE id = :id",
            ['id' => $seg]
        );
        if (!$row) {
            ResponseHelper::sendError('Contact not found', 404);
        }
        ResponseHelper::sendSuccess($row, 'Contact');
    }
} catch (Exception $e) {
    Logger::error('Admin contacts error', ['error' => $e->getMessage()]);
    ResponseHelper::sendError('Admin contacts failed', 500);
}

ResponseHelper::sendError('Admin contacts endpoint not found', 404);

<?php
// Lead pipeline status CRUD (admin)
//   GET    /lead-statuses              — list ordered
//   POST   /lead-statuses              — create
//   PATCH  /lead-statuses/:id          — update (label / color / sort_order / is_default)
//   DELETE /lead-statuses/:id          — delete (refuses if any lead references it)

if ($method === 'GET' && !$id) {
    try {
        $rows = $conn->fetchAll(
            "SELECT id, label, color, sort_order, is_default, created_at
             FROM remquip_lead_statuses
             ORDER BY sort_order ASC, label ASC"
        );
        ResponseHelper::sendSuccess($rows, 'Lead statuses');
    } catch (Exception $e) {
        Logger::error('List lead statuses error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to list lead statuses', 500);
    }
}

if ($method === 'POST' && !$id) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $label = trim((string)($data['label'] ?? ''));
        if ($label === '') ResponseHelper::sendError('Label required', 400);
        $color = trim((string)($data['color'] ?? '#64748b'));
        $sort = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
        $isDefault = !empty($data['is_default']) ? 1 : 0;
        $sid = $conn->fetch('SELECT UUID() AS u')['u'];
        if ($isDefault) {
            $conn->execute("UPDATE remquip_lead_statuses SET is_default = 0");
        }
        $conn->execute(
            "INSERT INTO remquip_lead_statuses (id, label, color, sort_order, is_default)
             VALUES (:id, :label, :color, :sort, :isDefault)",
            ['id' => $sid, 'label' => $label, 'color' => $color, 'sort' => $sort, 'isDefault' => $isDefault]
        );
        ResponseHelper::sendSuccess(['id' => $sid], 'Lead status created', 201);
    } catch (Exception $e) {
        Logger::error('Create lead status error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create lead status: ' . $e->getMessage(), 500);
    }
}

if (($method === 'PATCH' || $method === 'PUT') && $id) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = []; $params = ['id' => $id];
        if (array_key_exists('label', $data)) {
            $updates[] = 'label = :label'; $params['label'] = trim((string)$data['label']);
        }
        if (array_key_exists('color', $data)) {
            $updates[] = 'color = :color'; $params['color'] = trim((string)$data['color']);
        }
        if (array_key_exists('sort_order', $data)) {
            $updates[] = 'sort_order = :sort'; $params['sort'] = (int)$data['sort_order'];
        }
        if (array_key_exists('is_default', $data)) {
            if (!empty($data['is_default'])) {
                $conn->execute("UPDATE remquip_lead_statuses SET is_default = 0");
            }
            $updates[] = 'is_default = :isDefault';
            $params['isDefault'] = !empty($data['is_default']) ? 1 : 0;
        }
        if (!$updates) ResponseHelper::sendError('No fields to update', 400);
        $conn->execute('UPDATE remquip_lead_statuses SET ' . implode(', ', $updates) . ' WHERE id = :id', $params);
        ResponseHelper::sendSuccess(['id' => $id], 'Lead status updated');
    } catch (Exception $e) {
        Logger::error('Update lead status error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update lead status', 500);
    }
}

if ($method === 'DELETE' && $id) {
    Auth::requireAuth('admin');
    try {
        $used = $conn->fetch(
            'SELECT COUNT(*) AS c FROM remquip_customers WHERE lead_status_id = :id',
            ['id' => $id]
        )['c'] ?? 0;
        if ((int)$used > 0) {
            ResponseHelper::sendError("Cannot delete: $used lead(s) still use this status. Reassign them first.", 409);
        }
        $conn->execute('DELETE FROM remquip_lead_statuses WHERE id = :id', ['id' => $id]);
        ResponseHelper::sendSuccess(null, 'Lead status deleted');
    } catch (Exception $e) {
        Logger::error('Delete lead status error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete lead status', 500);
    }
}

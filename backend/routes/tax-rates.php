<?php
/**
 * TAX RATES ROUTES — Configurable tax rate management
 * GET    /tax-rates              — list active tax rates (public, no auth)
 * GET    /tax-rates/all          — list all including inactive (admin)
 * POST   /tax-rates              — create (admin)
 * PUT    /tax-rates/:id          — update (admin)
 * DELETE /tax-rates/:id          — soft-delete (admin)
 * POST   /tax-rates/reorder      — bulk reorder (admin)
 */

$method = $_SERVER['REQUEST_METHOD'];

// ── GET /tax-rates — public: active rates sorted by display_order ──
if ($method === 'GET' && (!$id || $id === 'active')) {
    try {
        $rows = $conn->fetchAll(
            'SELECT id, name, label_en, label_fr, label_es, rate, is_compound, display_order
             FROM remquip_tax_rates
             WHERE is_active = 1 AND deleted_at IS NULL
             ORDER BY display_order ASC, created_at ASC'
        );
        // Convert rate from percentage to both formats for frontend convenience
        foreach ($rows as &$r) {
            $r['rate'] = (float)$r['rate'];
            $r['rate_decimal'] = round((float)$r['rate'] / 100, 6);
            $r['is_compound'] = (bool)$r['is_compound'];
        }
        ResponseHelper::sendSuccess($rows, 'Active tax rates');
    } catch (Exception $e) {
        Logger::error('Get tax rates error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load tax rates', 500);
    }
}

// ── GET /tax-rates/all — admin: all rates including inactive ──
if ($method === 'GET' && $id === 'all') {
    Auth::requireAuth('admin');
    try {
        $rows = $conn->fetchAll(
            'SELECT id, name, label_en, label_fr, label_es, rate, is_active, is_compound, display_order, created_at, updated_at
             FROM remquip_tax_rates
             WHERE deleted_at IS NULL
             ORDER BY display_order ASC, created_at ASC'
        );
        foreach ($rows as &$r) {
            $r['rate'] = (float)$r['rate'];
            $r['rate_decimal'] = round((float)$r['rate'] / 100, 6);
            $r['is_active'] = (bool)$r['is_active'];
            $r['is_compound'] = (bool)$r['is_compound'];
        }
        ResponseHelper::sendSuccess($rows, 'All tax rates');
    } catch (Exception $e) {
        Logger::error('Get all tax rates error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load tax rates', 500);
    }
}

// ── POST /tax-rates — create new tax rate (admin) ──
if ($method === 'POST' && !$id) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['name']) || !isset($data['rate'])) {
            ResponseHelper::sendError('name and rate are required', 400);
        }
        $rate = (float)$data['rate'];
        if ($rate < 0 || $rate > 100) {
            ResponseHelper::sendError('rate must be between 0 and 100', 400);
        }
        $newId = $conn->fetch('SELECT UUID() AS u')['u'];
        $maxOrder = $conn->fetch('SELECT COALESCE(MAX(display_order), 0) + 1 AS mx FROM remquip_tax_rates WHERE deleted_at IS NULL');
        $conn->execute(
            "INSERT INTO remquip_tax_rates (id, name, label_en, label_fr, label_es, rate, is_active, is_compound, display_order)
             VALUES (:id, :name, :label_en, :label_fr, :label_es, :rate, :active, :compound, :ord)",
            [
                'id' => $newId,
                'name' => trim($data['name']),
                'label_en' => trim($data['label_en'] ?? $data['name']),
                'label_fr' => trim($data['label_fr'] ?? $data['name']),
                'label_es' => trim($data['label_es'] ?? $data['name']),
                'rate' => $rate,
                'active' => isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1,
                'compound' => isset($data['is_compound']) ? (int)(bool)$data['is_compound'] : 0,
                'ord' => (int)($data['display_order'] ?? $maxOrder['mx'] ?? 1),
            ]
        );
        Logger::info('Tax rate created', ['id' => $newId, 'name' => $data['name']]);
        ResponseHelper::sendSuccess(['id' => $newId], 'Tax rate created', 201);
    } catch (Exception $e) {
        Logger::error('Create tax rate error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create tax rate', 500);
    }
}

// ── POST /tax-rates/reorder — bulk reorder [{id, display_order}] (admin) ──
if ($method === 'POST' && $id === 'reorder') {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $data['items'] ?? $data;
        if (!is_array($items)) {
            ResponseHelper::sendError('Expected array of {id, display_order}', 400);
        }
        foreach ($items as $item) {
            if (!empty($item['id']) && isset($item['display_order'])) {
                $conn->execute(
                    'UPDATE remquip_tax_rates SET display_order = :ord, updated_at = NOW() WHERE id = :id',
                    ['ord' => (int)$item['display_order'], 'id' => $item['id']]
                );
            }
        }
        ResponseHelper::sendSuccess(['updated' => count($items)], 'Tax rates reordered');
    } catch (Exception $e) {
        Logger::error('Reorder tax rates error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to reorder tax rates', 500);
    }
}

// ── PUT/PATCH /tax-rates/:id — update (admin) ──
if (($method === 'PUT' || $method === 'PATCH') && $id && $id !== 'all' && $id !== 'active' && $id !== 'reorder') {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $id];

        if (isset($data['name'])) { $updates[] = 'name = :name'; $params['name'] = trim($data['name']); }
        if (isset($data['label_en'])) { $updates[] = 'label_en = :label_en'; $params['label_en'] = trim($data['label_en']); }
        if (isset($data['label_fr'])) { $updates[] = 'label_fr = :label_fr'; $params['label_fr'] = trim($data['label_fr']); }
        if (isset($data['label_es'])) { $updates[] = 'label_es = :label_es'; $params['label_es'] = trim($data['label_es']); }
        if (isset($data['rate'])) {
            $rate = (float)$data['rate'];
            if ($rate < 0 || $rate > 100) { ResponseHelper::sendError('rate must be between 0 and 100', 400); }
            $updates[] = 'rate = :rate'; $params['rate'] = $rate;
        }
        if (isset($data['is_active'])) { $updates[] = 'is_active = :active'; $params['active'] = (int)(bool)$data['is_active']; }
        if (isset($data['is_compound'])) { $updates[] = 'is_compound = :compound'; $params['compound'] = (int)(bool)$data['is_compound']; }
        if (isset($data['display_order'])) { $updates[] = 'display_order = :ord'; $params['ord'] = (int)$data['display_order']; }

        if (empty($updates)) { ResponseHelper::sendError('No fields to update', 400); }

        $updates[] = 'updated_at = NOW()';
        $conn->execute(
            'UPDATE remquip_tax_rates SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL',
            $params
        );
        Logger::info('Tax rate updated', ['id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Tax rate updated');
    } catch (Exception $e) {
        Logger::error('Update tax rate error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update tax rate', 500);
    }
}

// ── DELETE /tax-rates/:id — soft delete (admin) ──
if ($method === 'DELETE' && $id && $id !== 'all' && $id !== 'active' && $id !== 'reorder') {
    Auth::requireAuth('admin');
    try {
        $conn->execute(
            'UPDATE remquip_tax_rates SET deleted_at = NOW(), is_active = 0, updated_at = NOW() WHERE id = :id',
            ['id' => $id]
        );
        Logger::info('Tax rate deleted', ['id' => $id]);
        ResponseHelper::sendSuccess(null, 'Tax rate deleted');
    } catch (Exception $e) {
        Logger::error('Delete tax rate error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete tax rate', 500);
    }
}

ResponseHelper::sendError('Tax rates endpoint not found', 404);

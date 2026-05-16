<?php
/**
 * DISCOUNTS ROUTES - Promotion codes
 */

$method = $_SERVER['REQUEST_METHOD'];

// GET /discounts - List discounts (Admin) — optional ?valid_now=true for “currently valid” only
if ($method === 'GET' && !$id) {
    Auth::requireAuth('admin');
    
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $validNow = isset($_GET['valid_now']) && $_GET['valid_now'] === 'true';
        
        $where = [];
        $params = [];
        
        if ($validNow) {
            $where[] = "is_active = 1";
            $where[] = "(valid_from IS NULL OR valid_from <= NOW())";
            $where[] = "(valid_until IS NULL OR valid_until >= NOW())";
        }
        
        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        
        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_discounts $whereClause",
            $params
        )['total'] ?? 0;
        
        $params['limit'] = $limit;
        $params['offset'] = $offset;
        
        $discounts = $conn->fetchAll(
            "SELECT id, code, name, description, discount_type, discount_value, min_order_value, 
                    max_uses, uses_count, is_active, valid_from, valid_until
             FROM remquip_discounts $whereClause
             ORDER BY created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );
        
        ResponseHelper::sendPaginated($discounts, $total, $limit, $offset, 'Discounts retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get discounts error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve discounts', 500);
    }
}

// GET /discounts/validate/:code — (frontend api-endpoints)
if ($method === 'GET' && $id === 'validate' && $action) {
    try {
        $discount = $conn->fetch(
            "SELECT id, code, discount_type, discount_value, min_order_value, max_uses, uses_count
             FROM remquip_discounts 
             WHERE code = :code AND is_active = 1 
             AND (valid_from IS NULL OR valid_from <= NOW())
             AND (valid_until IS NULL OR valid_until >= NOW())
             AND (max_uses IS NULL OR uses_count < max_uses)",
            ['code' => strtoupper($action)]
        );
        
        if (!$discount) {
            ResponseHelper::sendError('Invalid or expired discount code', 404);
        }
        
        ResponseHelper::sendSuccess($discount, 'Discount code is valid');
        
    } catch (Exception $e) {
        Logger::error('Validate discount error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to validate discount', 500);
    }
}

// GET /discounts/:code/validate - Validate discount code (public)
if ($method === 'GET' && $id && $action === 'validate') {
    try {
        $discount = $conn->fetch(
            "SELECT id, code, discount_type, discount_value, min_order_value, max_uses, uses_count
             FROM remquip_discounts 
             WHERE code = :code AND is_active = 1 
             AND (valid_from IS NULL OR valid_from <= NOW())
             AND (valid_until IS NULL OR valid_until >= NOW())
             AND (max_uses IS NULL OR uses_count < max_uses)",
            ['code' => strtoupper($id)]
        );
        
        if (!$discount) {
            ResponseHelper::sendError('Invalid or expired discount code', 404);
        }
        
        ResponseHelper::sendSuccess($discount, 'Discount code is valid');
        
    } catch (Exception $e) {
        Logger::error('Validate discount error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to validate discount', 500);
    }
}

// GET /discounts/:id — single discount (Admin)
if ($method === 'GET' && $id && !$action && $id !== 'validate') {
    Auth::requireAuth('admin');
    try {
        $row = $conn->fetch(
            "SELECT id, code, name, description, discount_type, discount_value, min_order_value,
                    max_uses, uses_count, is_active, valid_from, valid_until, created_at, updated_at
             FROM remquip_discounts WHERE id = :id",
            ['id' => $id]
        );
        if (!$row) {
            ResponseHelper::sendError('Discount not found', 404);
        }
        ResponseHelper::sendSuccess($row, 'Discount retrieved');
    } catch (Exception $e) {
        Logger::error('Get discount error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve discount', 500);
    }
}

// POST /discounts - Create discount (Admin)
if ($method === 'POST' && !$id) {
    Auth::requireAuth('admin');
    
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        $discType = $data['discountType'] ?? $data['discount_type'] ?? null;
        $discVal = $data['discountValue'] ?? $data['discount_value'] ?? null;
        if (empty($data['code']) || !$discType || !isset($discVal)) {
            ResponseHelper::sendError('Missing required fields: code, discount_type, discount_value', 400);
        }
        
        $code = strtoupper($data['code']);
        
        // Check if code exists
        $existing = $conn->fetch("SELECT id FROM remquip_discounts WHERE code = :code", ['code' => $code]);
        if ($existing) {
            ResponseHelper::sendError('Discount code already exists', 409);
        }
        
        $minOrder = $data['minOrderValue'] ?? $data['min_purchase_amount'] ?? 0;
        $maxUses = $data['maxUses'] ?? $data['max_usage_count'] ?? null;
        $validFrom = $data['validFrom'] ?? $data['valid_from'] ?? null;
        $validUntil = $data['validUntil'] ?? $data['valid_until'] ?? null;
        $isActive = isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1;

        $discountId = $conn->fetch('SELECT UUID() AS u')['u'];
        $discName = trim($data['name'] ?? '') !== '' ? trim($data['name']) : $code;
        $conn->execute(
            "INSERT INTO remquip_discounts (id, code, name, description, discount_type, discount_value, min_order_value, max_uses, valid_from, valid_until, is_active)
             VALUES (:id, :code, :name, :description, :type, :value, :minOrder, :maxUses, :validFrom, :validUntil, :isActive)",
            [
                'id' => $discountId,
                'code' => $code,
                'name' => $discName,
                'description' => $data['description'] ?? '',
                'type' => $discType,
                'value' => (float)$discVal,
                'minOrder' => (float)$minOrder,
                'maxUses' => $maxUses !== null && $maxUses !== '' ? (int)$maxUses : null,
                'validFrom' => $validFrom ?: null,
                'validUntil' => $validUntil ?: null,
                'isActive' => $isActive,
            ]
        );
        
        Logger::info('Discount created', ['discount_id' => $discountId, 'code' => $code]);
        ResponseHelper::sendSuccess(['id' => $discountId], 'Discount created successfully', 201);
        
    } catch (Exception $e) {
        Logger::error('Create discount error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create discount', 500);
    }
}

// PATCH/PUT /discounts/:id - Update discount (Admin)
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    Auth::requireAuth('admin');
    
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $id];
        
        if (isset($data['discountValue'])) {
            $updates[] = "discount_value = :value";
            $params['value'] = (float)$data['discountValue'];
        } elseif (isset($data['discount_value'])) {
            $updates[] = "discount_value = :valueSnake";
            $params['valueSnake'] = (float)$data['discount_value'];
        }
        
        if (isset($data['status'])) {
            $updates[] = "is_active = :isActive";
            $params['isActive'] = $data['status'] === 'active' ? 1 : 0;
        }
        if (array_key_exists('is_active', $data)) {
            $updates[] = "is_active = :isAct";
            $params['isAct'] = $data['is_active'] ? 1 : 0;
        }
        
        if (isset($data['validUntil'])) {
            $updates[] = "valid_until = :validUntil";
            $params['validUntil'] = $data['validUntil'];
        } elseif (isset($data['valid_until'])) {
            $updates[] = "valid_until = :validUntilSnake";
            $params['validUntilSnake'] = $data['valid_until'];
        }
        if (isset($data['valid_from'])) {
            $updates[] = "valid_from = :validFromSnake";
            $params['validFromSnake'] = $data['valid_from'];
        }
        if (isset($data['discount_type'])) {
            $updates[] = "discount_type = :dtype";
            $params['dtype'] = $data['discount_type'];
        }
        if (isset($data['description'])) {
            $updates[] = "description = :desc";
            $params['desc'] = $data['description'];
        }
        if (isset($data['min_purchase_amount']) || isset($data['min_order_value'])) {
            $updates[] = "min_order_value = :minord";
            $params['minord'] = (float)($data['min_order_value'] ?? $data['min_purchase_amount']);
        }
        if (isset($data['max_usage_count']) || isset($data['max_uses'])) {
            $updates[] = "max_uses = :maxu";
            $v = $data['max_uses'] ?? $data['max_usage_count'];
            $params['maxu'] = $v === '' || $v === null ? null : (int)$v;
        }
        
        if (!$updates) ResponseHelper::sendError('No fields to update', 400);
        
        $updates[] = "updated_at = NOW()";
        $conn->execute("UPDATE remquip_discounts SET " . implode(', ', $updates) . " WHERE id = :id", $params);
        
        Logger::info('Discount updated', ['discount_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Discount updated successfully');
        
    } catch (Exception $e) {
        Logger::error('Update discount error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update discount', 500);
    }
}

// DELETE /discounts/:id - Delete discount (Admin)
if ($method === 'DELETE' && $id && !$action) {
    Auth::requireAuth('admin');
    
    try {
        $conn->execute("DELETE FROM remquip_discounts WHERE id = :id", ['id' => $id]);
        Logger::info('Discount deleted', ['discount_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Discount deleted successfully');
        
    } catch (Exception $e) {
        Logger::error('Delete discount error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete discount', 500);
    }
}
?>

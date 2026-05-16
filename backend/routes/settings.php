<?php
/**
 * SETTINGS — `settings` table (public + admin CRUD)
 */

$method = $_SERVER['REQUEST_METHOD'];

// -------------------------------------------------------------------------
// GET /settings/public — no auth; keys where is_public = 1
// -------------------------------------------------------------------------
if ($method === 'GET' && $id === 'public') {
    try {
        $rows = $conn->fetchAll(
            'SELECT setting_key, setting_value, data_type FROM remquip_settings WHERE is_public = 1 ORDER BY setting_key'
        );
        $out = [];
        foreach ($rows as $r) {
            $out[$r['setting_key']] = settings_normalize_out($r['setting_value'], $r['data_type']);
        }
        ResponseHelper::sendSuccess($out, 'Public settings');
    } catch (Exception $e) {
        Logger::error('Public settings error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load public settings', 500);
    }
}

// -------------------------------------------------------------------------
// GET /settings/storefront — no auth; tax/shipping for cart + checkout parity with POST /orders
// -------------------------------------------------------------------------
if ($method === 'GET' && $id === 'storefront') {
    try {
        $rates = settings_storefront_rates($conn);
        ResponseHelper::sendSuccess($rates, 'Storefront settings');
    } catch (Exception $e) {
        Logger::error('Storefront settings error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load storefront settings', 500);
    }
}

Auth::requireAuth('admin');

// -------------------------------------------------------------------------
// GET /settings — all rows (admin)
// -------------------------------------------------------------------------
if ($method === 'GET' && !$id) {
    try {
        $rows = $conn->fetchAll(
            'SELECT id, setting_key, setting_value, data_type, description, is_public, created_at, updated_at
             FROM remquip_settings ORDER BY setting_key'
        );
        ResponseHelper::sendSuccess($rows, 'Settings');
    } catch (Exception $e) {
        Logger::error('Settings list error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to list settings', 500);
    }
}

// -------------------------------------------------------------------------
// PUT /settings/:key — upsert one (admin); key = URL path segment
// -------------------------------------------------------------------------
if (($method === 'PUT' || $method === 'PATCH') && $id && $id !== 'public' && !$action) {
    try {
        $key = settings_sanitize_key($id);
        if ($key === '') {
            ResponseHelper::sendError('Invalid setting key', 400);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $val = $data['setting_value'] ?? $data['value'] ?? null;
        if ($val === null) {
            ResponseHelper::sendError('setting_value or value required', 400);
        }
        $valStr = is_scalar($val) ? (string)$val : json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $dtype = isset($data['data_type']) ? preg_replace('/[^a-z0-9_]/', '', (string)$data['data_type']) : 'string';
        if ($dtype === '') {
            $dtype = 'string';
        }
        $isPublic = isset($data['is_public']) ? (int)(bool)$data['is_public'] : 0;
        $desc = isset($data['description']) ? substr((string)$data['description'], 0, 500) : null;

        $existing = $conn->fetch('SELECT id FROM remquip_settings WHERE setting_key = :k', ['k' => $key]);
        if ($existing) {
            $conn->execute(
                'UPDATE remquip_settings SET setting_value = :v, data_type = :dt, is_public = :pub, description = COALESCE(:d, description), updated_at = NOW() WHERE setting_key = :k',
                ['v' => $valStr, 'dt' => $dtype, 'pub' => $isPublic, 'd' => $desc, 'k' => $key]
            );
        } else {
            $sid = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                'INSERT INTO remquip_settings (id, setting_key, setting_value, data_type, description, is_public)
                 VALUES (:id, :k, :v, :dt, :d, :pub)',
                ['id' => $sid, 'k' => $key, 'v' => $valStr, 'dt' => $dtype, 'd' => $desc, 'pub' => $isPublic]
            );
        }
        $row = $conn->fetch('SELECT * FROM remquip_settings WHERE setting_key = :k', ['k' => $key]);
        ResponseHelper::sendSuccess($row, 'Setting saved');
    } catch (Exception $e) {
        Logger::error('Setting upsert error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to save setting', 500);
    }
}

// -------------------------------------------------------------------------
// PATCH /settings — bulk upsert { "settings": { "key": "value", ... } } (admin)
// -------------------------------------------------------------------------
if ($method === 'PATCH' && !$id) {
    try {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $map = $body['settings'] ?? $body;
        if (!is_array($map)) {
            ResponseHelper::sendError('Body must be an object or { "settings": { ... } }', 400);
        }
        foreach ($map as $rawKey => $val) {
            $key = settings_sanitize_key((string)$rawKey);
            if ($key === '') {
                continue;
            }
            $valStr = is_scalar($val) ? (string)$val : json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $existing = $conn->fetch('SELECT id FROM remquip_settings WHERE setting_key = :k', ['k' => $key]);
            if ($existing) {
                $conn->execute(
                    'UPDATE remquip_settings SET setting_value = :v, updated_at = NOW() WHERE setting_key = :k',
                    ['v' => $valStr, 'k' => $key]
                );
            } else {
                $sid = $conn->fetch('SELECT UUID() AS u')['u'];
                $conn->execute(
                    'INSERT INTO remquip_settings (id, setting_key, setting_value, data_type, is_public)
                     VALUES (:id, :k, :v, \'string\', 0)',
                    ['id' => $sid, 'k' => $key, 'v' => $valStr]
                );
            }
        }
        ResponseHelper::sendSuccess(['updated' => count($map)], 'Settings updated');
    } catch (Exception $e) {
        Logger::error('Settings bulk error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update settings', 500);
    }
}

// -------------------------------------------------------------------------
// DELETE /settings/:key (admin)
// -------------------------------------------------------------------------
if ($method === 'DELETE' && $id && $id !== 'public' && !$action) {
    try {
        $key = settings_sanitize_key($id);
        if ($key === '') {
            ResponseHelper::sendError('Invalid key', 400);
        }
        $conn->execute('DELETE FROM remquip_settings WHERE setting_key = :k', ['k' => $key]);
        ResponseHelper::sendSuccess(null, 'Setting deleted');
    } catch (Exception $e) {
        Logger::error('Setting delete error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete setting', 500);
    }
}

ResponseHelper::sendError('Settings endpoint not found', 404);

/**
 * @param mixed $val
 * @return mixed
 */
function settings_normalize_out($val, $dtype) {
    if ($dtype === 'boolean' || $dtype === 'bool') {
        return $val === '1' || $val === 1 || $val === true || strtolower((string)$val) === 'true';
    }
    if ($dtype === 'number' || $dtype === 'int' || $dtype === 'float') {
        return is_numeric($val) ? 0 + $val : $val;
    }
    return $val;
}

function settings_sanitize_key($key) {
    $key = strtolower(trim($key));
    if (!preg_match('/^[a-z][a-z0-9_]{0,62}$/', $key)) {
        return '';
    }
    return $key;
}

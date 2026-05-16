<?php
/**
 * Contact page map — `remquip_contact_map` (singleton row for Leaflet pin)
 * GET /contact-map — public (no auth)
 * PUT /contact-map — admin
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

function contact_map_default_row(): array
{
    return [
        'id' => 'a0000000-0000-4000-8000-000000000001',
        'latitude' => 45.5017,
        'longitude' => -73.5673,
        'zoom' => 13,
        'marker_title' => 'REMQUIP',
        'address_line' => '1000 Rue de la Gauchetière O, Montréal, QC H3B 4W5, Canada',
        'updated_at' => date('Y-m-d H:i:s'),
    ];
}

function contact_map_normalize_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'latitude' => round((float) $row['latitude'], 7),
        'longitude' => round((float) $row['longitude'], 7),
        'zoom' => (int) $row['zoom'],
        'marker_title' => $row['marker_title'] !== null && $row['marker_title'] !== '' ? (string) $row['marker_title'] : null,
        'address_line' => $row['address_line'] !== null && $row['address_line'] !== '' ? (string) $row['address_line'] : null,
        'updated_at' => (string) $row['updated_at'],
    ];
}

function contact_map_validate_body(array $data): array
{
    $lat = isset($data['latitude']) ? (float) $data['latitude'] : null;
    $lng = isset($data['longitude']) ? (float) $data['longitude'] : null;
    $zoom = isset($data['zoom']) ? (int) $data['zoom'] : 13;
    if ($lat === null || $lng === null) {
        ResponseHelper::sendError('latitude and longitude are required', 400);
    }
    if ($lat < -90 || $lat > 90 || !is_finite($lat)) {
        ResponseHelper::sendError('latitude must be between -90 and 90', 400);
    }
    if ($lng < -180 || $lng > 180 || !is_finite($lng)) {
        ResponseHelper::sendError('longitude must be between -180 and 180', 400);
    }
    if ($zoom < 1 || $zoom > 19) {
        ResponseHelper::sendError('zoom must be between 1 and 19', 400);
    }
    $title = isset($data['marker_title']) ? trim((string) $data['marker_title']) : '';
    $addr = isset($data['address_line']) ? trim((string) $data['address_line']) : '';

    return [
        'latitude' => round($lat, 7),
        'longitude' => round($lng, 7),
        'zoom' => $zoom,
        'marker_title' => $title === '' ? null : substr($title, 0, 255),
        'address_line' => $addr === '' ? null : $addr,
    ];
}

// GET /contact-map — public
if ($method === 'GET' && empty($rs)) {
    try {
        $row = $conn->fetch('SELECT id, latitude, longitude, zoom, marker_title, address_line, updated_at FROM remquip_contact_map ORDER BY updated_at DESC LIMIT 1');
        if (!$row) {
            ResponseHelper::sendSuccess(contact_map_default_row(), 'Contact map (defaults)');
        } else {
            ResponseHelper::sendSuccess(contact_map_normalize_row($row), 'Contact map');
        }
    } catch (Exception $e) {
        Logger::error('Contact map GET', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load contact map', 500);
    }
}

Auth::requireAuth('admin');

// PUT /contact-map — upsert singleton
if (($method === 'PUT' || $method === 'PATCH') && empty($rs)) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $v = contact_map_validate_body($data);
        $existing = $conn->fetch('SELECT id FROM remquip_contact_map LIMIT 1');
        if ($existing) {
            $conn->execute(
                'UPDATE remquip_contact_map SET latitude = :lat, longitude = :lng, zoom = :z, marker_title = :mt, address_line = :ad, updated_at = NOW() WHERE id = :id',
                [
                    'lat' => $v['latitude'],
                    'lng' => $v['longitude'],
                    'z' => $v['zoom'],
                    'mt' => $v['marker_title'],
                    'ad' => $v['address_line'],
                    'id' => $existing['id'],
                ]
            );
            $id = $existing['id'];
        } else {
            $id = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                'INSERT INTO remquip_contact_map (id, latitude, longitude, zoom, marker_title, address_line) VALUES (:id, :lat, :lng, :z, :mt, :ad)',
                [
                    'id' => $id,
                    'lat' => $v['latitude'],
                    'lng' => $v['longitude'],
                    'z' => $v['zoom'],
                    'mt' => $v['marker_title'],
                    'ad' => $v['address_line'],
                ]
            );
        }
        $row = $conn->fetch(
            'SELECT id, latitude, longitude, zoom, marker_title, address_line, updated_at FROM remquip_contact_map WHERE id = :id',
            ['id' => $id]
        );
        ResponseHelper::sendSuccess(contact_map_normalize_row($row), 'Contact map saved');
    } catch (Exception $e) {
        Logger::error('Contact map PUT', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to save contact map', 500);
    }
}

ResponseHelper::sendError('Contact map endpoint not found', 404);

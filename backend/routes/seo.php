<?php
/**
 * SEO Metadata CRUD — Backend/routes/seo.php
 * Public: GET /seo?path=...&locale=...   (returns SEO for a specific route)
 * Public: GET /seo/all                   (returns all active SEO entries)
 * Admin:  GET /seo/list                  (all entries including inactive)
 * Admin:  POST /seo                      (create)
 * Admin:  PUT /seo/:id                   (update)
 * Admin:  DELETE /seo/:id                (soft-delete / toggle is_active)
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

// ----------------------------------------------------------------------------- GET /seo?path=...&locale=...
if ($method === 'GET' && empty($rs)) {
    $pagePath = trim($_GET['page_path'] ?? $_GET['path'] ?? '/');
    $locale = trim($_GET['locale'] ?? 'en');
    try {
        $row = $conn->fetch(
            'SELECT * FROM remquip_seo_metadata WHERE page_path = :path AND locale = :locale AND is_active = 1',
            ['path' => $pagePath, 'locale' => $locale]
        );
        if (!$row) {
            // Fallback to default locale
            $row = $conn->fetch(
                'SELECT * FROM remquip_seo_metadata WHERE page_path = :path AND is_active = 1 ORDER BY locale ASC LIMIT 1',
                ['path' => $pagePath]
            );
        }
        ResponseHelper::sendSuccess($row, $row ? 'SEO metadata found' : 'No SEO metadata');
    } catch (Exception $e) {
        Logger::error('SEO GET error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch SEO metadata', 500);
    }
}

// ----------------------------------------------------------------------------- GET /seo/all (public — all active)
if ($method === 'GET' && ($rs[0] ?? '') === 'all' && !isset($rs[1])) {
    try {
        $rows = $conn->fetchAll(
            'SELECT * FROM remquip_seo_metadata WHERE is_active = 1 ORDER BY page_path, locale'
        );
        ResponseHelper::sendSuccess($rows, 'All active SEO metadata');
    } catch (Exception $e) {
        Logger::error('SEO GET all error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch SEO metadata', 500);
    }
}

// ----------------------------------------------------------------------------- GET /seo/list (admin — all including inactive)
if ($method === 'GET' && ($rs[0] ?? '') === 'list' && !isset($rs[1])) {
    Auth::requireAuth('admin');
    try {
        $rows = $conn->fetchAll(
            'SELECT * FROM remquip_seo_metadata ORDER BY page_path, locale'
        );
        ResponseHelper::sendSuccess($rows, 'All SEO metadata');
    } catch (Exception $e) {
        Logger::error('SEO admin list error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch SEO metadata', 500);
    }
}

// ----------------------------------------------------------------------------- POST /seo (admin — create)
if ($method === 'POST' && empty($rs)) {
    Auth::requireAuth('admin');
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $pagePath = trim($data['page_path'] ?? '');
    $locale = trim($data['locale'] ?? 'en');
    if ($pagePath === '') {
        ResponseHelper::sendError('page_path is required', 400);
    }
    // Check for duplicates
    $existing = $conn->fetch(
        'SELECT id FROM remquip_seo_metadata WHERE page_path = :path AND locale = :locale',
        ['path' => $pagePath, 'locale' => $locale]
    );
    if ($existing) {
        ResponseHelper::sendError('SEO entry already exists for this path + locale', 409);
    }
    try {
        $id = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_seo_metadata (id, page_path, page_name, locale, meta_title, meta_description, og_title, og_description, og_image, og_type, twitter_title, twitter_description, twitter_image, twitter_card, canonical_url, json_ld, robots, keywords, is_active)
             VALUES (:id, :page_path, :page_name, :locale, :meta_title, :meta_description, :og_title, :og_description, :og_image, :og_type, :twitter_title, :twitter_description, :twitter_image, :twitter_card, :canonical_url, :json_ld, :robots, :keywords, :is_active)',
            [
                'id' => $id,
                'page_path' => $pagePath,
                'page_name' => trim($data['page_name'] ?? ''),
                'locale' => $locale,
                'meta_title' => trim($data['meta_title'] ?? ''),
                'meta_description' => trim($data['meta_description'] ?? ''),
                'og_title' => $data['og_title'] ?? null,
                'og_description' => $data['og_description'] ?? null,
                'og_image' => $data['og_image'] ?? null,
                'og_type' => $data['og_type'] ?? 'website',
                'twitter_title' => $data['twitter_title'] ?? null,
                'twitter_description' => $data['twitter_description'] ?? null,
                'twitter_image' => $data['twitter_image'] ?? null,
                'twitter_card' => $data['twitter_card'] ?? 'summary_large_image',
                'canonical_url' => $data['canonical_url'] ?? null,
                'json_ld' => $data['json_ld'] ?? null,
                'robots' => $data['robots'] ?? 'index, follow',
                'keywords' => $data['keywords'] ?? null,
                'is_active' => isset($data['is_active']) ? (int)$data['is_active'] : 1,
            ]
        );
        ResponseHelper::sendSuccess(['id' => $id], 'SEO metadata created', 201);
    } catch (Exception $e) {
        Logger::error('SEO create error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create SEO metadata', 500);
    }
}

// ----------------------------------------------------------------------------- PUT /seo/:id (admin — update)
if (($method === 'PUT' || $method === 'PATCH') && isset($rs[0]) && !isset($rs[1])) {
    Auth::requireAuth('admin');
    $id = $rs[0];
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    try {
        $existing = $conn->fetch('SELECT * FROM remquip_seo_metadata WHERE id = :id', ['id' => $id]);
        if (!$existing) {
            ResponseHelper::sendError('SEO entry not found', 404);
        }
        $fields = ['page_path', 'page_name', 'locale', 'meta_title', 'meta_description', 'og_title', 'og_description', 'og_image', 'og_type', 'twitter_title', 'twitter_description', 'twitter_image', 'twitter_card', 'canonical_url', 'json_ld', 'robots', 'keywords', 'is_active'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $f === 'is_active' ? (int)$data[$f] : $data[$f];
            }
        }
        if (empty($sets)) {
            ResponseHelper::sendError('No fields to update', 400);
        }
        $sets[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_seo_metadata SET ' . implode(', ', $sets) . ' WHERE id = :id', $params);
        ResponseHelper::sendSuccess(['id' => $id], 'SEO metadata updated');
    } catch (Exception $e) {
        Logger::error('SEO update error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update SEO metadata', 500);
    }
}

// ----------------------------------------------------------------------------- DELETE /seo/:id (admin — delete)
if ($method === 'DELETE' && isset($rs[0]) && !isset($rs[1])) {
    Auth::requireAuth('admin');
    $id = $rs[0];
    try {
        $existing = $conn->fetch('SELECT id FROM remquip_seo_metadata WHERE id = :id', ['id' => $id]);
        if (!$existing) {
            ResponseHelper::sendError('SEO entry not found', 404);
        }
        $conn->execute('DELETE FROM remquip_seo_metadata WHERE id = :id', ['id' => $id]);
        ResponseHelper::sendSuccess(null, 'SEO metadata deleted');
    } catch (Exception $e) {
        Logger::error('SEO delete error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete SEO metadata', 500);
    }
}

<?php
/**
 * CMS — pages, section content (JSON in cms_pages.content), banners, image upload
 * Uses $routeSegments so /cms/pages/:slug matches the frontend (/api/cms/...).
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

function cms_decode_sections($content): array
{
    if ($content === null || $content === '') {
        return [];
    }
    if (!is_string($content)) {
        $content = (string) $content;
    }
    $j = json_decode($content, true);
    if (is_array($j) && isset($j['sections']) && is_array($j['sections'])) {
        return $j['sections'];
    }
    return [
        'main' => [
            'title' => '',
            'description' => '',
            'image_url' => '',
            'content' => $content,
        ],
    ];
}

function cms_encode_sections(array $sections): string
{
    return json_encode(['sections' => $sections], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function cms_normalize_locale(?string $raw, $conn): string
{
    $l = strtolower(substr(trim((string) $raw), 0, 5));
    $supported = get_supported_locales($conn);
    foreach ($supported as $loc) {
        if ($l === $loc || strpos($l, $loc) === 0) {
            return $loc;
        }
    }
    return $supported[0] ?? 'en';
}

// ----------------------------------------------------------------------------- GET/PUT /cms/pages/:pageId/translations
if (($rs[0] ?? '') === 'pages' && isset($rs[1]) && ($rs[2] ?? '') === 'translations' && !isset($rs[3])) {
    Auth::requireAuth('admin');
    if (!in_array($method, ['GET', 'PUT', 'PATCH'], true)) {
        ResponseHelper::sendError('Method not allowed', 405);
    }
    $pageId = $rs[1];
    $pg = $conn->fetch('SELECT id FROM remquip_cms_pages WHERE id = :id AND deleted_at IS NULL', ['id' => $pageId]);
    if (!$pg) {
        ResponseHelper::sendError('Page not found', 404);
    }

    if ($method === 'GET') {
        try {
            $supported = get_supported_locales($conn);
            $out = array_fill_keys($supported, null);
            $rows = $conn->fetchAll(
                'SELECT locale, title, excerpt, content FROM remquip_cms_page_translations WHERE page_id = :id ORDER BY locale',
                ['id' => $pageId]
            );
            foreach ($rows as $r) {
                $loc = $r['locale'];
                $out[$loc] = [
                    'title' => $r['title'],
                    'excerpt' => $r['excerpt'] ?? '',
                    'content' => $r['content'] ?? '',
                ];
            }
            ResponseHelper::sendSuccess(['page_id' => $pageId, 'translations' => $out, 'supported_locales' => $supported], 'CMS translations');
        } catch (Exception $e) {
            Logger::error('CMS translations GET', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to load translations', 500);
        }
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $supported = get_supported_locales($conn);
            foreach ($supported as $loc) {
                if (!isset($data[$loc]) || !is_array($data[$loc])) {
                    continue;
                }
                $b = $data[$loc];
                $title = trim((string) ($b['title'] ?? ''));
                if ($title === '') {
                    continue;
                }
                $excerpt = isset($b['excerpt']) ? (string) $b['excerpt'] : '';
                $content = isset($b['content']) ? (string) $b['content'] : '';
                $existing = $conn->fetch(
                    'SELECT id FROM remquip_cms_page_translations WHERE page_id = :p AND locale = :l',
                    ['p' => $pageId, 'l' => $loc]
                );
                if ($existing) {
                    $conn->execute(
                        'UPDATE remquip_cms_page_translations SET title = :t, excerpt = :e, content = :c, updated_at = NOW() WHERE id = :id',
                        ['t' => $title, 'e' => $excerpt, 'c' => $content, 'id' => $existing['id']]
                    );
                } else {
                    $tid = $conn->fetch('SELECT UUID() AS u')['u'];
                    $conn->execute(
                        'INSERT INTO remquip_cms_page_translations (id, page_id, locale, title, excerpt, content) VALUES (:id, :p, :l, :t, :e, :c)',
                        ['id' => $tid, 'p' => $pageId, 'l' => $loc, 't' => $title, 'e' => $excerpt, 'c' => $content]
                    );
                }
            }
            ResponseHelper::sendSuccess(['id' => $pageId], 'CMS translations saved');
        } catch (Exception $e) {
            Logger::error('CMS translations PUT', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to save translations', 500);
        }
    }
}

// ----------------------------------------------------------------------------- POST /cms/images/upload
if ($method === 'POST' && ($rs[0] ?? '') === 'images' && ($rs[1] ?? '') === 'upload' && !isset($rs[2])) {
    Auth::requireAuth('admin');
    try {
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            ResponseHelper::sendError('No image uploaded', 400);
        }
        $file = $_FILES['image'];
        if ($file['size'] === 0 || $file['size'] > MAX_UPLOAD_SIZE) {
            ResponseHelper::sendError('Invalid file size', 400);
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (!in_array($mimeType, ALLOWED_IMAGE_TYPES, true)) {
            ResponseHelper::sendError('Invalid image type', 400);
        }
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_IMAGE_EXT, true)) {
            ResponseHelper::sendError('Invalid extension', 400);
        }
        $uploadDir = UPLOAD_DIR . '/products_images';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        $filename = 'CMS-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $filepath = $uploadDir . '/' . $filename;
        $publicPath = '/Backend/uploads/products_images/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            ResponseHelper::sendError('Failed to save file', 500);
        }
        ResponseHelper::sendSuccess(['url' => $publicPath], 'Image uploaded', 201);
    } catch (Exception $e) {
        Logger::error('CMS image upload error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Upload failed', 500);
    }
}

// ----------------------------------------------------------------------------- POST /cms/content
if ($method === 'POST' && ($rs[0] ?? '') === 'content' && !isset($rs[1])) {
    Auth::requireAuth('admin');
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $pageName = trim($data['page_name'] ?? '');
    $sectionKey = trim($data['section_key'] ?? '');
    if ($pageName === '' || $sectionKey === '') {
        ResponseHelper::sendError('page_name and section_key are required', 400);
    }
    try {
        $page = $conn->fetch('SELECT * FROM remquip_cms_pages WHERE slug = :s AND deleted_at IS NULL', ['s' => $pageName]);
        if (!$page) {
            $conn->execute(
                'INSERT INTO remquip_cms_pages (slug, title, excerpt, content, is_published) VALUES (:slug, :title, :excerpt, :content, 0)',
                [
                    'slug' => $pageName,
                    'title' => $data['title'] ?? $pageName,
                    'excerpt' => '',
                    'content' => cms_encode_sections([]),
                ]
            );
            $page = $conn->fetch('SELECT * FROM remquip_cms_pages WHERE slug = :s AND deleted_at IS NULL', ['s' => $pageName]);
        }
        $sections = cms_decode_sections($page['content']);
        $sections[$sectionKey] = [
            'title' => $data['title'] ?? ($sections[$sectionKey]['title'] ?? ''),
            'description' => $data['description'] ?? ($sections[$sectionKey]['description'] ?? ''),
            'image_url' => $data['image_url'] ?? ($sections[$sectionKey]['image_url'] ?? ''),
            'content' => $data['content'] ?? ($sections[$sectionKey]['content'] ?? ''),
        ];
        $conn->execute(
            'UPDATE remquip_cms_pages SET content = :c, updated_at = NOW() WHERE id = :id',
            ['c' => cms_encode_sections($sections), 'id' => $page['id']]
        );
        $row = [
            'id' => $page['id'] . ':' . $sectionKey,
            'page_name' => $pageName,
            'section_key' => $sectionKey,
            'title' => $sections[$sectionKey]['title'],
            'description' => $sections[$sectionKey]['description'],
            'image_url' => $sections[$sectionKey]['image_url'],
            'content' => $sections[$sectionKey]['content'],
            'created_at' => $page['created_at'],
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        ResponseHelper::sendSuccess($row, 'Content created', 201);
    } catch (Exception $e) {
        Logger::error('CMS create content error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create content', 500);
    }
}

// ----------------------------------------------------------------------------- PUT /cms/content/:compoundId (pageUuid:sectionKey) — ?locale= for translation
if (($method === 'PUT' || $method === 'PATCH') && ($rs[0] ?? '') === 'content' && isset($rs[1]) && !isset($rs[2])) {
    Auth::requireAuth('admin');
    $compound = $rs[1];
    $parts = explode(':', $compound, 2);
    if (count($parts) !== 2) {
        ResponseHelper::sendError('Invalid content id (use pageId:sectionKey)', 400);
    }
    [$pageId, $sectionKey] = $parts;
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $reqLocale = isset($_GET['locale']) ? cms_normalize_locale($_GET['locale'], $conn) : null;
    $defaultLocale = (get_supported_locales($conn))[0] ?? 'en';
    $useTranslation = $reqLocale && $reqLocale !== $defaultLocale;
    try {
        $page = $conn->fetch('SELECT * FROM remquip_cms_pages WHERE id = :id AND deleted_at IS NULL', ['id' => $pageId]);
        if (!$page) {
            ResponseHelper::sendError('Page not found', 404);
        }
        $sectionData = [
            'title' => $data['title'] ?? '',
            'description' => $data['description'] ?? '',
            'image_url' => $data['image_url'] ?? '',
            'content' => $data['content'] ?? '',
        ];
        if ($useTranslation) {
            $tr = $conn->fetch(
                'SELECT id, content FROM remquip_cms_page_translations WHERE page_id = :p AND locale = :l',
                ['p' => $pageId, 'l' => $reqLocale]
            );
            $baseSections = cms_decode_sections($page['content']);
            $prev = isset($tr['content']) && $tr['content'] !== '' ? cms_decode_sections($tr['content']) : $baseSections;
            $sectionData = [
                'title' => $data['title'] ?? $prev[$sectionKey]['title'] ?? '',
                'description' => $data['description'] ?? $prev[$sectionKey]['description'] ?? '',
                'image_url' => $data['image_url'] ?? $prev[$sectionKey]['image_url'] ?? '',
                'content' => $data['content'] ?? $prev[$sectionKey]['content'] ?? '',
            ];
            $sections = $prev;
            $sections[$sectionKey] = $sectionData;
            $encoded = cms_encode_sections($sections);
            if ($tr) {
                $conn->execute(
                    'UPDATE remquip_cms_page_translations SET content = :c, updated_at = NOW() WHERE page_id = :p AND locale = :l',
                    ['c' => $encoded, 'p' => $pageId, 'l' => $reqLocale]
                );
            } else {
                $conn->execute(
                    'INSERT INTO remquip_cms_page_translations (id, page_id, locale, title, excerpt, content) VALUES (UUID(), :p, :l, :title, :excerpt, :c)',
                    ['p' => $pageId, 'l' => $reqLocale, 'title' => $page['title'], 'excerpt' => $page['excerpt'] ?? '', 'c' => $encoded]
                );
            }
        } else {
            $sections = cms_decode_sections($page['content']);
            $prev = $sections[$sectionKey] ?? [];
            $sections[$sectionKey] = [
                'title' => $sectionData['title'] ?: ($prev['title'] ?? ''),
                'description' => $sectionData['description'] ?: ($prev['description'] ?? ''),
                'image_url' => $sectionData['image_url'] ?: ($prev['image_url'] ?? ''),
                'content' => $sectionData['content'] !== '' ? $sectionData['content'] : ($prev['content'] ?? ''),
            ];
            $conn->execute(
                'UPDATE remquip_cms_pages SET content = :c, updated_at = NOW() WHERE id = :id',
                ['c' => cms_encode_sections($sections), 'id' => $pageId]
            );
        }
        $row = [
            'id' => $compound,
            'page_name' => $page['slug'],
            'section_key' => $sectionKey,
            'locale' => $reqLocale ?? $defaultLocale,
            'title' => $sections[$sectionKey]['title'],
            'description' => $sections[$sectionKey]['description'],
            'image_url' => $sections[$sectionKey]['image_url'],
            'content' => $sections[$sectionKey]['content'],
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        ResponseHelper::sendSuccess($row, 'Content updated');
    } catch (Exception $e) {
        Logger::error('CMS update content error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update content', 500);
    }
}

// ----------------------------------------------------------------------------- DELETE /cms/content/:compoundId
if ($method === 'DELETE' && ($rs[0] ?? '') === 'content' && isset($rs[1]) && !isset($rs[2])) {
    Auth::requireAuth('admin');
    $compound = $rs[1];
    $parts = explode(':', $compound, 2);
    if (count($parts) !== 2) {
        ResponseHelper::sendError('Invalid content id', 400);
    }
    [$pageId, $sectionKey] = $parts;
    try {
        $page = $conn->fetch('SELECT * FROM remquip_cms_pages WHERE id = :id AND deleted_at IS NULL', ['id' => $pageId]);
        if (!$page) {
            ResponseHelper::sendError('Page not found', 404);
        }
        $sections = cms_decode_sections($page['content']);
        unset($sections[$sectionKey]);
        if (empty($sections)) {
            $conn->execute('UPDATE remquip_cms_pages SET content = :c, updated_at = NOW() WHERE id = :id', ['c' => cms_encode_sections([]), 'id' => $pageId]);
        } else {
            $conn->execute(
                'UPDATE remquip_cms_pages SET content = :c, updated_at = NOW() WHERE id = :id',
                ['c' => cms_encode_sections($sections), 'id' => $pageId]
            );
        }
        ResponseHelper::sendSuccess(null, 'Content deleted');
    } catch (Exception $e) {
        Logger::error('CMS delete content error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete content', 500);
    }
}

// ----------------------------------------------------------------------------- GET /cms/pages/:pageName/content — ?locale= for translation (admin)
if ($method === 'GET' && ($rs[0] ?? '') === 'pages' && isset($rs[1], $rs[2]) && $rs[2] === 'content' && !isset($rs[3])) {
    $pageName = $rs[1];
    try {
        $page = $conn->fetch(
            'SELECT * FROM remquip_cms_pages WHERE slug = :s AND deleted_at IS NULL',
            ['s' => $pageName]
        );
        if (!$page) {
            ResponseHelper::sendSuccess([], 'No content');
        }
        $published = !empty($page['is_published'] ?? $page['isPublished'] ?? null);
        if (!$published) {
            Auth::requireAuth('admin');
        }
        $content = $page['content'];
        $reqLocale = isset($_GET['locale']) ? cms_normalize_locale($_GET['locale'], $conn) : null;
        $defaultLocale = (get_supported_locales($conn))[0] ?? 'en';
        if ($reqLocale && $reqLocale !== $defaultLocale) {
            try {
                $tr = $conn->fetch(
                    'SELECT content FROM remquip_cms_page_translations WHERE page_id = :p AND locale = :l',
                    ['p' => $page['id'], 'l' => $reqLocale]
                );
                if ($tr && $tr['content'] !== null && $tr['content'] !== '') {
                    $content = $tr['content'];
                }
            } catch (Throwable $trErr) {
                Logger::warning('CMS translation row missing or query failed; using default page content', [
                    'error' => $trErr->getMessage(),
                    'page_id' => $page['id'],
                    'locale' => $reqLocale,
                ]);
            }
        }
        $sections = cms_decode_sections($content);
        $out = [];
        foreach ($sections as $key => $block) {
            if (!is_array($block)) {
                $block = [
                    'title' => '',
                    'description' => '',
                    'image_url' => '',
                    'content' => is_scalar($block) ? (string) $block : '',
                ];
            }
            $out[] = [
                'id' => $page['id'] . ':' . $key,
                'page_name' => $page['slug'],
                'section_key' => $key,
                'locale' => $reqLocale ?? $defaultLocale,
                'title' => $block['title'] ?? '',
                'description' => $block['description'] ?? '',
                'image_url' => $block['image_url'] ?? '',
                'content' => $block['content'] ?? '',
                'created_at' => $page['created_at'],
                'updated_at' => $page['updated_at'],
            ];
        }
        ResponseHelper::sendSuccess($out, 'Page content');
    } catch (Throwable $e) {
        Logger::error('CMS get page content error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
        ResponseHelper::sendError('Failed to load content', 500);
    }
}

// ----------------------------------------------------------------------------- GET /cms/pages/:pageName/sections/:sectionKey
if ($method === 'GET' && ($rs[0] ?? '') === 'pages' && ($rs[2] ?? '') === 'sections' && isset($rs[1], $rs[3]) && !isset($rs[4])) {
    $pageName = $rs[1];
    $sectionKey = $rs[3];
    try {
        $page = $conn->fetch('SELECT * FROM remquip_cms_pages WHERE slug = :s AND deleted_at IS NULL', ['s' => $pageName]);
        if (!$page) {
            ResponseHelper::sendError('Page not found', 404);
        }
        if (!$page['is_published']) {
            Auth::requireAuth('admin');
        }
        $sections = cms_decode_sections($page['content']);
        if (!isset($sections[$sectionKey])) {
            ResponseHelper::sendError('Section not found', 404);
        }
        $block = $sections[$sectionKey];
        ResponseHelper::sendSuccess([
            'id' => $page['id'] . ':' . $sectionKey,
            'page_name' => $page['slug'],
            'section_key' => $sectionKey,
            'title' => $block['title'] ?? '',
            'description' => $block['description'] ?? '',
            'image_url' => $block['image_url'] ?? '',
            'content' => $block['content'] ?? '',
            'created_at' => $page['created_at'],
            'updated_at' => $page['updated_at'],
        ], 'Section content');
    } catch (Exception $e) {
        Logger::error('CMS get section error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load section', 500);
    }
}

// ----------------------------------------------------------------------------- GET /cms/pages — list
if ($method === 'GET' && ($rs[0] ?? '') === 'pages' && !isset($rs[1])) {
    try {
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int) $_GET['page']) - 1) * $limit;
        }
        $published = isset($_GET['published']) ? $_GET['published'] === 'true' : null;
        
        $where = ['deleted_at IS NULL'];
        $params = [];
        if ($published !== null) {
            $where[] = 'is_published = :published';
            $params['published'] = $published ? 1 : 0;
        }
        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $total = $conn->fetch("SELECT COUNT(*) as total FROM remquip_cms_pages $whereClause", $params)['total'] ?? 0;
        $params['limit'] = $limit;
        $params['offset'] = $offset;
        
        $pages = $conn->fetchAll(
            "SELECT id, title, slug, excerpt, is_published, published_at, created_at
             FROM remquip_cms_pages $whereClause
             ORDER BY created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );
        ResponseHelper::sendPaginated($pages, $total, $limit, $offset, 'Pages retrieved');
    } catch (Exception $e) {
        Logger::error('Get pages error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve pages', 500);
    }
}

// ----------------------------------------------------------------------------- POST /cms/pages — create
if ($method === 'POST' && ($rs[0] ?? '') === 'pages' && !isset($rs[1])) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['title'])) {
            ResponseHelper::sendError('Title is required', 400);
        }
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $data['slug'] ?? $data['title']), '-'));
        $body = $data['content'] ?? '';
        if (is_string($body) && strlen($body) > 0 && $body[0] === '{') {
            $try = json_decode($body, true);
            $stored = is_array($try) && isset($try['sections']) ? $body : cms_encode_sections(cms_decode_sections($body));
        } else {
            $stored = cms_encode_sections(cms_decode_sections(is_string($body) ? $body : ''));
        }

        $pageId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_cms_pages (id, title, slug, excerpt, content, is_published, published_at)
             VALUES (:id, :title, :slug, :excerpt, :content, :published, :publishedAt)",
            [
                'id' => $pageId,
                'title' => $data['title'],
                'slug' => $slug,
                'excerpt' => $data['excerpt'] ?? '',
                'content' => $stored,
                'published' => isset($data['isPublished']) ? (int) $data['isPublished'] : 0,
                'publishedAt' => isset($data['isPublished']) && $data['isPublished'] ? date('Y-m-d H:i:s') : null,
            ]
        );
        Logger::info('CMS page created', ['page_id' => $pageId]);
        ResponseHelper::sendSuccess(['id' => $pageId], 'Page created successfully', 201);
    } catch (Exception $e) {
        Logger::error('Create page error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create page', 500);
    }
}

// ----------------------------------------------------------------------------- GET /cms/pages/:slugOrId — single page (two segments only)
if ($method === 'GET' && ($rs[0] ?? '') === 'pages' && isset($rs[1]) && !isset($rs[2])) {
    try {
        $slugOrId = $rs[1];
        $page = $conn->fetch(
            'SELECT * FROM remquip_cms_pages WHERE (id = :id OR slug = :id) AND deleted_at IS NULL',
            ['id' => $slugOrId]
        );
        if (!$page) {
            ResponseHelper::sendError('Page not found', 404);
        }
        if (!$page['is_published']) {
            Auth::requireAuth('admin');
        }
        $loc = cms_normalize_locale($_GET['locale'] ?? 'en', $conn);
        $supported = get_supported_locales($conn);
        if ($loc !== ($supported[0] ?? 'en')) {
            $tr = $conn->fetch(
                'SELECT title, excerpt, content FROM remquip_cms_page_translations WHERE page_id = :id AND locale = :l',
                ['id' => $page['id'], 'l' => $loc]
            );
            if ($tr) {
                $page['title'] = $tr['title'];
                $page['excerpt'] = $tr['excerpt'] ?? $page['excerpt'];
                if ($tr['content'] !== null && $tr['content'] !== '') {
                    $page['content'] = $tr['content'];
                }
            }
        }
        $page['locale'] = $loc;
        ResponseHelper::sendSuccess($page, 'Page retrieved');
    } catch (Exception $e) {
        Logger::error('Get page error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve page', 500);
    }
}

// ----------------------------------------------------------------------------- PATCH/PUT /cms/pages/:id
if (($method === 'PATCH' || $method === 'PUT') && ($rs[0] ?? '') === 'pages' && isset($rs[1]) && !isset($rs[2])) {
    Auth::requireAuth('admin');
    try {
        $pageId = $rs[1];
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $pageId];
        if (isset($data['title'])) {
            $updates[] = 'title = :title';
            $params['title'] = $data['title'];
        }
        if (isset($data['slug']) && $data['slug'] !== '') {
            $newSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $data['slug']), '-'));
            if ($newSlug !== '') {
                $updates[] = 'slug = :slug';
                $params['slug'] = $newSlug;
            }
        }
        if (isset($data['content'])) {
            $body = $data['content'];
            if (is_string($body) && strlen($body) > 0 && $body[0] === '{') {
                $try = json_decode($body, true);
                $stored = is_array($try) && isset($try['sections']) ? $body : cms_encode_sections(cms_decode_sections($body));
            } else {
                $stored = cms_encode_sections(cms_decode_sections(is_string($body) ? $body : ''));
            }
            $updates[] = 'content = :content';
            $params['content'] = $stored;
        }
        if (isset($data['excerpt'])) {
            $updates[] = 'excerpt = :excerpt';
            $params['excerpt'] = $data['excerpt'];
        }
        if (isset($data['isPublished'])) {
            $updates[] = 'is_published = :published';
            $updates[] = 'published_at = ' . ($data['isPublished'] ? 'NOW()' : 'NULL');
            $params['published'] = (int) $data['isPublished'];
        }
        if (!$updates) {
            ResponseHelper::sendError('No fields to update', 400);
        }
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_cms_pages SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);
        Logger::info('CMS page updated', ['page_id' => $pageId]);
        ResponseHelper::sendSuccess(['id' => $pageId], 'Page updated successfully');
    } catch (Exception $e) {
        Logger::error('Update page error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update page', 500);
    }
}

// ----------------------------------------------------------------------------- DELETE /cms/pages/:id
if ($method === 'DELETE' && ($rs[0] ?? '') === 'pages' && isset($rs[1]) && !isset($rs[2])) {
    Auth::requireAuth('admin');
    try {
        $conn->execute('UPDATE remquip_cms_pages SET deleted_at = NOW() WHERE id = :id', ['id' => $rs[1]]);
        Logger::info('CMS page deleted', ['page_id' => $rs[1]]);
        ResponseHelper::sendSuccess(null, 'Page deleted successfully');
    } catch (Exception $e) {
        Logger::error('Delete page error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete page', 500);
    }
}

// ----------------------------------------------------------------------------- GET /cms/banners
if ($method === 'GET' && ($rs[0] ?? '') === 'banners' && !isset($rs[1])) {
    try {
        $loc = cms_normalize_locale($_GET['locale'] ?? 'en', $conn);
        $defaultLoc = get_supported_locales($conn)[0] ?? 'en';
        $banners = $conn->fetchAll(
            "SELECT id, title, image_url, link_url, is_active, display_order
             FROM remquip_banners WHERE is_active = 1 AND deleted_at IS NULL
             ORDER BY display_order ASC"
        );
        if ($loc !== $defaultLoc) {
            foreach ($banners as &$b) {
                $tr = $conn->fetch(
                    'SELECT title, description FROM remquip_banner_translations WHERE banner_id = :id AND locale = :l',
                    ['id' => $b['id'], 'l' => $loc]
                );
                if ($tr) {
                    $b['title'] = $tr['title'];
                    if ($tr['description'] !== null) {
                        $b['description'] = $tr['description'];
                    }
                }
            }
            unset($b);
        }
        ResponseHelper::sendSuccess($banners, 'Banners retrieved');
    } catch (Exception $e) {
        Logger::error('Get banners error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve banners', 500);
    }
}

// ----------------------------------------------------------------------------- GET/PUT /cms/banners/:id/translations
if (($rs[0] ?? '') === 'banners' && isset($rs[1]) && ($rs[2] ?? '') === 'translations' && !isset($rs[3])) {
    Auth::requireAuth('admin');
    if (!in_array($method, ['GET', 'PUT', 'PATCH'], true)) {
        ResponseHelper::sendError('Method not allowed', 405);
    }
    $bannerId = $rs[1];
    $ban = $conn->fetch('SELECT id, title, description FROM remquip_banners WHERE id = :id AND deleted_at IS NULL', ['id' => $bannerId]);
    if (!$ban) {
        ResponseHelper::sendError('Banner not found', 404);
    }
    if ($method === 'GET') {
        try {
            $supported = get_supported_locales($conn);
            $out = array_fill_keys($supported, null);
            $rows = $conn->fetchAll(
                'SELECT locale, title, description FROM remquip_banner_translations WHERE banner_id = :id ORDER BY locale',
                ['id' => $bannerId]
            );
            foreach ($rows as $r) {
                $out[$r['locale']] = ['title' => $r['title'], 'description' => $r['description'] ?? ''];
            }
            ResponseHelper::sendSuccess(['banner_id' => $bannerId, 'translations' => $out, 'supported_locales' => $supported], 'Banner translations');
        } catch (Exception $e) {
            Logger::error('Banner translations GET', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to load translations', 500);
        }
    }
    if ($method === 'PUT' || $method === 'PATCH') {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $supported = get_supported_locales($conn);
            foreach ($supported as $loc) {
                if (!isset($data[$loc]) || !is_array($data[$loc])) {
                    continue;
                }
                $b = $data[$loc];
                $title = trim((string) ($b['title'] ?? ''));
                if ($title === '') {
                    continue;
                }
                $desc = isset($b['description']) ? (string) $b['description'] : '';
                $existing = $conn->fetch(
                    'SELECT id FROM remquip_banner_translations WHERE banner_id = :bid AND locale = :l',
                    ['bid' => $bannerId, 'l' => $loc]
                );
                if ($existing) {
                    $conn->execute(
                        'UPDATE remquip_banner_translations SET title = :t, description = :d, updated_at = NOW() WHERE id = :id',
                        ['t' => $title, 'd' => $desc, 'id' => $existing['id']]
                    );
                } else {
                    $tid = $conn->fetch('SELECT UUID() AS u')['u'];
                    $conn->execute(
                        'INSERT INTO remquip_banner_translations (id, banner_id, locale, title, description) VALUES (:id, :bid, :l, :t, :d)',
                        ['id' => $tid, 'bid' => $bannerId, 'l' => $loc, 't' => $title, 'd' => $desc]
                    );
                }
            }
            ResponseHelper::sendSuccess(['id' => $bannerId], 'Banner translations saved');
        } catch (Exception $e) {
            Logger::error('Banner translations PUT', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to save translations', 500);
        }
    }
}

// ----------------------------------------------------------------------------- POST /cms/banners
if ($method === 'POST' && ($rs[0] ?? '') === 'banners' && !isset($rs[1])) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $img = $data['imageUrl'] ?? $data['image_url'] ?? '';
        if (empty($data['title']) || $img === '') {
            ResponseHelper::sendError('Title and image URL required', 400);
        }
        $newId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_banners (id, title, image_url, link_url, display_order, is_active)
             VALUES (:id, :title, :imageUrl, :linkUrl, :order, 1)',
            [
                'id' => $newId,
                'title' => $data['title'],
                'imageUrl' => $img,
                'linkUrl' => $data['linkUrl'] ?? $data['link_url'] ?? '',
                'order' => isset($data['displayOrder']) ? (int) $data['displayOrder'] : (isset($data['display_order']) ? (int) $data['display_order'] : 0),
            ]
        );
        Logger::info('Banner created', ['banner_id' => $newId]);
        ResponseHelper::sendSuccess(['id' => $newId], 'Banner created successfully', 201);
    } catch (Exception $e) {
        Logger::error('Create banner error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create banner', 500);
    }
}

// ----------------------------------------------------------------------------- PUT/PATCH /cms/banners/:id
if (($method === 'PUT' || $method === 'PATCH') && ($rs[0] ?? '') === 'banners' && isset($rs[1]) && !isset($rs[2])) {
    Auth::requireAuth('admin');
    try {
        $bannerId = $rs[1];
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $bannerId];
        if (isset($data['title'])) {
            $updates[] = 'title = :title';
            $params['title'] = $data['title'];
        }
        if (isset($data['imageUrl']) || isset($data['image_url'])) {
            $updates[] = 'image_url = :image_url';
            $params['image_url'] = $data['imageUrl'] ?? $data['image_url'];
        }
        if (isset($data['linkUrl']) || isset($data['link_url'])) {
            $updates[] = 'link_url = :link_url';
            $params['link_url'] = $data['linkUrl'] ?? $data['link_url'] ?? '';
        }
        if (isset($data['displayOrder']) || isset($data['display_order'])) {
            $updates[] = 'display_order = :display_order';
            $params['display_order'] = (int) ($data['displayOrder'] ?? $data['display_order'] ?? 0);
        }
        if (isset($data['is_active']) || isset($data['isActive'])) {
            $updates[] = 'is_active = :is_active';
            $params['is_active'] = (int) (bool) ($data['is_active'] ?? $data['isActive']);
        }
        if (!$updates) {
            ResponseHelper::sendError('No fields to update', 400);
        }
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_banners SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);
        ResponseHelper::sendSuccess(['id' => $bannerId], 'Banner updated');
    } catch (Exception $e) {
        Logger::error('Update banner error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update banner', 500);
    }
}

// ----------------------------------------------------------------------------- DELETE /cms/banners/:id (soft)
if ($method === 'DELETE' && ($rs[0] ?? '') === 'banners' && isset($rs[1]) && !isset($rs[2])) {
    Auth::requireAuth('admin');
    try {
        $conn->execute('UPDATE remquip_banners SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND deleted_at IS NULL', ['id' => $rs[1]]);
        ResponseHelper::sendSuccess(null, 'Banner deleted');
    } catch (Exception $e) {
        Logger::error('Delete banner error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete banner', 500);
    }
}

ResponseHelper::sendError('CMS endpoint not found', 404);
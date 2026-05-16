<?php
/**
 * CATEGORIES — list/get/create/update/delete + locale overlays + /translations sub-resource
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

function remquip_normalize_locale(?string $raw, $conn): string
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

function remquip_category_apply_locale(array $row, string $locale, $conn): array
{
    $tr = $conn->fetch(
        'SELECT name, description FROM remquip_category_translations WHERE category_id = :id AND locale = :loc',
        ['id' => $row['id'], 'loc' => $locale]
    );
    if ($tr) {
        $row['name'] = $tr['name'];
        $row['description'] = $tr['description'] ?? $row['description'] ?? '';
    }
    return $row;
}

function remquip_category_upsert_translation($conn, string $categoryId, string $locale, string $name, ?string $description): void
{
    $supported = get_supported_locales($conn);
    if (!in_array($locale, $supported, true)) {
        return;
    }
    $existing = $conn->fetch(
        'SELECT id FROM remquip_category_translations WHERE category_id = :c AND locale = :l',
        ['c' => $categoryId, 'l' => $locale]
    );
    if ($existing) {
        $conn->execute(
            'UPDATE remquip_category_translations SET name = :n, description = :d, updated_at = NOW() WHERE id = :id',
            ['n' => $name, 'd' => $description ?? '', 'id' => $existing['id']]
        );
    } else {
        $tid = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_category_translations (id, category_id, locale, name, description) VALUES (:id, :c, :l, :n, :d)',
            ['id' => $tid, 'c' => $categoryId, 'l' => $locale, 'n' => $name, 'd' => $description ?? '']
        );
    }
}

// ----------------------------------------------------------------------------- GET/PUT /categories/:id/translations
if ($id && ($action ?? '') === 'translations') {
    Auth::requireAuth('admin');
    if (!in_array($method, ['GET', 'PUT', 'PATCH'], true)) {
        ResponseHelper::sendError('Method not allowed', 405);
    }
    $cat = $conn->fetch('SELECT id FROM remquip_categories WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
    if (!$cat) {
        ResponseHelper::sendError('Category not found', 404);
    }

    if ($method === 'GET') {
        try {
            $supported = get_supported_locales($conn);
            $out = array_fill_keys($supported, null);
            $rows = $conn->fetchAll(
                'SELECT locale, name, description FROM remquip_category_translations WHERE category_id = :id ORDER BY locale',
                ['id' => $id]
            );
            foreach ($rows as $r) {
                $out[$r['locale']] = ['name' => $r['name'], 'description' => $r['description'] ?? ''];
            }
            ResponseHelper::sendSuccess(['category_id' => $id, 'translations' => $out, 'supported_locales' => $supported], 'Translations');
        } catch (Exception $e) {
            Logger::error('Category translations GET', ['error' => $e->getMessage()]);
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
                $block = $data[$loc];
                $name = trim((string) ($block['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $desc = isset($block['description']) ? (string) $block['description'] : '';
                remquip_category_upsert_translation($conn, $id, $loc, $name, $desc);
            }
            ResponseHelper::sendSuccess(['id' => $id], 'Translations saved');
        } catch (Exception $e) {
            Logger::error('Category translations PUT', ['error' => $e->getMessage()]);
            ResponseHelper::sendError('Failed to save translations', 500);
        }
    }
}

// ----------------------------------------------------------------------------- GET /categories - List
if ($method === 'GET' && !$id) {
    try {
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $page = max(1, (int) $_GET['page']);
            $offset = ($page - 1) * $limit;
        }
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $locale = remquip_normalize_locale($_GET['locale'] ?? 'en', $conn);
        $adminList = isset($_GET['admin']) && $_GET['admin'] === '1';
        if ($adminList) {
            Auth::requireAuth('admin');
        }

        $where = ['c.deleted_at IS NULL'];
        $params = [];
        if (!$adminList) {
            $where[] = 'c.is_active = 1';
        }

        if ($search) {
            $where[] = '(c.name LIKE :search OR c.description LIKE :search)';
            $params['search'] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_categories c WHERE $whereClause",
            $params
        )['total'] ?? 0;

        $params['limit'] = $limit;
        $params['offset'] = $offset;

        $categories = $conn->fetchAll(
            "SELECT c.id, c.name, c.slug, c.description, c.image_url, c.display_order, c.is_active,
                    (SELECT COUNT(*) FROM remquip_products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count
             FROM remquip_categories c
             WHERE $whereClause
             ORDER BY c.display_order ASC
             LIMIT :limit OFFSET :offset",
            $params
        );

        foreach ($categories as &$catRow) {
            $catRow = remquip_category_apply_locale($catRow, $locale, $conn);
        }
        unset($catRow);

        if ($adminList) {
            foreach ($categories as &$row) {
                $trs = $conn->fetchAll(
                    'SELECT locale, name, description FROM remquip_category_translations WHERE category_id = :id ORDER BY locale',
                    ['id' => $row['id']]
                );
                $row['translations'] = $trs;
            }
            unset($row);
        }

        ResponseHelper::sendPaginated($categories, $total, $limit, $offset, 'Categories retrieved');
    } catch (Exception $e) {
        Logger::error('Get categories error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve categories', 500);
    }
}

// ----------------------------------------------------------------------------- GET /categories/:id
if ($method === 'GET' && $id && !$action) {
    try {
        $locale = remquip_normalize_locale($_GET['locale'] ?? 'en', $conn);
        $category = $conn->fetch(
            "SELECT * FROM remquip_categories WHERE (id = :id OR slug = :id) AND deleted_at IS NULL",
            ['id' => $id]
        );

        if (!$category) {
            ResponseHelper::sendError('Category not found', 404);
        }

        $category = remquip_category_apply_locale($category, $locale, $conn);

        $products = $conn->fetchAll(
            "SELECT id, sku, name, base_price as price FROM remquip_products 
             WHERE category_id = :id AND is_active = 1 AND deleted_at IS NULL
             LIMIT 20",
            ['id' => $category['id']]
        );

        $category['products'] = $products;
        $category['locale'] = $locale;

        ResponseHelper::sendSuccess($category, 'Category details retrieved');
    } catch (Exception $e) {
        Logger::error('Get category error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve category', 500);
    }
}

// ----------------------------------------------------------------------------- POST /categories
if ($method === 'POST' && !$id) {
    Auth::requireAuth('admin');

    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['name'])) {
            ResponseHelper::sendError('Name is required', 400);
        }

        $slug = !empty($data['slug'])
            ? strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', (string) $data['slug']), '-'))
            : strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', (string) $data['name']), '-'));

        $categoryId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_categories (id, name, slug, description, image_url, display_order, is_active)
             VALUES (:id, :name, :slug, :description, :imageUrl, :order, 1)",
            [
                'id' => $categoryId,
                'name' => $data['name'],
                'slug' => $slug,
                'description' => $data['description'] ?? '',
                'imageUrl' => $data['imageUrl'] ?? '',
                'order' => isset($data['displayOrder']) ? (int) $data['displayOrder'] : 0,
            ]
        );

        remquip_category_upsert_translation(
            $conn,
            $categoryId,
            'en',
            (string) $data['name'],
            isset($data['description']) ? (string) $data['description'] : ''
        );
        if (!empty($data['translations']) && is_array($data['translations'])) {
            foreach (get_supported_locales($conn) as $loc) {
                if (empty($data['translations'][$loc]['name'])) {
                    continue;
                }
                remquip_category_upsert_translation(
                    $conn,
                    $categoryId,
                    $loc,
                    (string) $data['translations'][$loc]['name'],
                    isset($data['translations'][$loc]['description']) ? (string) $data['translations'][$loc]['description'] : ''
                );
            }
        }

        Logger::info('Category created', ['category_id' => $categoryId]);
        ResponseHelper::sendSuccess(['id' => $categoryId], 'Category created successfully', 201);
    } catch (Exception $e) {
        Logger::error('Create category error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create category', 500);
    }
}

// ----------------------------------------------------------------------------- PATCH/PUT /categories/:id
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    Auth::requireAuth('admin');

    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $id];

        if (isset($data['name'])) {
            $updates[] = 'name = :name';
            $params['name'] = $data['name'];
        }
        if (isset($data['slug']) && $data['slug'] !== '') {
            $updates[] = 'slug = :slug';
            $params['slug'] = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', (string) $data['slug']), '-'));
        }
        if (array_key_exists('description', $data)) {
            $updates[] = 'description = :description';
            $params['description'] = (string) $data['description'];
        }
        if (array_key_exists('imageUrl', $data)) {
            $updates[] = 'image_url = :imageUrl';
            $params['imageUrl'] = (string) $data['imageUrl'];
        }
        if (isset($data['status'])) {
            $updates[] = 'is_active = :isActive';
            $params['isActive'] = $data['status'] === 'active' ? 1 : 0;
        }
        if (isset($data['is_active'])) {
            $updates[] = 'is_active = :isActive2';
            $params['isActive2'] = (int) (bool) $data['is_active'];
        }
        if (isset($data['displayOrder'])) {
            $updates[] = 'display_order = :order';
            $params['order'] = (int) $data['displayOrder'];
        }

        if ($updates) {
            $updates[] = 'updated_at = NOW()';
            $conn->execute('UPDATE remquip_categories SET ' . implode(', ', $updates) . ' WHERE id = :id', $params);
        }

        if (isset($data['name']) || array_key_exists('description', $data)) {
            $row = $conn->fetch('SELECT name, description FROM remquip_categories WHERE id = :id', ['id' => $id]);
            if ($row) {
                remquip_category_upsert_translation($conn, $id, 'en', $row['name'], $row['description'] ?? '');
            }
        }

        if (!empty($data['translations']) && is_array($data['translations'])) {
            foreach (get_supported_locales($conn) as $loc) {
                if (empty($data['translations'][$loc]['name'])) {
                    continue;
                }
                remquip_category_upsert_translation(
                    $conn,
                    $id,
                    $loc,
                    (string) $data['translations'][$loc]['name'],
                    isset($data['translations'][$loc]['description']) ? (string) $data['translations'][$loc]['description'] : ''
                );
            }
        }

        Logger::info('Category updated', ['category_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Category updated successfully');
    } catch (Exception $e) {
        Logger::error('Update category error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update category', 500);
    }
}

// ----------------------------------------------------------------------------- DELETE /categories/:id
if ($method === 'DELETE' && $id && !$action) {
    Auth::requireAuth('admin');

    try {
        $conn->execute('UPDATE remquip_categories SET deleted_at = NOW() WHERE id = :id', ['id' => $id]);
        Logger::info('Category deleted', ['category_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Category deleted successfully');
    } catch (Exception $e) {
        Logger::error('Delete category error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete category', 500);
    }
}

ResponseHelper::sendError('Category endpoint not found', 404);

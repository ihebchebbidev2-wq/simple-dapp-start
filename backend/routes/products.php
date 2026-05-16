<?php
/**
 * PRODUCTS ROUTES - Full CRUD implementation
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];
$isAdmin = false;

// Check if admin for POST/PATCH/DELETE
if (in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'])) {
    Auth::requireAuth('admin');
    $isAdmin = true;
}

// GET /products/featured
if ($method === 'GET' && $id === 'featured' && !$action) {
    try {
        $rows = $conn->fetchAll(
            "SELECT p.id, p.sku, p.name, p.description, p.base_price as price, p.discount_percent, c.slug as categorySlug,
                    (SELECT image_url FROM remquip_product_images WHERE product_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as image,
                    COALESCE(inv.quantity_available, 0) as stock
             FROM remquip_products p
             LEFT JOIN remquip_categories c ON p.category_id = c.id
             LEFT JOIN remquip_inventory inv ON p.id = inv.product_id
             WHERE p.is_active = 1 AND p.deleted_at IS NULL
             ORDER BY p.created_at DESC
             LIMIT 24"
        );
        ResponseHelper::sendSuccess($rows, 'Featured products');
    } catch (Exception $e) {
        Logger::error('Featured products error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load featured products', 500);
    }
}

// GET /products — list (also /products/search?q= via id=search)
if ($method === 'GET' && (!$id || $id === 'search' || ($id === 'category' && $action))) {
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $page = max(1, (int)$_GET['page']);
            $offset = ($page - 1) * $limit;
        }
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        if ($id === 'search') {
            $search = trim($_GET['q'] ?? $_GET['search'] ?? '');
        }
        $category = isset($_GET['category']) ? trim($_GET['category']) : '';
        if ($id === 'category' && $action) {
            $category = $action;
        }
        $inStock = isset($_GET['inStock']) ? $_GET['inStock'] === 'true' : false;
        $sort = isset($_GET['sort']) ? $_GET['sort'] : 'featured';
        
        // Build query
        $where = ['p.is_active = 1', 'p.deleted_at IS NULL', 'c.is_active = 1'];
        // Admin callers can see all statuses including archived (deleted_at IS NOT NULL)
        if (isset($_GET['include_archived']) && $_GET['include_archived'] === 'true') {
            $where = ['1=1', 'c.is_active = 1'];
        }
        $params = [];
        
        if ($search) {
            $where[] = "(p.name LIKE :search_name OR p.sku LIKE :search_sku OR p.description LIKE :search_desc)";
            $searchLike = "%$search%";
            $params['search_name'] = $searchLike;
            $params['search_sku'] = $searchLike;
            $params['search_desc'] = $searchLike;
        }
        
        if ($category) {
            // Path is /products/category/:segment — match slug or category UUID
            $where[] = "(c.slug = :categorySlug OR c.id = :categoryId)";
            $params['categorySlug'] = $category;
            $params['categoryId'] = $category;
        }
        
        if ($inStock) {
            $where[] = "COALESCE(inv.quantity_available, 0) > 0";
        }
        
        $whereClause = implode(' AND ', $where);
        
        // Count total
        $countSql = "SELECT COUNT(DISTINCT p.id) as total FROM remquip_products p 
                     LEFT JOIN remquip_categories c ON p.category_id = c.id 
                     LEFT JOIN remquip_inventory inv ON p.id = inv.product_id 
                     WHERE $whereClause";
        $total = $conn->fetch($countSql, $params)['total'] ?? 0;
        
        // Get products
        // NOTE: Do not use PHP 8 `match()` here because the production host may run PHP < 8.
        switch ($sort) {
            case 'price_low':
                $orderBy = 'p.base_price ASC';
                break;
            case 'price_high':
                $orderBy = 'p.base_price DESC';
                break;
            case 'newest':
                $orderBy = 'p.created_at DESC';
                break;
            default:
                $orderBy = 'p.created_at DESC';
                break;
        }
        
        $sql = "SELECT p.id, p.sku, p.name, p.description, p.category_id, p.base_price as price, p.discount_percent, p.created_at,
                       p.is_active,
                       CASE WHEN p.deleted_at IS NOT NULL THEN 'archived' WHEN p.is_active = 1 THEN 'active' ELSE 'draft' END as status,
                       c.name as category, c.slug as categorySlug,
                       (SELECT image_url FROM remquip_product_images WHERE product_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as image,
                       COALESCE(inv.quantity_available, 0) as stock,
                       COALESCE(inv.quantity_available, 0) as stock_quantity,
                       COALESCE(p.minimum_stock, 0) as minimum_stock
                FROM remquip_products p
                LEFT JOIN remquip_categories c ON p.category_id = c.id
                LEFT JOIN remquip_inventory inv ON p.id = inv.product_id
                WHERE $whereClause
                ORDER BY $orderBy
                LIMIT :limit OFFSET :offset";
        
        $params['limit'] = $limit;
        $params['offset'] = $offset;
        
        $products = $conn->fetchAll($sql, $params);
        
        ResponseHelper::sendPaginated($products, $total, $limit, $offset, 'Products retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get products error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve products', 500, ['error' => $e->getMessage()]);
    }
}

// GET /products/:id/stats - Admin product detail stats (orders, revenue, viewer counts)
if ($method === 'GET' && $id && $action === 'stats') {
    Auth::requireAuth('admin');
    try {
        $pid = $id;

        // Sales summary
        $sales = $conn->fetch(
            "SELECT
                COUNT(DISTINCT oi.order_id)   AS total_orders,
                COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
                COALESCE(SUM(oi.line_total), 0) AS total_revenue
             FROM remquip_order_items oi
             INNER JOIN remquip_orders o ON oi.order_id = o.id AND o.deleted_at IS NULL
             WHERE oi.product_id = :pid",
            ['pid' => $pid]
        );

        // Recent orders containing this product (last 15)
        $recentOrders = $conn->fetchAll(
            "SELECT
                o.id, o.order_number, o.status, o.payment_status,
                o.total, o.created_at,
                oi.quantity, oi.unit_price, oi.line_total,
                c.company_name AS customer_name, c.email AS customer_email
             FROM remquip_order_items oi
             INNER JOIN remquip_orders o ON oi.order_id = o.id AND o.deleted_at IS NULL
             LEFT JOIN remquip_customers c ON o.customer_id = c.id
             WHERE oi.product_id = :pid
             ORDER BY o.created_at DESC
             LIMIT 15",
            ['pid' => $pid]
        );

        // Page-view analytics events for this product (event_type = product_view, data->product_id)
        $viewCount = 0;
        try {
            $row = $conn->fetch(
                "SELECT COUNT(*) AS c FROM remquip_analytics
                 WHERE event_type = 'product_view'
                 AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.product_id')) = :pid",
                ['pid' => $pid]
            );
            $viewCount = (int)($row['c'] ?? 0);
        } catch (Exception $_) {}

        ResponseHelper::sendSuccess([
            'total_orders'     => (int)($sales['total_orders'] ?? 0),
            'total_units_sold' => (int)($sales['total_units_sold'] ?? 0),
            'total_revenue'    => (float)($sales['total_revenue'] ?? 0),
            'view_count'       => $viewCount,
            'recent_orders'    => $recentOrders,
        ], 'Product stats');
    } catch (Exception $e) {
        Logger::error('Product stats error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load product stats', 500);
    }
}

// GET /products/:id - Get product details (exclude reserved paths)
if ($method === 'GET' && $id && !$action && $id !== 'search' && $id !== 'featured' && $id !== 'category') {
    try {
        $product = $conn->fetch(
            "SELECT p.*, c.name as category, c.slug as categorySlug
             FROM remquip_products p
             LEFT JOIN remquip_categories c ON p.category_id = c.id
             WHERE (p.id = :id_p OR p.sku = :id_s)
             AND p.deleted_at IS NULL",
            ['id_p' => $id, 'id_s' => $id]
        );
        
        if (!$product) {
            ResponseHelper::sendError('Product not found', 404);
        }
        
        $images = $conn->fetchAll(
            "SELECT id, image_url, alt_text, is_primary FROM remquip_product_images 
             WHERE product_id = :id ORDER BY is_primary DESC, display_order ASC",
            ['id' => $product['id']]
        );
        
        $variants = $conn->fetchAll(
            "SELECT id, variant_name, variant_value, price_modifier FROM remquip_product_variants 
             WHERE product_id = :id AND is_active = 1 ORDER BY display_order ASC",
            ['id' => $product['id']]
        );
        
        $inventory = $conn->fetch(
            "SELECT quantity_on_hand, quantity_reserved, quantity_available FROM remquip_inventory WHERE product_id = :id",
            ['id' => $product['id']]
        );
        
        $product['images'] = $images;
        $product['variants'] = $variants;
        $product['stock'] = (int)($inventory['quantity_available'] ?? 0);
        $product['stock_quantity'] = $product['stock'];
        $product['details'] = is_string($product['details']) ? json_decode($product['details'], true) : ($product['details'] ?? []);
        
        ResponseHelper::sendSuccess($product, 'Product details retrieved');
        
    } catch (Throwable $e) {
        Logger::error('Get product error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve product: ' . $e->getMessage(), 500, [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]);
    }
}

// POST /products - Create product (Admin only)
if ($method === 'POST' && !$id) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (empty($data['categoryId']) && !empty($data['category_id'])) {
            $data['categoryId'] = $data['category_id'];
        }
        if (isset($data['base_price']) && !isset($data['basePrice'])) {
            $data['basePrice'] = $data['base_price'];
        }
        $required = ['sku', 'name', 'categoryId', 'basePrice'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                ResponseHelper::sendError("Missing required field: $field", 400);
            }
        }
        
        $productId = $conn->fetch('SELECT UUID() AS u')['u'];
        $discPct = isset($data['discount_percent']) ? max(0, min(100, (float)$data['discount_percent'])) : 0;
        $conn->execute(
            "INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, minimum_stock, discount_percent, is_active)
             VALUES (:id, :sku, :name, :categoryId, :description, :details, :basePrice, :costPrice, :minStock, :discPct, 1)",
            [
                'id' => $productId,
                'sku' => strtoupper($data['sku']),
                'name' => $data['name'],
                'categoryId' => $data['categoryId'],
                'description' => $data['description'] ?? '',
                'details' => json_encode($data['details'] ?? []),
                'basePrice' => (float)$data['basePrice'],
                'costPrice' => isset($data['costPrice']) ? (float)$data['costPrice'] : null,
                'minStock'  => isset($data['minimum_stock']) ? (int)$data['minimum_stock'] : 0,
                'discPct'   => $discPct
            ]
        );

        $conn->execute(
            "INSERT INTO remquip_inventory (product_id, quantity_on_hand, reorder_level, reorder_quantity)
             VALUES (:productId, 0, 10, 50)",
            ['productId' => $productId]
        );

        $initial = 0;
        if (isset($data['initialStock'])) {
            $initial = max(0, (int)$data['initialStock']);
        } elseif (isset($data['stock_quantity'])) {
            $initial = max(0, (int)$data['stock_quantity']);
        }
        if ($initial > 0) {
            $conn->execute(
                "UPDATE remquip_inventory SET quantity_on_hand = :q WHERE product_id = :id",
                ['q' => $initial, 'id' => $productId]
            );
        }
        
        Logger::info('Product created', ['product_id' => $productId]);
        ResponseHelper::sendSuccess(['id' => $productId], 'Product created successfully', 201);
        
    } catch (Exception $e) {
        Logger::error('Create product error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create product', 500);
    }
}

// PATCH/PUT /products/:id - Update product (Admin only)
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (isset($data['base_price']) && !isset($data['basePrice'])) {
            $data['basePrice'] = $data['base_price'];
        }
        if (isset($data['cost_price']) && !isset($data['costPrice'])) {
            $data['costPrice'] = $data['cost_price'];
        }
        if (empty($data['categoryId']) && !empty($data['category_id'])) {
            $data['categoryId'] = $data['category_id'];
        }

        $updates = [];
        $params = ['id' => $id];

        if (isset($data['name'])) {
            $updates[] = "name = :name";
            $params['name'] = $data['name'];
        }
        if (isset($data['sku'])) {
            $updates[] = "sku = :sku";
            $params['sku'] = strtoupper(trim((string)$data['sku']));
        }
        if (isset($data['basePrice'])) {
            $updates[] = "base_price = :basePrice";
            $params['basePrice'] = (float)$data['basePrice'];
        }
        if (array_key_exists('costPrice', $data)) {
            $updates[] = "cost_price = :costPrice";
            $params['costPrice'] = ($data['costPrice'] === null || $data['costPrice'] === '')
                ? null
                : (float)$data['costPrice'];
        }
        if (isset($data['categoryId'])) {
            $updates[] = "category_id = :categoryId";
            $params['categoryId'] = $data['categoryId'];
        }
        if (array_key_exists('description', $data)) {
            $updates[] = "description = :description";
            $params['description'] = $data['description'] ?? '';
        }
        if (array_key_exists('details', $data) && is_array($data['details'])) {
            $updates[] = "details = :details";
            $params['details'] = json_encode($data['details']);
        }
        if (isset($data['status'])) {
            if ($data['status'] === 'archived') {
                // Archived = soft-deleted + inactive
                $updates[] = "is_active = 0";
                $updates[] = "deleted_at = NOW()";
            } else {
                $updates[] = "is_active = :isActive";
                $params['isActive'] = $data['status'] === 'active' ? 1 : 0;
                // Un-archive if was previously archived
                $updates[] = "deleted_at = NULL";
            }
        }
        if (array_key_exists('minimum_stock', $data)) {
            $updates[] = "minimum_stock = :minStock";
            $params['minStock'] = (int)$data['minimum_stock'];
        }
        if (array_key_exists('discount_percent', $data)) {
            $dp = (float)$data['discount_percent'];
            $updates[] = "discount_percent = :discPct";
            $params['discPct'] = max(0, min(100, $dp));
        }

        $didSomething = false;
        if ($updates) {
            $updates[] = "updated_at = NOW()";
            $conn->execute("UPDATE remquip_products SET " . implode(', ', $updates) . " WHERE id = :id", $params);
            $didSomething = true;
        }

        if (array_key_exists('stock_quantity', $data) || array_key_exists('quantityOnHand', $data)) {
            $qty = max(0, (int)($data['stock_quantity'] ?? $data['quantityOnHand'] ?? 0));
            $conn->execute(
                "UPDATE remquip_inventory SET quantity_on_hand = :qty, updated_at = NOW() WHERE product_id = :id",
                ['qty' => $qty, 'id' => $id]
            );
            $didSomething = true;
        }

        if (!$didSomething) {
            ResponseHelper::sendError('No fields to update', 400);
        }

        Logger::info('Product updated', ['product_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Product updated successfully');
        
    } catch (Exception $e) {
        Logger::error('Update product error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update product', 500);
    }
}

// DELETE /products/:id - Delete product (Admin only, soft delete)
if ($method === 'DELETE' && $id && !$action) {
    try {
        $conn->execute("UPDATE remquip_products SET deleted_at = NOW() WHERE id = :id", ['id' => $id]);
        Logger::info('Product deleted', ['product_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Product deleted successfully');
        
    } catch (Exception $e) {
        Logger::error('Delete product error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete product', 500);
    }
}

// =====================================================================
// PRODUCT IMAGES MANAGEMENT (/products/:id/images[/:imageId])
// =====================================================================

$imgProductId = isset($rs[0], $rs[1]) && $rs[1] === 'images' ? $rs[0] : null;
$imgId = (isset($rs[2]) && $rs[1] === 'images') ? $rs[2] : ($_GET['imageId'] ?? null);

// POST /products/:id/images — multipart field "image"
if ($method === 'POST' && $imgProductId && ($rs[1] ?? '') === 'images' && !isset($rs[2])) {
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
        $filename = 'PRD-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $filepath = $uploadDir . '/' . $filename;
        $publicPath = '/backend/uploads/products_images/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            ResponseHelper::sendError('Failed to save file', 500);
        }
        $newId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_product_images (id, product_id, image_url, alt_text, is_primary, display_order)
             VALUES (:id, :pid, :url, :alt, 0, 99)",
            ['id' => $newId, 'pid' => $imgProductId, 'url' => $publicPath, 'alt' => $_POST['altText'] ?? '']
        );
        ResponseHelper::sendSuccess(
            ['id' => $newId, 'product_id' => $imgProductId, 'image_url' => $publicPath],
            'Image uploaded',
            201
        );
    } catch (Exception $e) {
        Logger::error('Product image upload error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to upload image', 500);
    }
}

// DELETE /products/:id/images/:imageId - Delete product image
if ($method === 'DELETE' && $imgProductId && ($rs[1] ?? '') === 'images' && $imgId) {
    try {
        $imageId = $imgId;
        $productId = $imgProductId;

        // Get image details
        $image = $conn->fetch(
            "SELECT COALESCE(NULLIF(file_url, ''), image_url) AS path FROM remquip_product_images WHERE id = :id AND product_id = :productId",
            ['id' => $imageId, 'productId' => $productId]
        );
        
        if (!$image || empty($image['path'])) {
            ResponseHelper::sendError('Image not found', 404);
        }
        
        $filePath = __DIR__ . '/..' . $image['path'];
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
        
        // Delete from database
        $conn->execute("DELETE FROM remquip_product_images WHERE id = :id", ['id' => $imageId]);
        
        Logger::info('Product image deleted', ['product_id' => $productId, 'image_id' => $imageId]);
        ResponseHelper::sendSuccess(null, 'Image deleted successfully');
        
    } catch (Exception $e) {
        Logger::error('Delete image error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete image', 500);
    }
}

// PATCH/PUT /products/:id/images/:imageId - Update image details
if (($method === 'PATCH' || $method === 'PUT') && $imgProductId && ($rs[1] ?? '') === 'images' && $imgId) {
    try {
        $imageId = $imgId;
        $id = $imgProductId;
        if (!$imageId) {
            ResponseHelper::sendError('Image ID required', 400);
        }
        
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $imageId];
        
        if (isset($data['altText'])) {
            $updates[] = "alt_text = :altText";
            $params['altText'] = $data['altText'];
        }
        
        if (isset($data['isPrimary'])) {
            // If setting as primary, unset other primary images
            if ($data['isPrimary']) {
                $conn->execute(
                    "UPDATE remquip_product_images SET is_primary = 0 WHERE product_id = :productId",
                    ['productId' => $id]
                );
            }
            $updates[] = "is_primary = :isPrimary";
            $params['isPrimary'] = $data['isPrimary'] ? 1 : 0;
        }
        
        if (isset($data['displayOrder'])) {
            $updates[] = "display_order = :order";
            $params['order'] = (int)$data['displayOrder'];
        }
        
        if (!$updates) ResponseHelper::sendError('No fields to update', 400);
        
        $conn->execute("UPDATE remquip_product_images SET " . implode(', ', $updates) . " WHERE id = :id", $params);
        
        Logger::info('Product image updated', ['product_id' => $id, 'image_id' => $imageId]);
        ResponseHelper::sendSuccess(['id' => $imageId], 'Image updated successfully');
        
    } catch (Exception $e) {
        Logger::error('Update image error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update image', 500);
    }
}

// GET /products/:id/images - Get all product images
if ($method === 'GET' && $imgProductId && ($rs[1] ?? '') === 'images' && !isset($rs[2])) {
    try {
        $images = $conn->fetchAll(
            "SELECT id, image_url, alt_text, is_primary, display_order FROM remquip_product_images
             WHERE product_id = :id
             ORDER BY is_primary DESC, display_order ASC",
            ['id' => $imgProductId]
        );
        
        ResponseHelper::sendSuccess($images, 'Product images retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get images error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve images', 500);
    }
}

// =====================================================================
// PER-CUSTOMER PRODUCT PRICE AUGMENTATIONS (/products/:id/customer-prices[/:cpId])
// =====================================================================

$cpProductId = isset($rs[0], $rs[1]) && $rs[1] === 'customer-prices' ? $rs[0] : null;
$cpId = (isset($rs[2]) && $rs[1] === 'customer-prices') ? $rs[2] : null;

// GET /products/:id/customer-prices — list per-customer augmentations for a product (admin)
if ($method === 'GET' && $cpProductId && ($rs[1] ?? '') === 'customer-prices' && !$cpId) {
    Auth::requireAuth('admin');
    try {
        $rows = $conn->fetchAll(
            "SELECT cpp.id, cpp.customer_id, cpp.product_id, cpp.augmentation_percent, cpp.created_at, cpp.updated_at,
                    c.company_name, c.contact_person, c.email
             FROM remquip_customer_product_prices cpp
             INNER JOIN remquip_customers c ON cpp.customer_id = c.id AND c.deleted_at IS NULL
             WHERE cpp.product_id = :pid
             ORDER BY c.company_name ASC",
            ['pid' => $cpProductId]
        );
        ResponseHelper::sendSuccess($rows, 'Customer product prices');
    } catch (Exception $e) {
        Logger::error('Get customer product prices error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load customer product prices', 500);
    }
}

// POST /products/:id/customer-prices — add or update per-customer augmentation (admin)
if ($method === 'POST' && $cpProductId && ($rs[1] ?? '') === 'customer-prices' && !$cpId) {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $customerId = trim((string)($data['customer_id'] ?? ''));
        $augPercent = (float)($data['augmentation_percent'] ?? 0);

        if ($customerId === '') {
            ResponseHelper::sendError('customer_id is required', 400);
        }

        // Upsert
        $existing = $conn->fetch(
            "SELECT id FROM remquip_customer_product_prices WHERE customer_id = :cid AND product_id = :pid",
            ['cid' => $customerId, 'pid' => $cpProductId]
        );

        if ($existing) {
            $conn->execute(
                "UPDATE remquip_customer_product_prices SET augmentation_percent = :aug, updated_at = NOW() WHERE id = :id",
                ['aug' => $augPercent, 'id' => $existing['id']]
            );
            $resultId = $existing['id'];
        } else {
            $resultId = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                "INSERT INTO remquip_customer_product_prices (id, customer_id, product_id, augmentation_percent)
                 VALUES (:id, :cid, :pid, :aug)",
                ['id' => $resultId, 'cid' => $customerId, 'pid' => $cpProductId, 'aug' => $augPercent]
            );
        }

        Logger::info('Customer product price set', ['product_id' => $cpProductId, 'customer_id' => $customerId, 'percent' => $augPercent]);
        ResponseHelper::sendSuccess(['id' => $resultId], 'Customer product price saved', 201);
    } catch (Exception $e) {
        Logger::error('Set customer product price error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to save customer product price', 500);
    }
}

// DELETE /products/:id/customer-prices/:cpId — remove per-customer augmentation (admin)
if ($method === 'DELETE' && $cpProductId && ($rs[1] ?? '') === 'customer-prices' && $cpId) {
    Auth::requireAuth('admin');
    try {
        $conn->execute("DELETE FROM remquip_customer_product_prices WHERE id = :id AND product_id = :pid", ['id' => $cpId, 'pid' => $cpProductId]);
        Logger::info('Customer product price deleted', ['id' => $cpId, 'product_id' => $cpProductId]);
        ResponseHelper::sendSuccess(null, 'Customer product price removed');
    } catch (Exception $e) {
        Logger::error('Delete customer product price error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete customer product price', 500);
    }
}

ResponseHelper::sendError('Product endpoint not found', 404);
?>

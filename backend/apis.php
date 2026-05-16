<?php
/**
 * REMQUIP NEXUS - Complete API Server
 * All endpoints for the admin dashboard and customer portal
 * Version: 1.0
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    header('Content-Length: 0', true);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

// ==================== HELPER FUNCTIONS ====================

function getMethod() {
    return $_SERVER['REQUEST_METHOD'];
}

function getPath() {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    return trim($path, '/');
}

function getInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

function getQuery($param, $default = null) {
    return $_GET[$param] ?? $default;
}

function sanitize($value) {
    if (is_array($value)) {
        return array_map('sanitize', $value);
    }
    return trim(htmlspecialchars($value, ENT_QUOTES, 'UTF-8'));
}

function sendJson($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function sendError($message, $code = 400, $errors = null) {
    sendJson([
        'success' => false,
        'message' => $message,
        'errors' => $errors
    ], $code);
}

function sendSuccess($data, $message = 'Success', $code = 200) {
    sendJson([
        'success' => true,
        'message' => $message,
        'data' => $data
    ], $code);
}

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function hashPassword($password) {
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
}

function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

function generateToken($userId, $role) {
    $payload = [
        'user_id' => $userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ];
    return base64_encode(json_encode($payload));
}

function getAuthToken() {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        return null;
    }
    
    $parts = explode(' ', $headers['Authorization']);
    return count($parts) === 2 && $parts[0] === 'Bearer' ? $parts[1] : null;
}

function verifyToken($token) {
    try {
        $payload = json_decode(base64_decode($token), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
            return null;
        }
        return $payload;
    } catch (Exception $e) {
        return null;
    }
}

function requireAuth($requiredRole = null) {
    $token = getAuthToken();
    if (!$token) {
        sendError('Unauthorized: Missing token', 401);
    }
    
    $payload = verifyToken($token);
    if (!$payload) {
        sendError('Unauthorized: Invalid token', 401);
    }
    
    if ($requiredRole && $payload['role'] !== 'admin' && $payload['role'] !== $requiredRole) {
        sendError('Forbidden: Insufficient permissions', 403);
    }
    
    return $payload;
}

// ==================== DATABASE CONNECTION ====================

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    sendError('Database connection failed', 500);
}

// ==================== ROUTING ====================

$method = getMethod();
$path = getPath();
$parts = explode('/', trim($path, '/'));

// Remove 'api' from path if present
if ($parts[0] === 'api' || $parts[0] === 'Backend') {
    array_shift($parts);
}

$resource = $parts[0] ?? '';
$id = $parts[1] ?? '';
$subresource = $parts[2] ?? '';

// ==================== AUTH ENDPOINTS ====================

if ($resource === 'auth') {
    if ($method === 'POST' && $id === 'login') {
        $data = getInput();
        
        if (!isset($data['email']) || !isset($data['password'])) {
            sendError('Email and password required');
        }
        
        try {
            $stmt = $conn->prepare("SELECT id, password_hash, role, full_name FROM remquip_users WHERE email = :email AND deleted_at IS NULL");
            $stmt->execute(['email' => sanitize($data['email'])]);
            $user = $stmt->fetch();
            
            if (!$user || !verifyPassword($data['password'], $user['password_hash'])) {
                sendError('Invalid email or password', 401);
            }
            
            $token = generateToken($user['id'], $user['role']);
            
            $updateStmt = $conn->prepare("UPDATE remquip_users SET last_login = NOW() WHERE id = :id");
            $updateStmt->execute(['id' => $user['id']]);
            
            sendSuccess([
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'full_name' => $user['full_name'],
                    'role' => $user['role']
                ]
            ], 'Login successful');
        } catch (Exception $e) {
            sendError('Login failed: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && $id === 'logout') {
        sendSuccess([], 'Logout successful');
    }
}

// ==================== USERS ENDPOINTS ====================

if ($resource === 'users') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List users
        try {
            $search = getQuery('search', '');
            $role = getQuery('role', '');
            $limit = (int)getQuery('limit', 10);
            $offset = (int)getQuery('offset', 0);
            
            $query = "SELECT id, email, full_name, role, status, phone, created_at, updated_at FROM remquip_users WHERE deleted_at IS NULL";
            $params = [];
            
            if ($search) {
                $query .= " AND (full_name LIKE :search OR email LIKE :search)";
                $params['search'] = "%{$search}%";
            }
            
            if ($role) {
                $query .= " AND role = :role";
                $params['role'] = $role;
            }
            
            $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
            
            $stmt = $conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $users = $stmt->fetchAll();
            
            $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM remquip_users WHERE deleted_at IS NULL");
            $countStmt->execute();
            $total = $countStmt->fetch()['total'];
            
            sendSuccess([
                'users' => $users,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);
        } catch (Exception $e) {
            sendError('Failed to fetch users: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && !$id) {
        // Create user
        try {
            $data = getInput();
            
            if (!isset($data['email']) || !isset($data['password']) || !isset($data['full_name'])) {
                sendError('Missing required fields');
            }
            
            if (!validateEmail($data['email'])) {
                sendError('Invalid email format');
            }
            
            $checkStmt = $conn->prepare("SELECT id FROM remquip_users WHERE email = :email");
            $checkStmt->execute(['email' => $data['email']]);
            
            if ($checkStmt->fetch()) {
                sendError('Email already exists');
            }
            
            $userId = bin2hex(random_bytes(18));
            $stmt = $conn->prepare("INSERT INTO remquip_users (id, email, password_hash, full_name, role, status) VALUES (:id, :email, :password, :name, :role, 'active')");
            
            $stmt->execute([
                'id' => $userId,
                'email' => sanitize($data['email']),
                'password' => hashPassword($data['password']),
                'name' => sanitize($data['full_name']),
                'role' => $data['role'] ?? 'user'
            ]);
            
            sendSuccess(['id' => $userId], 'User created successfully', 201);
        } catch (Exception $e) {
            sendError('Failed to create user: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'GET' && $id) {
        // Get single user
        try {
            $stmt = $conn->prepare("SELECT id, email, full_name, role, status, phone, avatar_url, created_at FROM remquip_users WHERE id = :id AND deleted_at IS NULL");
            $stmt->execute(['id' => $id]);
            $user = $stmt->fetch();
            
            if (!$user) {
                sendError('User not found', 404);
            }
            
            sendSuccess($user);
        } catch (Exception $e) {
            sendError('Failed to fetch user: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'PATCH' && $id) {
        // Update user
        try {
            $data = getInput();
            
            $updates = [];
            $params = ['id' => $id];
            
            if (isset($data['full_name'])) {
                $updates[] = "full_name = :name";
                $params['name'] = sanitize($data['full_name']);
            }
            
            if (isset($data['role'])) {
                $updates[] = "role = :role";
                $params['role'] = $data['role'];
            }
            
            if (isset($data['status'])) {
                $updates[] = "status = :status";
                $params['status'] = $data['status'];
            }
            
            if (isset($data['phone'])) {
                $updates[] = "phone = :phone";
                $params['phone'] = sanitize($data['phone']);
            }
            
            if (isset($data['password'])) {
                $updates[] = "password_hash = :password";
                $params['password'] = hashPassword($data['password']);
            }
            
            if (empty($updates)) {
                sendError('No fields to update');
            }
            
            $updates[] = "updated_at = NOW()";
            $query = "UPDATE remquip_users SET " . implode(', ', $updates) . " WHERE id = :id";
            
            $stmt = $conn->prepare($query);
            $stmt->execute($params);
            
            sendSuccess([], 'User updated successfully');
        } catch (Exception $e) {
            sendError('Failed to update user: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'DELETE' && $id) {
        // Soft delete user
        try {
            $stmt = $conn->prepare("UPDATE remquip_users SET deleted_at = NOW(), status = 'inactive' WHERE id = :id");
            $stmt->execute(['id' => $id]);
            
            sendSuccess([], 'User deleted successfully');
        } catch (Exception $e) {
            sendError('Failed to delete user: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== PRODUCTS ENDPOINTS ====================

if ($resource === 'products') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List products
        try {
            $search = getQuery('search', '');
            $category = getQuery('category', '');
            $limit = (int)getQuery('limit', 20);
            $offset = (int)getQuery('offset', 0);
            
            $query = "SELECT p.*, c.name as category_name FROM remquip_products p LEFT JOIN remquip_categories c ON p.category_id = c.id WHERE p.deleted_at IS NULL";
            $params = [];
            
            if ($search) {
                $query .= " AND (p.name LIKE :search OR p.sku LIKE :search)";
                $params['search'] = "%{$search}%";
            }
            
            if ($category) {
                $query .= " AND p.category_id = :category";
                $params['category'] = $category;
            }
            
            $query .= " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset";
            
            $stmt = $conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $products = $stmt->fetchAll();
            
            $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM remquip_products WHERE deleted_at IS NULL");
            $countStmt->execute();
            $total = $countStmt->fetch()['total'];
            
            sendSuccess([
                'products' => $products,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);
        } catch (Exception $e) {
            sendError('Failed to fetch products: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && !$id) {
        // Create product
        try {
            $data = getInput();
            
            if (!isset($data['category_id']) || !isset($data['name']) || !isset($data['sku']) || !isset($data['base_price'])) {
                sendError('Missing required fields');
            }
            
            $productId = bin2hex(random_bytes(18));
            
            $stmt = $conn->prepare("INSERT INTO remquip_products (id, category_id, sku, name, description, base_price, cost_price, is_active) 
                                   VALUES (:id, :category, :sku, :name, :description, :price, :cost, 1)");
            
            $stmt->execute([
                'id' => $productId,
                'category' => $data['category_id'],
                'sku' => sanitize($data['sku']),
                'name' => sanitize($data['name']),
                'description' => sanitize($data['description'] ?? ''),
                'price' => (float)$data['base_price'],
                'cost' => (float)($data['cost_price'] ?? 0)
            ]);
            
            sendSuccess(['id' => $productId], 'Product created successfully', 201);
        } catch (Exception $e) {
            sendError('Failed to create product: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'GET' && $id) {
        // Get single product
        try {
            $stmt = $conn->prepare("SELECT p.*, c.name as category_name FROM remquip_products p LEFT JOIN remquip_categories c ON p.category_id = c.id WHERE p.id = :id AND p.deleted_at IS NULL");
            $stmt->execute(['id' => $id]);
            $product = $stmt->fetch();
            
            if (!$product) {
                sendError('Product not found', 404);
            }
            
            // Get images
            $imagesStmt = $conn->prepare("SELECT * FROM remquip_product_images WHERE product_id = :id ORDER BY display_order");
            $imagesStmt->execute(['id' => $id]);
            $product['images'] = $imagesStmt->fetchAll();
            
            // Get variants
            $variantsStmt = $conn->prepare("SELECT * FROM remquip_product_variants WHERE product_id = :id AND is_active = 1");
            $variantsStmt->execute(['id' => $id]);
            $product['variants'] = $variantsStmt->fetchAll();
            
            sendSuccess($product);
        } catch (Exception $e) {
            sendError('Failed to fetch product: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'PATCH' && $id) {
        // Update product
        try {
            $data = getInput();
            
            $updates = [];
            $params = ['id' => $id];
            
            if (isset($data['name'])) {
                $updates[] = "name = :name";
                $params['name'] = sanitize($data['name']);
            }
            
            if (isset($data['description'])) {
                $updates[] = "description = :description";
                $params['description'] = sanitize($data['description']);
            }
            
            if (isset($data['base_price'])) {
                $updates[] = "base_price = :price";
                $params['price'] = (float)$data['base_price'];
            }
            
            if (isset($data['is_active'])) {
                $updates[] = "is_active = :active";
                $params['active'] = (bool)$data['is_active'];
            }
            
            if (empty($updates)) {
                sendError('No fields to update');
            }
            
            $updates[] = "updated_at = NOW()";
            $query = "UPDATE remquip_products SET " . implode(', ', $updates) . " WHERE id = :id";
            
            $stmt = $conn->prepare($query);
            $stmt->execute($params);
            
            sendSuccess([], 'Product updated successfully');
        } catch (Exception $e) {
            sendError('Failed to update product: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'DELETE' && $id) {
        // Soft delete product
        try {
            $stmt = $conn->prepare("UPDATE remquip_products SET deleted_at = NOW(), is_active = 0 WHERE id = :id");
            $stmt->execute(['id' => $id]);
            
            sendSuccess([], 'Product deleted successfully');
        } catch (Exception $e) {
            sendError('Failed to delete product: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== CATEGORIES ENDPOINTS ====================

if ($resource === 'categories') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List categories
        try {
            $stmt = $conn->prepare("SELECT * FROM remquip_categories WHERE deleted_at IS NULL ORDER BY display_order");
            $stmt->execute();
            $categories = $stmt->fetchAll();
            
            sendSuccess($categories);
        } catch (Exception $e) {
            sendError('Failed to fetch categories: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && !$id) {
        // Create category
        try {
            $data = getInput();
            
            if (!isset($data['name'])) {
                sendError('Name required');
            }
            
            $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $data['name']), '-'));
            $categoryId = bin2hex(random_bytes(18));
            
            $stmt = $conn->prepare("INSERT INTO remquip_categories (id, name, slug, description, display_order, is_active) VALUES (:id, :name, :slug, :description, :order, 1)");
            
            $stmt->execute([
                'id' => $categoryId,
                'name' => sanitize($data['name']),
                'slug' => $slug,
                'description' => sanitize($data['description'] ?? ''),
                'order' => (int)($data['display_order'] ?? 0)
            ]);
            
            sendSuccess(['id' => $categoryId], 'Category created successfully', 201);
        } catch (Exception $e) {
            sendError('Failed to create category: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'GET' && $id) {
        // Get single category
        try {
            $stmt = $conn->prepare("SELECT * FROM remquip_categories WHERE id = :id AND deleted_at IS NULL");
            $stmt->execute(['id' => $id]);
            $category = $stmt->fetch();
            
            if (!$category) {
                sendError('Category not found', 404);
            }
            
            sendSuccess($category);
        } catch (Exception $e) {
            sendError('Failed to fetch category: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== INVENTORY ENDPOINTS ====================

if ($resource === 'inventory') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List inventory
        try {
            $limit = (int)getQuery('limit', 20);
            $offset = (int)getQuery('offset', 0);
            
            $stmt = $conn->prepare("SELECT i.*, p.sku, p.name FROM remquip_inventory i JOIN remquip_products p ON i.product_id = p.id ORDER BY i.updated_at DESC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $inventory = $stmt->fetchAll();
            
            sendSuccess($inventory);
        } catch (Exception $e) {
            sendError('Failed to fetch inventory: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'PATCH' && $id) {
        // Update inventory
        try {
            $data = getInput();
            
            if (!isset($data['quantity_change']) || !isset($data['reason'])) {
                sendError('quantity_change and reason required');
            }
            
            // Get current inventory
            $inventoryStmt = $conn->prepare("SELECT * FROM remquip_inventory WHERE product_id = :id");
            $inventoryStmt->execute(['id' => $id]);
            $inventory = $inventoryStmt->fetch();
            
            if (!$inventory) {
                sendError('Inventory not found', 404);
            }
            
            $oldQuantity = $inventory['quantity_on_hand'];
            $newQuantity = $oldQuantity + $data['quantity_change'];
            
            if ($newQuantity < 0) {
                sendError('Insufficient stock');
            }
            
            // Update inventory
            $updateStmt = $conn->prepare("UPDATE remquip_inventory SET quantity_on_hand = :qty WHERE product_id = :id");
            $updateStmt->execute(['qty' => $newQuantity, 'id' => $id]);
            
            // Log change
            $logId = bin2hex(random_bytes(18));
            $logStmt = $conn->prepare("INSERT INTO remquip_inventory_logs (id, product_id, user_id, action, quantity_change, reason, old_quantity, new_quantity) VALUES (:id, :product, :user, 'adjustment', :change, :reason, :old, :new)");
            
            $logStmt->execute([
                'id' => $logId,
                'product' => $id,
                'user' => $auth['user_id'],
                'change' => $data['quantity_change'],
                'reason' => sanitize($data['reason']),
                'old' => $oldQuantity,
                'new' => $newQuantity
            ]);
            
            sendSuccess(['new_quantity' => $newQuantity], 'Inventory updated successfully');
        } catch (Exception $e) {
            sendError('Failed to update inventory: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== CUSTOMERS ENDPOINTS ====================

if ($resource === 'customers') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List customers
        try {
            $search = getQuery('search', '');
            $type = getQuery('type', '');
            $limit = (int)getQuery('limit', 20);
            $offset = (int)getQuery('offset', 0);
            
            $query = "SELECT * FROM remquip_customers WHERE deleted_at IS NULL";
            $params = [];
            
            if ($search) {
                $query .= " AND (company_name LIKE :search OR email LIKE :search OR contact_person LIKE :search)";
                $params['search'] = "%{$search}%";
            }
            
            if ($type) {
                $query .= " AND customer_type = :type";
                $params['type'] = $type;
            }
            
            $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
            
            $stmt = $conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $customers = $stmt->fetchAll();
            
            sendSuccess($customers);
        } catch (Exception $e) {
            sendError('Failed to fetch customers: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && !$id) {
        // Create customer
        try {
            $data = getInput();
            
            if (!isset($data['company_name']) || !isset($data['email'])) {
                sendError('company_name and email required');
            }
            
            $customerId = bin2hex(random_bytes(18));
            
            $stmt = $conn->prepare("INSERT INTO remquip_customers (id, company_name, contact_person, email, phone, customer_type, status, address, city, province, postal_code, country) 
                                   VALUES (:id, :company, :contact, :email, :phone, :type, 'active', :address, :city, :province, :zip, :country)");
            
            $stmt->execute([
                'id' => $customerId,
                'company' => sanitize($data['company_name']),
                'contact' => sanitize($data['contact_person'] ?? ''),
                'email' => sanitize($data['email']),
                'phone' => sanitize($data['phone'] ?? ''),
                'type' => $data['customer_type'] ?? 'Wholesale',
                'address' => sanitize($data['address'] ?? ''),
                'city' => sanitize($data['city'] ?? ''),
                'province' => sanitize($data['province'] ?? ''),
                'zip' => sanitize($data['postal_code'] ?? ''),
                'country' => sanitize($data['country'] ?? 'Canada')
            ]);
            
            sendSuccess(['id' => $customerId], 'Customer created successfully', 201);
        } catch (Exception $e) {
            sendError('Failed to create customer: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'GET' && $id) {
        // Get single customer
        try {
            $stmt = $conn->prepare("SELECT * FROM remquip_customers WHERE id = :id AND deleted_at IS NULL");
            $stmt->execute(['id' => $id]);
            $customer = $stmt->fetch();
            
            if (!$customer) {
                sendError('Customer not found', 404);
            }
            
            sendSuccess($customer);
        } catch (Exception $e) {
            sendError('Failed to fetch customer: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== ORDERS ENDPOINTS ====================

if ($resource === 'orders') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List orders
        try {
            $status = getQuery('status', '');
            $customer = getQuery('customer', '');
            $limit = (int)getQuery('limit', 20);
            $offset = (int)getQuery('offset', 0);
            
            $query = "SELECT * FROM remquip_orders WHERE deleted_at IS NULL";
            $params = [];
            
            if ($status) {
                $query .= " AND status = :status";
                $params['status'] = $status;
            }
            
            if ($customer) {
                $query .= " AND customer_id = :customer";
                $params['customer'] = $customer;
            }
            
            $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
            
            $stmt = $conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $orders = $stmt->fetchAll();
            
            sendSuccess($orders);
        } catch (Exception $e) {
            sendError('Failed to fetch orders: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && !$id) {
        // Create order
        try {
            $data = getInput();
            
            if (!isset($data['customer_id']) || !isset($data['items'])) {
                sendError('customer_id and items required');
            }
            
            $orderId = bin2hex(random_bytes(18));
            $orderNumber = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            
            $subtotal = 0;
            foreach ($data['items'] as $item) {
                $subtotal += ($item['quantity'] * $item['unit_price']);
            }
            
            $tax = isset($data['tax']) ? (float)$data['tax'] : 0;
            $shipping = isset($data['shipping']) ? (float)$data['shipping'] : 0;
            $discount = isset($data['discount']) ? (float)$data['discount'] : 0;
            $total = $subtotal + $tax + $shipping - $discount;
            
            $stmt = $conn->prepare("INSERT INTO remquip_orders (id, customer_id, order_number, status, subtotal, tax, shipping, discount, total, created_by) VALUES (:id, :customer, :number, 'pending', :subtotal, :tax, :shipping, :discount, :total, :user)");
            
            $stmt->execute([
                'id' => $orderId,
                'customer' => $data['customer_id'],
                'number' => $orderNumber,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'shipping' => $shipping,
                'discount' => $discount,
                'total' => $total,
                'user' => $auth['user_id']
            ]);
            
            // Add order items
            foreach ($data['items'] as $item) {
                $itemId = bin2hex(random_bytes(18));
                $itemStmt = $conn->prepare("INSERT INTO remquip_order_items (id, order_id, product_id, quantity, unit_price, line_total) VALUES (:id, :order, :product, :qty, :price, :total)");
                
                $lineTotal = $item['quantity'] * $item['unit_price'];
                $itemStmt->execute([
                    'id' => $itemId,
                    'order' => $orderId,
                    'product' => $item['product_id'],
                    'qty' => (int)$item['quantity'],
                    'price' => (float)$item['unit_price'],
                    'total' => $lineTotal
                ]);
            }
            
            sendSuccess(['id' => $orderId, 'order_number' => $orderNumber], 'Order created successfully', 201);
        } catch (Exception $e) {
            sendError('Failed to create order: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'GET' && $id && $subresource === 'items') {
        // Get order items
        try {
            $stmt = $conn->prepare("SELECT * FROM remquip_order_items WHERE order_id = :id");
            $stmt->execute(['id' => $id]);
            $items = $stmt->fetchAll();
            
            sendSuccess($items);
        } catch (Exception $e) {
            sendError('Failed to fetch order items: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== DISCOUNTS ENDPOINTS ====================

if ($resource === 'discounts') {
    $auth = requireAuth();
    
    if ($method === 'GET' && !$id) {
        // List discounts
        try {
            $active = getQuery('active', '');
            $limit = (int)getQuery('limit', 20);
            $offset = (int)getQuery('offset', 0);
            
            $query = "SELECT * FROM remquip_discounts";
            $params = [];
            
            if ($active !== '') {
                $query .= " WHERE is_active = :active";
                $params['active'] = (bool)$active;
            }
            
            $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
            
            $stmt = $conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $discounts = $stmt->fetchAll();
            
            sendSuccess($discounts);
        } catch (Exception $e) {
            sendError('Failed to fetch discounts: ' . $e->getMessage(), 500);
        }
    }
    
    if ($method === 'POST' && !$id) {
        // Create discount
        try {
            $data = getInput();
            
            if (!isset($data['code']) || !isset($data['discount_value'])) {
                sendError('code and discount_value required');
            }
            
            $discountId = bin2hex(random_bytes(18));
            
            $stmt = $conn->prepare("INSERT INTO remquip_discounts (id, code, name, discount_type, discount_value, customer_type, is_active) VALUES (:id, :code, :name, :type, :value, :customer_type, 1)");
            
            $stmt->execute([
                'id' => $discountId,
                'code' => strtoupper(sanitize($data['code'])),
                'name' => sanitize($data['name'] ?? ''),
                'type' => $data['discount_type'] ?? 'percentage',
                'value' => (float)$data['discount_value'],
                'customer_type' => $data['customer_type'] ?? 'All'
            ]);
            
            sendSuccess(['id' => $discountId], 'Discount created successfully', 201);
        } catch (Exception $e) {
            sendError('Failed to create discount: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== FILE UPLOAD ENDPOINTS ====================

if ($resource === 'upload') {
    $auth = requireAuth();
    
    if ($method === 'POST') {
        try {
            if (!isset($_FILES['file'])) {
                sendError('No file uploaded');
            }
            
            $file = $_FILES['file'];
            
            if ($file['error'] !== UPLOAD_ERR_OK) {
                $errors = [
                    UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
                    UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
                    UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                    UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                    UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                    UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk'
                ];
                
                sendError($errors[$file['error']] ?? 'Unknown upload error');
            }
            
            // Validate file type
            $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            
            if (!in_array($mimeType, $allowedTypes)) {
                sendError('Invalid file type. Allowed: JPG, PNG, GIF, WEBP');
            }
            
            // Validate file size (max 100MB)
            $maxSize = 100 * 1024 * 1024;
            if ($file['size'] > $maxSize) {
                sendError('File size exceeds 100MB limit');
            }
            
            // Create uploads directory
            $uploadsDir = __DIR__ . '/uploads/' . date('Y/m/d');
            @mkdir($uploadsDir, 0755, true);
            
            // Generate filename
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($extension === 'jpeg') $extension = 'jpg';
            
            $timestamp = time();
            $randomStr = bin2hex(random_bytes(4));
            $filename = "{$timestamp}_{$randomStr}.{$extension}";
            $filePath = $uploadsDir . '/' . $filename;
            $relativePath = "uploads/" . date('Y/m/d') . "/{$filename}";
            
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                sendError('Failed to save file');
            }
            
            // Store in database
            $fileId = bin2hex(random_bytes(18));
            $uploadType = getQuery('type', 'general');
            
            $stmt = $conn->prepare("INSERT INTO remquip_file_uploads (id, original_filename, stored_filename, file_path, file_size, mime_type, upload_type, user_id) VALUES (:id, :original, :stored, :path, :size, :mime, :type, :user)");
            
            $stmt->execute([
                'id' => $fileId,
                'original' => $file['name'],
                'stored' => $filename,
                'path' => $relativePath,
                'size' => $file['size'],
                'mime' => $mimeType,
                'type' => $uploadType,
                'user' => $auth['user_id']
            ]);
            
            sendSuccess([
                'id' => $fileId,
                'path' => $relativePath,
                'filename' => $filename,
                'url' => '/' . $relativePath
            ], 'File uploaded successfully', 201);
        } catch (Exception $e) {
            sendError('Upload failed: ' . $e->getMessage(), 500);
        }
    }
}

// ==================== DEFAULT RESPONSE ====================

sendError('Endpoint not found', 404);
?>

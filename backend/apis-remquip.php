
<?php
/**
 * REMQUIP NEXUS - Complete API Server with remquip_ table prefix
 * All endpoints for the admin dashboard and customer portal
 * Version: 2.0
 * 
 * TABLE NAMING CONVENTION:
 * All database tables use the remquip_ prefix for organization
 * - remquip_users
 * - remquip_products
 * - remquip_customers
 * - remquip_orders
 * - remquip_inventory_logs
 * - remquip_discounts
 * - remquip_categories (product categories)
 * - remquip_product_images
 * - remquip_product_variants
 * - remquip_order_items
 * - remquip_order_notes
 * - remquip_pages
 * - remquip_user_page_access
 * - remquip_cms_pages
 * - remquip_cms_sections
 * - remquip_audit_logs
 * - remquip_analytics_daily_metrics
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

// Include database config and helpers
require_once 'database.php';
require_once 'helpers.php';

// ==================== CONSTANTS ====================

// Table names with remquip_ prefix
const USERS_TABLE = 'remquip_users';
const CUSTOMERS_TABLE = 'remquip_customers';
const PRODUCTS_TABLE = 'remquip_products';
const PRODUCT_CATEGORIES_TABLE = 'remquip_categories';
const PRODUCT_IMAGES_TABLE = 'remquip_product_images';
const PRODUCT_VARIANTS_TABLE = 'remquip_product_variants';
const ORDERS_TABLE = 'remquip_orders';
const ORDER_ITEMS_TABLE = 'remquip_order_items';
const ORDER_NOTES_TABLE = 'remquip_order_notes';
const ORDER_TRACKING_TABLE = 'remquip_order_tracking_events';
const INVENTORY_LOGS_TABLE = 'remquip_inventory_logs';
const DISCOUNTS_TABLE = 'remquip_discounts';
const PAGES_TABLE = 'remquip_pages';
const USER_PAGE_ACCESS_TABLE = 'remquip_user_page_access';
const CMS_PAGES_TABLE = 'remquip_cms_pages';
const CMS_SECTIONS_TABLE = 'remquip_cms_sections';
const AUDIT_LOGS_TABLE = 'remquip_audit_logs';
/** Events table (see remquip_full_schema.sql); optional daily rollup table not in canonical schema */
const ANALYTICS_TABLE = 'remquip_analytics';
const PASSWORD_RESET_TABLE = 'remquip_password_reset_tokens';
const EMAIL_VERIFICATION_TABLE = 'remquip_email_verification_tokens';

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const ROLES = ['admin', 'manager', 'user'];
const USER_STATUS = ['active', 'inactive', 'suspended'];
const PASSWORD_MIN_LENGTH = 8;
const JWT_SECRET = 'your-secret-key-here';

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
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sendError($message, $code = 400, $errors = null) {
    sendJson([
        'success' => false,
        'message' => $message,
        'errors' => $errors,
        'timestamp' => date('Y-m-d H:i:s')
    ], $code);
}

function sendSuccess($data, $message = 'Success', $code = 200) {
    sendJson([
        'success' => true,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ], $code);
}

function sendPaginated($items, $total, $limit, $offset, $message = 'Success') {
    sendJson([
        'success' => true,
        'message' => $message,
        'data' => $items,
        'pagination' => [
            'total' => (int)$total,
            'limit' => (int)$limit,
            'offset' => (int)$offset,
            'page' => (int)floor($offset / $limit) + 1,
            'pages' => (int)ceil($total / $limit),
            'hasMore' => ($offset + $limit) < $total
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ], 200);
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

function generateJWT($userId, $role) {
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = json_encode([
        'user_id' => $userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ]);
    
    $base64Header = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');
    $base64Payload = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    
    $signature = hash_hmac(
        'sha256',
        $base64Header . '.' . $base64Payload,
        JWT_SECRET,
        true
    );
    $base64Signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    
    return $base64Header . '.' . $base64Payload . '.' . $base64Signature;
}

function getAuthToken() {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        return null;
    }
    
    $parts = explode(' ', $headers['Authorization']);
    return count($parts) === 2 && $parts[0] === 'Bearer' ? $parts[1] : null;
}

function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    
    try {
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
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
    
    $payload = verifyJWT($token);
    if (!$payload) {
        sendError('Unauthorized: Invalid or expired token', 401);
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

// Parse route: /api/endpoint/id/action
$parts = explode('/', $path);
if ($parts[0] !== 'api') {
    sendError('Invalid API endpoint', 404);
}

$endpoint = $parts[1] ?? null;
$id = $parts[2] ?? null;
$action = $parts[3] ?? null;

// ==================== API ROUTES ====================

switch ($endpoint) {
    
    // ===== AUTHENTICATION =====
    case 'auth':
        if ($action === 'login' && $method === 'POST') {
            $data = getInput();
            
            if (empty($data['email']) || empty($data['password'])) {
                sendError('Email and password required', 400);
            }
            
            try {
                $stmt = $conn->prepare("SELECT * FROM " . USERS_TABLE . " WHERE email = :email AND deleted_at IS NULL LIMIT 1");
                $stmt->execute(['email' => trim($data['email'])]);
                $user = $stmt->fetch();
                
                if (!$user || !verifyPassword($data['password'], $user['password_hash'])) {
                    sendError('Invalid credentials', 401);
                }
                
                if ($user['status'] !== 'active') {
                    sendError('Account is ' . $user['status'], 403);
                }
                
                // Update last login
                $updateStmt = $conn->prepare("UPDATE " . USERS_TABLE . " SET last_login = NOW() WHERE id = :id");
                $updateStmt->execute(['id' => $user['id']]);
                
                $token = generateJWT($user['id'], $user['role']);
                
                sendSuccess([
                    'token' => $token,
                    'user' => [
                        'id' => $user['id'],
                        'email' => $user['email'],
                        'full_name' => $user['full_name'],
                        'role' => $user['role']
                    ]
                ], 'Login successful', 200);
                
            } catch (Exception $e) {
                sendError('Login failed: ' . $e->getMessage(), 500);
            }
        }
        break;
    
    // ===== USERS =====
    case 'users':
        $auth = requireAuth();
        
        if ($method === 'GET' && !$id) {
            // List users (admin only)
            if ($auth['role'] !== 'admin') {
                sendError('Unauthorized', 403);
            }
            
            try {
                $limit = min((int)getQuery('limit', DEFAULT_LIMIT), MAX_LIMIT);
                $offset = (int)getQuery('offset', DEFAULT_OFFSET);
                $search = trim(getQuery('search', ''));
                $role = trim(getQuery('role', ''));
                $status = trim(getQuery('status', ''));
                
                $query = "SELECT id, email, full_name, role, status, phone, avatar_url, created_at FROM " . USERS_TABLE . " WHERE deleted_at IS NULL";
                $params = [];
                
                if ($search) {
                    $query .= " AND (full_name LIKE :search OR email LIKE :search)";
                    $params['search'] = "%{$search}%";
                }
                
                if ($role && in_array($role, ROLES)) {
                    $query .= " AND role = :role";
                    $params['role'] = $role;
                }
                
                if ($status && in_array($status, USER_STATUS)) {
                    $query .= " AND status = :status";
                    $params['status'] = $status;
                }
                
                // Count total
                $countQuery = "SELECT COUNT(*) as total FROM " . USERS_TABLE . " WHERE deleted_at IS NULL";
                if ($search) $countQuery .= " AND (full_name LIKE :search OR email LIKE :search)";
                if ($role) $countQuery .= " AND role = :role";
                if ($status) $countQuery .= " AND status = :status";
                
                $countStmt = $conn->prepare($countQuery);
                $countStmt->execute($params);
                $total = (int)$countStmt->fetch()['total'];
                
                // Get paginated results
                $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
                $stmt = $conn->prepare($query);
                foreach ($params as $key => $value) {
                    $stmt->bindValue($key, $value);
                }
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();
                
                $users = $stmt->fetchAll();
                sendPaginated($users, $total, $limit, $offset, 'Users retrieved');
                
            } catch (Exception $e) {
                sendError('Failed to fetch users: ' . $e->getMessage(), 500);
            }
        }
        break;
    
    // ===== PRODUCTS =====
    case 'products':
        if ($method === 'GET' && !$id) {
            // List products
            try {
                $limit = min((int)getQuery('limit', DEFAULT_LIMIT), MAX_LIMIT);
                $offset = (int)getQuery('offset', DEFAULT_OFFSET);
                $search = trim(getQuery('search', ''));
                $category = trim(getQuery('category', ''));
                $status = trim(getQuery('status', 'active'));
                
                $where = ['p.deleted_at IS NULL'];
                $params = [];
                
                if ($search) {
                    $where[] = "(p.name LIKE :search OR p.sku LIKE :search OR p.description LIKE :search)";
                    $params['search'] = "%{$search}%";
                }
                
                if ($category) {
                    $where[] = "pc.slug = :category";
                    $params['category'] = $category;
                }
                
                if ($status) {
                    $where[] = "p.status = :status";
                    $params['status'] = $status;
                }
                
                $whereClause = implode(' AND ', $where);
                
                // Count total
                $countSql = "SELECT COUNT(DISTINCT p.id) as total FROM " . PRODUCTS_TABLE . " p 
                            LEFT JOIN " . PRODUCT_CATEGORIES_TABLE . " pc ON p.category_id = pc.id 
                            WHERE $whereClause";
                $countStmt = $conn->prepare($countSql);
                $countStmt->execute($params);
                $total = (int)$countStmt->fetch()['total'];
                
                // Get products
                $sql = "SELECT p.id, p.sku, p.name, p.description, p.price, 
                               pc.name as category, pc.slug as categorySlug,
                               p.stock_quantity as stock, p.is_featured, p.status
                        FROM " . PRODUCTS_TABLE . " p
                        LEFT JOIN " . PRODUCT_CATEGORIES_TABLE . " pc ON p.category_id = pc.id
                        WHERE $whereClause
                        ORDER BY p.created_at DESC
                        LIMIT :limit OFFSET :offset";
                
                $params['limit'] = $limit;
                $params['offset'] = $offset;
                
                $stmt = $conn->prepare($sql);
                foreach ($params as $key => $value) {
                    if (strpos($key, ':') === false) {
                        $stmt->bindValue(':' . $key, $value);
                    } else {
                        $stmt->bindValue($key, $value);
                    }
                }
                $stmt->execute();
                
                $products = $stmt->fetchAll();
                sendPaginated($products, $total, $limit, $offset, 'Products retrieved');
                
            } catch (Exception $e) {
                sendError('Failed to fetch products: ' . $e->getMessage(), 500);
            }
        }
        break;
    
    // ===== CUSTOMERS =====
    case 'customers':
        $auth = requireAuth();
        
        if ($method === 'GET' && !$id) {
            // List customers (admin only)
            if ($auth['role'] !== 'admin') {
                sendError('Unauthorized', 403);
            }
            
            try {
                $limit = min((int)getQuery('limit', DEFAULT_LIMIT), MAX_LIMIT);
                $offset = (int)getQuery('offset', DEFAULT_OFFSET);
                $search = trim(getQuery('search', ''));
                $type = trim(getQuery('type', ''));
                $status = trim(getQuery('status', ''));
                
                $where = ['c.deleted_at IS NULL'];
                $params = [];
                
                if ($search) {
                    $where[] = "(c.company_name LIKE :search OR c.email LIKE :search OR c.contact_name LIKE :search)";
                    $params['search'] = "%{$search}%";
                }
                
                if ($type) {
                    $where[] = "c.customer_type = :type";
                    $params['type'] = $type;
                }
                
                if ($status) {
                    $where[] = "c.status = :status";
                    $params['status'] = $status;
                }
                
                $whereClause = implode(' AND ', $where);
                
                // Count total
                $countSql = "SELECT COUNT(*) as total FROM " . CUSTOMERS_TABLE . " c WHERE $whereClause";
                $countStmt = $conn->prepare($countSql);
                $countStmt->execute($params);
                $total = (int)$countStmt->fetch()['total'];
                
                // Get customers
                $sql = "SELECT c.id, c.company_name, c.contact_name, c.email, c.phone, c.customer_type, 
                              c.status, c.total_orders, c.total_spent, c.created_at
                        FROM " . CUSTOMERS_TABLE . " c
                        WHERE $whereClause
                        ORDER BY c.created_at DESC
                        LIMIT :limit OFFSET :offset";
                
                $params['limit'] = $limit;
                $params['offset'] = $offset;
                
                $stmt = $conn->prepare($sql);
                foreach ($params as $key => $value) {
                    if (strpos($key, ':') === false) {
                        $stmt->bindValue(':' . $key, $value);
                    } else {
                        $stmt->bindValue($key, $value);
                    }
                }
                $stmt->execute();
                
                $customers = $stmt->fetchAll();
                sendPaginated($customers, $total, $limit, $offset, 'Customers retrieved');
                
            } catch (Exception $e) {
                sendError('Failed to fetch customers: ' . $e->getMessage(), 500);
            }
        }
        break;
    
    // ===== ORDERS =====
    case 'orders':
        $auth = requireAuth();
        
        if ($method === 'GET' && !$id) {
            // List orders (admin only)
            if ($auth['role'] !== 'admin') {
                sendError('Unauthorized', 403);
            }
            
            try {
                $limit = min((int)getQuery('limit', DEFAULT_LIMIT), MAX_LIMIT);
                $offset = (int)getQuery('offset', DEFAULT_OFFSET);
                $search = trim(getQuery('search', ''));
                $status = trim(getQuery('status', ''));
                
                $where = ['o.deleted_at IS NULL'];
                $params = [];
                
                if ($search) {
                    $where[] = "(o.order_number LIKE :search OR c.company_name LIKE :search)";
                    $params['search'] = "%{$search}%";
                }
                
                if ($status) {
                    $where[] = "o.status = :status";
                    $params['status'] = $status;
                }
                
                $whereClause = implode(' AND ', $where);
                
                // Count total
                $countSql = "SELECT COUNT(*) as total FROM " . ORDERS_TABLE . " o 
                            LEFT JOIN " . CUSTOMERS_TABLE . " c ON o.customer_id = c.id 
                            WHERE $whereClause";
                $countStmt = $conn->prepare($countSql);
                $countStmt->execute($params);
                $total = (int)$countStmt->fetch()['total'];
                
                // Get orders
                $sql = "SELECT o.id, o.order_number, o.status, o.total, o.order_date,
                              c.company_name, c.contact_name
                        FROM " . ORDERS_TABLE . " o
                        LEFT JOIN " . CUSTOMERS_TABLE . " c ON o.customer_id = c.id
                        WHERE $whereClause
                        ORDER BY o.order_date DESC
                        LIMIT :limit OFFSET :offset";
                
                $params['limit'] = $limit;
                $params['offset'] = $offset;
                
                $stmt = $conn->prepare($sql);
                foreach ($params as $key => $value) {
                    if (strpos($key, ':') === false) {
                        $stmt->bindValue(':' . $key, $value);
                    } else {
                        $stmt->bindValue($key, $value);
                    }
                }
                $stmt->execute();
                
                $orders = $stmt->fetchAll();
                sendPaginated($orders, $total, $limit, $offset, 'Orders retrieved');
                
            } catch (Exception $e) {
                sendError('Failed to fetch orders: ' . $e->getMessage(), 500);
            }
        }
        break;
    
    default:
        sendError('API endpoint not found', 404);
}

$db->closeConnection();
?>

<?php
/**
 * =====================================================================
 * REMQUIP NEXUS - DATABASE CONFIGURATION
 * =====================================================================
 * 
 * This configuration file contains all database connection settings
 * and table name constants for the REMQUIP system with remquip_ prefix
 * 
 * Version: 2.0
 * Last Updated: 2026-03-20
 */

// =====================================================================
// DATABASE CONNECTION SETTINGS
// =====================================================================

// Primary database credentials
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'remquip_nexus');
define('DB_CHARSET', 'utf8mb4');
define('DB_PORT', getenv('DB_PORT') ?: 3306);

// Connection options
define('DB_PERSISTENT', false);
define('DB_TIMEOUT', 30);

// =====================================================================
// TABLE NAME CONSTANTS (All with remquip_ prefix)
// =====================================================================

// Core Authentication & Access Control
define('REMQUIP_USERS_TABLE', 'remquip_users');
define('REMQUIP_PAGES_TABLE', 'remquip_pages');
define('REMQUIP_USER_PAGE_ACCESS_TABLE', 'remquip_user_page_access');
define('REMQUIP_PASSWORD_RESET_TABLE', 'remquip_password_reset_tokens');
define('REMQUIP_EMAIL_VERIFICATION_TABLE', 'remquip_email_verification_tokens');

// Product Management
/** Canonical name in remquip_full_schema.sql */
define('REMQUIP_PRODUCT_CATEGORIES_TABLE', 'remquip_categories');
define('REMQUIP_PRODUCTS_TABLE', 'remquip_products');
define('REMQUIP_PRODUCT_IMAGES_TABLE', 'remquip_product_images');
define('REMQUIP_PRODUCT_VARIANTS_TABLE', 'remquip_product_variants');

// Customer Management
define('REMQUIP_CUSTOMERS_TABLE', 'remquip_customers');
define('REMQUIP_CUSTOMER_ADDRESSES_TABLE', 'remquip_customer_addresses');
define('REMQUIP_CUSTOMER_PREFERENCES_TABLE', 'remquip_customer_preferences');
define('REMQUIP_CUSTOMER_WISHLIST_TABLE', 'remquip_customer_wishlist');
define('REMQUIP_CUSTOMER_SESSIONS_TABLE', 'remquip_customer_sessions');

// Inventory & Orders
define('REMQUIP_INVENTORY_LOGS_TABLE', 'remquip_inventory_logs');
define('REMQUIP_ORDERS_TABLE', 'remquip_orders');
define('REMQUIP_ORDER_ITEMS_TABLE', 'remquip_order_items');
define('REMQUIP_ORDER_NOTES_TABLE', 'remquip_order_notes');
define('REMQUIP_ORDER_TRACKING_TABLE', 'remquip_order_tracking_events');

// Promotions & Content
define('REMQUIP_DISCOUNTS_TABLE', 'remquip_discounts');
define('REMQUIP_CMS_PAGES_TABLE', 'remquip_cms_pages');
define('REMQUIP_CMS_SECTIONS_TABLE', 'remquip_cms_sections');

// Audit & Analytics
define('REMQUIP_AUDIT_LOGS_TABLE', 'remquip_audit_logs');
define('REMQUIP_ANALYTICS_TABLE', 'remquip_analytics');

// =====================================================================
// BACKWARD COMPATIBILITY ALIASES (Optional - for gradual migration)
// =====================================================================
// Uncomment these if you want to use shorter names in code

define('USERS_TABLE', REMQUIP_USERS_TABLE);
define('PRODUCTS_TABLE', REMQUIP_PRODUCTS_TABLE);
define('CUSTOMERS_TABLE', REMQUIP_CUSTOMERS_TABLE);
define('ORDERS_TABLE', REMQUIP_ORDERS_TABLE);
define('INVENTORY_LOGS_TABLE', REMQUIP_INVENTORY_LOGS_TABLE);
define('DISCOUNTS_TABLE', REMQUIP_DISCOUNTS_TABLE);
define('PRODUCT_CATEGORIES_TABLE', REMQUIP_PRODUCT_CATEGORIES_TABLE);
define('PRODUCT_IMAGES_TABLE', REMQUIP_PRODUCT_IMAGES_TABLE);
define('PRODUCT_VARIANTS_TABLE', REMQUIP_PRODUCT_VARIANTS_TABLE);
define('ORDER_ITEMS_TABLE', REMQUIP_ORDER_ITEMS_TABLE);
define('ORDER_NOTES_TABLE', REMQUIP_ORDER_NOTES_TABLE);
define('PAGES_TABLE', REMQUIP_PAGES_TABLE);
define('USER_PAGE_ACCESS_TABLE', REMQUIP_USER_PAGE_ACCESS_TABLE);
define('CMS_PAGES_TABLE', REMQUIP_CMS_PAGES_TABLE);
define('CMS_SECTIONS_TABLE', REMQUIP_CMS_SECTIONS_TABLE);
define('AUDIT_LOGS_TABLE', REMQUIP_AUDIT_LOGS_TABLE);
define('ANALYTICS_TABLE', REMQUIP_ANALYTICS_TABLE);

// =====================================================================
// API CONFIGURATION
// =====================================================================

// API paths
define('API_VERSION', '2.0');
define('API_PREFIX', '/api');

// Pagination defaults
define('DEFAULT_LIMIT', 20);
define('MAX_LIMIT', 100);
define('DEFAULT_OFFSET', 0);

// Authentication
define('PASSWORD_MIN_LENGTH', 8);
define('PASSWORD_MAX_LENGTH', 255);
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'your-secret-key-change-in-production');
define('JWT_EXPIRATION', 24 * 60 * 60); // 24 hours
define('REFRESH_TOKEN_EXPIRATION', 30 * 24 * 60 * 60); // 30 days

// Security
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_DURATION', 15 * 60); // 15 minutes in seconds
define('ENABLE_RATE_LIMITING', true);
define('RATE_LIMIT_REQUESTS', 100);
define('RATE_LIMIT_WINDOW', 60); // 1 minute

// File uploads
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024); // 10 MB
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
define('UPLOAD_DIR', 'uploads/');
define('TEMP_UPLOAD_DIR', 'temp_uploads/');

// =====================================================================
// BUSINESS LOGIC CONSTANTS
// =====================================================================

// User roles
define('ROLES', ['admin', 'manager', 'user']);
define('ROLE_ADMIN', 'admin');
define('ROLE_MANAGER', 'manager');
define('ROLE_USER', 'user');

// User statuses
define('USER_STATUS', ['active', 'inactive', 'suspended']);
define('STATUS_ACTIVE', 'active');
define('STATUS_INACTIVE', 'inactive');
define('STATUS_SUSPENDED', 'suspended');

// Customer types
define('CUSTOMER_TYPES', ['Fleet', 'Wholesale', 'Distributor']);
define('CUSTOMER_TYPE_FLEET', 'Fleet');
define('CUSTOMER_TYPE_WHOLESALE', 'Wholesale');
define('CUSTOMER_TYPE_DISTRIBUTOR', 'Distributor');

// Order statuses
define('ORDER_STATUSES', ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']);
define('ORDER_STATUS_PENDING', 'pending');
define('ORDER_STATUS_PROCESSING', 'processing');
define('ORDER_STATUS_SHIPPED', 'shipped');
define('ORDER_STATUS_COMPLETED', 'completed');
define('ORDER_STATUS_CANCELLED', 'cancelled');
define('ORDER_STATUS_REFUNDED', 'refunded');

// Payment statuses
define('PAYMENT_STATUSES', ['pending', 'paid', 'failed']);
define('PAYMENT_STATUS_PENDING', 'pending');
define('PAYMENT_STATUS_PAID', 'paid');
define('PAYMENT_STATUS_FAILED', 'failed');

// Payment methods
define('PAYMENT_METHODS', ['credit_card', 'invoice', 'bank_transfer', 'cash', 'check']);
define('PAYMENT_METHOD_CREDIT_CARD', 'credit_card');
define('PAYMENT_METHOD_INVOICE', 'invoice');
define('PAYMENT_METHOD_BANK_TRANSFER', 'bank_transfer');
define('PAYMENT_METHOD_CASH', 'cash');
define('PAYMENT_METHOD_CHECK', 'check');

// Product statuses
define('PRODUCT_STATUSES', ['active', 'draft', 'archived']);
define('PRODUCT_STATUS_ACTIVE', 'active');
define('PRODUCT_STATUS_DRAFT', 'draft');
define('PRODUCT_STATUS_ARCHIVED', 'archived');

// Inventory actions
define('INVENTORY_ACTIONS', ['stock_in', 'stock_out', 'adjustment', 'return', 'damage', 'exchange']);
define('INVENTORY_ACTION_STOCK_IN', 'stock_in');
define('INVENTORY_ACTION_STOCK_OUT', 'stock_out');
define('INVENTORY_ACTION_ADJUSTMENT', 'adjustment');
define('INVENTORY_ACTION_RETURN', 'return');
define('INVENTORY_ACTION_DAMAGE', 'damage');
define('INVENTORY_ACTION_EXCHANGE', 'exchange');

// Discount types
define('DISCOUNT_TYPES', ['percentage', 'fixed']);
define('DISCOUNT_TYPE_PERCENTAGE', 'percentage');
define('DISCOUNT_TYPE_FIXED', 'fixed');

// =====================================================================
// LOGGING & DEBUG SETTINGS
// =====================================================================

define('DEBUG_MODE', getenv('DEBUG_MODE') === 'true');
define('LOG_DIR', 'logs/');
define('LOG_LEVEL', getenv('LOG_LEVEL') ?: 'info'); // debug, info, warning, error
define('LOG_MAX_SIZE', 10 * 1024 * 1024); // 10 MB
define('LOG_ROTATE_DAYS', 30); // Keep logs for 30 days

// =====================================================================
// EMAIL CONFIGURATION
// =====================================================================

define('MAIL_DRIVER', getenv('MAIL_DRIVER') ?: 'smtp');
define('MAIL_HOST', getenv('MAIL_HOST') ?: 'smtp.mailtrap.io');
define('MAIL_PORT', getenv('MAIL_PORT') ?: 465);
define('MAIL_USERNAME', getenv('MAIL_USERNAME') ?: '');
define('MAIL_PASSWORD', getenv('MAIL_PASSWORD') ?: '');
define('MAIL_FROM_ADDRESS', getenv('MAIL_FROM_ADDRESS') ?: 'noreply@remquip.com');
define('MAIL_FROM_NAME', getenv('MAIL_FROM_NAME') ?: 'REMQUIP NEXUS');

// =====================================================================
// EXTERNAL SERVICES
// =====================================================================

// AWS S3 (for file uploads)
define('AWS_ACCESS_KEY', getenv('AWS_ACCESS_KEY') ?: '');
define('AWS_SECRET_KEY', getenv('AWS_SECRET_KEY') ?: '');
define('AWS_REGION', getenv('AWS_REGION') ?: 'us-east-1');
define('AWS_BUCKET', getenv('AWS_BUCKET') ?: 'remquip-files');

// Payment Gateway (Stripe)
define('STRIPE_PUBLIC_KEY', getenv('STRIPE_PUBLIC_KEY') ?: '');
define('STRIPE_SECRET_KEY', getenv('STRIPE_SECRET_KEY') ?: '');

// =====================================================================
// CORS & SECURITY
// =====================================================================

define('ALLOWED_ORIGINS', explode(',', getenv('ALLOWED_ORIGINS') ?: 'http://localhost:3000,http://localhost:3001'));
define('CORS_CREDENTIALS', true);
define('CORS_MAX_AGE', 86400);

// =====================================================================
// FEATURES & FLAGS
// =====================================================================

define('FEATURE_TWO_FACTOR_AUTH', getenv('FEATURE_TWO_FACTOR_AUTH') === 'true');
define('FEATURE_EMAIL_VERIFICATION', getenv('FEATURE_EMAIL_VERIFICATION') === 'true');
define('FEATURE_API_THROTTLING', getenv('FEATURE_API_THROTTLING') === 'true');
define('FEATURE_AUDIT_LOGGING', getenv('FEATURE_AUDIT_LOGGING') === 'true');

// =====================================================================
// CACHE CONFIGURATION (Optional)
// =====================================================================

define('CACHE_DRIVER', getenv('CACHE_DRIVER') ?: 'file');
define('CACHE_TTL', 3600); // 1 hour
define('CACHE_DIR', 'cache/');

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Get a table name constant by short name
 * Example: getTableName('users') returns REMQUIP_USERS_TABLE value
 */
function getTableName($shortName) {
    $tables = [
        'users' => REMQUIP_USERS_TABLE,
        'products' => REMQUIP_PRODUCTS_TABLE,
        'customers' => REMQUIP_CUSTOMERS_TABLE,
        'orders' => REMQUIP_ORDERS_TABLE,
        'product_categories' => REMQUIP_PRODUCT_CATEGORIES_TABLE,
        'categories' => REMQUIP_PRODUCT_CATEGORIES_TABLE,
        'product_images' => REMQUIP_PRODUCT_IMAGES_TABLE,
        'product_variants' => REMQUIP_PRODUCT_VARIANTS_TABLE,
        'inventory_logs' => REMQUIP_INVENTORY_LOGS_TABLE,
        'order_items' => REMQUIP_ORDER_ITEMS_TABLE,
        'order_notes' => REMQUIP_ORDER_NOTES_TABLE,
        'discounts' => REMQUIP_DISCOUNTS_TABLE,
        'pages' => REMQUIP_PAGES_TABLE,
        'user_page_access' => REMQUIP_USER_PAGE_ACCESS_TABLE,
        'cms_pages' => REMQUIP_CMS_PAGES_TABLE,
        'cms_sections' => REMQUIP_CMS_SECTIONS_TABLE,
        'audit_logs' => REMQUIP_AUDIT_LOGS_TABLE,
        'analytics' => REMQUIP_ANALYTICS_TABLE,
    ];
    
    return $tables[$shortName] ?? null;
}

/**
 * Validate a value against a list of allowed values
 */
function validateStatus($status, $type = 'user') {
    $statuses = [
        'user' => USER_STATUS,
        'order' => ORDER_STATUSES,
        'product' => PRODUCT_STATUSES,
        'payment' => PAYMENT_STATUSES,
    ];
    
    return isset($statuses[$type]) && in_array($status, $statuses[$type]);
}

// =====================================================================
// INITIALIZATION
// =====================================================================

// Create required directories if they don't exist
$dirs = [LOG_DIR, UPLOAD_DIR, TEMP_UPLOAD_DIR, CACHE_DIR];
foreach ($dirs as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
}

// Set timezone
date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'UTC');

// Set error reporting based on debug mode
if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 0);
}

?>

<?php
/**
 * =====================================================================
 * REMQUIP NEXUS - CONFIGURATION
 * All settings below are hardcoded (no .env / getenv).
 * =====================================================================
 */

// Database — same host as `Database` in database.php (OVH MySQL)
define('DB_HOST', 'luccybcdb.mysql.db');
define('DB_USER', 'luccybcdb');
define('DB_PASS', 'Dadouhibou2025');
define('DB_NAME', 'luccybcdb');
define('DB_PORT', 3306);
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATION', 'utf8mb4_unicode_ci');

// API / app URLs — folder containing api.php (Frontend API_BASE_URL; calls api.php?path=...)
define('API_URL', 'https://luccibyey.com.tn/remquip/backend');
define('FRONTEND_URL', 'https://www.remquip.ca');
define('API_VERSION', '1.0.0');

// JWT — change this string if tokens must be invalidated site-wide
define('JWT_SECRET', 'remquip_jwt_hs256_2025_luccybc_production_change_if_leaked_min_32_chars');
define('TOKEN_EXPIRY', 24 * 60 * 60); // 24 hours in seconds

// File Upload Configuration
define('UPLOAD_DIR', __DIR__ . '/uploads');
define('MAX_UPLOAD_SIZE', 100 * 1024 * 1024); // 100 MB
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
define('ALLOWED_IMAGE_EXT', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
define('ALLOWED_FILE_TYPES', ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

// Pagination
define('DEFAULT_LIMIT', 10);
define('MAX_LIMIT', 100);
define('DEFAULT_OFFSET', 0);

// Password Configuration
define('PASSWORD_COST', 12); // bcrypt cost factor
define('PASSWORD_MIN_LENGTH', 8);

// Timezone
define('APP_TIMEZONE', 'America/Toronto');
date_default_timezone_set(APP_TIMEZONE);

// Locale
define('APP_LOCALE', 'en_CA');

// Currency
define('CURRENCY_CODE', 'CAD');
define('CURRENCY_SYMBOL', 'C$');

// Email — OVH (ssl0.ovh.net): 465 SSL (recommended) or 587 STARTTLS
define('SMTP_HOST', 'ssl0.ovh.net');
define('SMTP_PORT', 465);
define('SMTP_ENCRYPTION', 'ssl'); // ssl | tls (use tls when SMTP_PORT is 587)
define('SMTP_USER', 'remquip_email_confirmationaccoun@luccibyey.com.tn');
define('SMTP_PASS', 'Dadouhibou2025');
define('SMTP_FROM', 'remquip_email_confirmationaccoun@luccibyey.com.tn');

/**
 * SMTP Account Pool — up to 5 mailboxes used with automatic failover.
 * The sender iterates through this list in order. If a send fails
 * (quota exceeded, auth error, data failed, etc.), the next account is
 * tried automatically. Round-robin is applied across requests so quota
 * usage is spread evenly.
 *
 * To add more mailboxes, just append entries. Empty user/pass entries
 * are skipped. The primary (SMTP_USER above) is kept first for backwards
 * compatibility.
 */
define('SMTP_ACCOUNTS', [
    [
        'host' => 'ssl0.ovh.net',
        'port' => 465,
        'encryption' => 'ssl',
        'user' => 'remquip_email_confirmationaccoun@luccibyey.com.tn',
        'pass' => 'Dadouhibou2025',
    ],
    [
        'host' => 'ssl0.ovh.net',
        'port' => 465,
        'encryption' => 'ssl',
        'user' => 'email_confirmation_accountcreate@luccibyey.com.tn',
        'pass' => '',
    ],
    [
        'host' => 'ssl0.ovh.net',
        'port' => 465,
        'encryption' => 'ssl',
        'user' => '',
        'pass' => '',
    ],
    [
        'host' => 'ssl0.ovh.net',
        'port' => 465,
        'encryption' => 'ssl',
        'user' => '',
        'pass' => '',
    ],
    [
        'host' => 'ssl0.ovh.net',
        'port' => 465,
        'encryption' => 'ssl',
        'user' => '',
        'pass' => '',
    ],
]);

/** Password reset token lifetime (seconds). */
define('PASSWORD_RESET_TOKEN_TTL', 3600);

// Logging
define('LOG_DIR', __DIR__ . '/logs');
define('LOG_LEVEL', 'info'); // debug, info, warning, error

// Permissions
define('ROLES', ['admin', 'manager', 'user', 'super_admin']);
define('PERMISSIONS', [
    'view' => 1,
    'create' => 2,
    'edit' => 4,
    'delete' => 8,
    'publish' => 16
]);

// Development/bootstrapping mode:
// Some hosts/proxies strip `Authorization` headers before PHP sees them,
// causing admin routes to constantly fail with "Missing token".
// If you can properly pass tokens, set this back to false.
define('ADMIN_NO_AUTH', true);

/**
 * Admin bootstrap key for creating admin accounts via the internal setup UI/API.
 * This is intentionally hardcoded (no .env support in this project) so the feature
 * works immediately; change it before deploying to public environments.
 */
define('ADMIN_SETUP_KEY', 'remquip_admin_setup_default');

// Cache Configuration
define('CACHE_ENABLED', true);
define('CACHE_TTL', 3600); // 1 hour

// Pagination defaults per resource
define('PAGINATION_DEFAULTS', [
    'products' => 20,
    'orders' => 10,
    'customers' => 15,
    'users' => 10,
    'inventory' => 25
]);

// Product pricing tiers
define('CUSTOMER_TYPES', [
    'retail' => ['discount' => 0, 'name' => 'Retail'],
    'wholesale' => ['discount' => 10, 'name' => 'Wholesale'],
    'fleet' => ['discount' => 15, 'name' => 'Fleet'],
    'distributor' => ['discount' => 20, 'name' => 'Distributor']
]);

// Status enums
define('USER_STATUS', ['active', 'inactive', 'suspended']);
define('ORDER_STATUS', ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded']);
define('PRODUCT_STATUS', ['active', 'draft', 'archived']);
define('INVENTORY_STATUS', ['in_stock', 'low_stock', 'out_of_stock']);

// Enable/Disable features
define('FEATURE_ANALYTICS', true);
define('FEATURE_CMS', true);
define('FEATURE_DISCOUNTS', true);
define('FEATURE_INVENTORY_TRACKING', true);
define('FEATURE_CUSTOMER_NOTES', true);
define('FEATURE_MULTI_CURRENCY', false);

// Development mode (set true locally to expose DB errors in API responses)
define('DEBUG_MODE', false);

// =====================================================================
// QuickBooks Online — hardcoded sandbox/development credentials.
// Replace with production keys (and set QBO_ENVIRONMENT='production') when
// the client is ready to go live. These act as fallbacks if the per-row
// credentials in remquip_integrations are empty.
// =====================================================================
define('QBO_CLIENT_ID',     'ABu4rCgJ9IhmhruNyaMV4JoshxKaeqrU78qJN4CpuQW5duPFAZ');
define('QBO_CLIENT_SECRET', 'NOejDR9doxKiyi4IK8l4RrjSkGv6qyhCrTbZkjQX');
define('QBO_ENVIRONMENT',   'sandbox'); // 'sandbox' | 'production'
define('QBO_REDIRECT_URI',  FRONTEND_URL . '/admin/integrations/oauth/quickbooks');
define('QBO_WEBHOOK_VERIFIER_TOKEN', ''); // paste from Intuit → Webhooks once configured

// Stripe Payment Gateway (TEST keys — replace before production)
define('STRIPE_SECRET_KEY',      'sk_test_51TEVPS2Rz0p3EiIySnjzWG7Pcb1MGiiHTogMWBdh5iHA55YXgb851ndfMyRZTmkcCEiEKpdFR6NEVkdTIyE9R7Z500Z5Wmt7La');
define('STRIPE_PUBLISHABLE_KEY', 'pk_test_51TEVPS2Rz0p3EiIyZbOjZ3dUdtoQUt0adBMXcntWYZzcG0A7vGdGE5KNCxOoH3oquGN1ClqUTltPMmCAY0e4InWn00eVZeWtdK');
define('STRIPE_WEBHOOK_SECRET',  'whsec_nTdDxe2a9GwiDyUqh8vssAdNpmpKtxmW');  // Set from Stripe Dashboard → Webhooks

// Ensure upload directory exists
if (!is_dir(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}

// Ensure log directory exists
if (!is_dir(LOG_DIR)) {
    @mkdir(LOG_DIR, 0755, true);
}

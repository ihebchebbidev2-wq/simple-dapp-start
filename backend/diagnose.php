<?php
/**
 * REMQUIP Backend Diagnostic Script
 * Upload this file to /remquip/backend/ and visit it in the browser.
 * It checks PHP version, required extensions, DB connectivity, and file permissions.
 * DELETE THIS FILE after diagnosing.
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$results = [];

// 1. PHP Version
$results['php_version'] = PHP_VERSION;
$results['php_version_ok'] = version_compare(PHP_VERSION, '7.4.0', '>=');

// 2. Required Extensions
$required_extensions = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl', 'curl'];
$results['extensions'] = [];
foreach ($required_extensions as $ext) {
    $results['extensions'][$ext] = extension_loaded($ext);
}

// 3. File Permissions
$files_to_check = [
    'config.php',
    'bootstrap.php',
    'database.php',
    'helpers.php',
    'cors.php',
    'router.php',
    'remquip-api.php',
    'health.php',
];
$results['files'] = [];
foreach ($files_to_check as $f) {
    $path = __DIR__ . '/' . $f;
    $results['files'][$f] = [
        'exists' => file_exists($path),
        'readable' => is_readable($path),
        'size' => file_exists($path) ? filesize($path) : 0,
    ];
}

// 4. Upload/Log directory writability
$results['directories'] = [
    'uploads' => [
        'exists' => is_dir(__DIR__ . '/uploads'),
        'writable' => is_writable(__DIR__ . '/uploads'),
    ],
    'logs' => [
        'exists' => is_dir(__DIR__ . '/logs'),
        'writable' => is_writable(__DIR__ . '/logs'),
    ],
];

// 5. Try loading config
$results['config_loads'] = false;
try {
    require_once __DIR__ . '/config.php';
    $results['config_loads'] = true;
    $results['db_host'] = DB_HOST;
    $results['db_name'] = DB_NAME;
} catch (Throwable $e) {
    $results['config_error'] = $e->getMessage();
}

// 6. Database connectivity test
$results['db_connected'] = false;
if ($results['config_loads']) {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $results['db_connected'] = true;

        // Check key tables exist
        $tables_to_check = [
            'remquip_users',
            'remquip_products',
            'remquip_orders',
            'remquip_customers',
            'remquip_categories',
            'remquip_order_items',
            'remquip_order_installments',
            'settings',
        ];
        $results['tables'] = [];
        foreach ($tables_to_check as $table) {
            try {
                $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `$table`");
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $results['tables'][$table] = ['exists' => true, 'rows' => (int)$row['cnt']];
            } catch (Throwable $e) {
                $results['tables'][$table] = ['exists' => false, 'error' => $e->getMessage()];
            }
        }
    } catch (Throwable $e) {
        $results['db_error'] = $e->getMessage();
    }
}

// 7. Try loading helpers (class definitions)
$results['helpers_load'] = false;
try {
    require_once __DIR__ . '/helpers.php';
    $results['helpers_load'] = true;
    $results['class_exists'] = [
        'ResponseHelper' => class_exists('ResponseHelper'),
        'Auth' => class_exists('Auth'),
        'Logger' => class_exists('Logger'),
        'Validator' => class_exists('Validator'),
    ];
} catch (Throwable $e) {
    $results['helpers_error'] = $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine();
}

// 8. .htaccess check
$results['htaccess_exists'] = file_exists(__DIR__ . '/.htaccess');
$results['htaccess_readable'] = is_readable(__DIR__ . '/.htaccess');

// 9. PHP error log check
$results['error_log_path'] = ini_get('error_log');
$results['display_errors'] = ini_get('display_errors');
$results['memory_limit'] = ini_get('memory_limit');
$results['max_execution_time'] = ini_get('max_execution_time');
$results['post_max_size'] = ini_get('post_max_size');
$results['upload_max_filesize'] = ini_get('upload_max_filesize');

// 10. Check if mod_rewrite is active (Apache only)
$results['server_software'] = $_SERVER['SERVER_SOFTWARE'] ?? 'unknown';
$results['document_root'] = $_SERVER['DOCUMENT_ROOT'] ?? 'unknown';
$results['script_filename'] = $_SERVER['SCRIPT_FILENAME'] ?? 'unknown';

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

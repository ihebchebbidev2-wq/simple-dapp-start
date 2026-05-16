<?php
/**
 * Shared API bootstrap — used by index.php, api.php, and thin *.php entry scripts.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('log_errors_max_len', 1024);

function remquip_api_bootstrap(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    require_once __DIR__ . '/cors.php';

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        header('Content-Length: 0', true);
        exit;
    }

    header('Content-Type: application/json; charset=UTF-8');

    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/database.php';
    require_once __DIR__ . '/helpers.php';

    Logger::init();
}

/**
 * @return array{0: Database, 1: Database}
 */
function remquip_require_db(): array
{
    $db = new Database();
    $db->getConnection();
    if (!$db->conn) {
        ResponseHelper::sendError('Database connection failed', 500);
    }

    return [$db, $db];
}

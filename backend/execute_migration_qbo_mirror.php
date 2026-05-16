<?php
/**
 * Run the QuickBooks mirror tables migration.
 * Usage: open in a browser as an admin → backend/execute_migration_qbo_mirror.php
 *        OR  php backend/execute_migration_qbo_mirror.php
 */
require_once __DIR__ . '/bootstrap.php';

list(, $conn) = remquip_require_db();

$sqlPath = __DIR__ . '/migrations/migrate-qbo-mirror-tables.sql';
if (!file_exists($sqlPath)) {
    http_response_code(500);
    echo "Migration file missing: $sqlPath\n";
    exit;
}

$sql = file_get_contents($sqlPath);

// Split on semicolons that end statements (naive but works for this file)
$statements = array_filter(array_map('trim', preg_split('/;\s*\n/', $sql)));

$results = [];
foreach ($statements as $stmt) {
    if ($stmt === '' || str_starts_with($stmt, '--')) continue;
    try {
        $conn->execute(rtrim($stmt, "; \n\r\t"));
        $results[] = ['ok' => true,  'sql' => substr($stmt, 0, 80) . '…'];
    } catch (Throwable $e) {
        // ALTER ... ADD COLUMN IF NOT EXISTS isn't supported on every MySQL
        // version — fall back to silently swallowing "duplicate column"
        $msg = $e->getMessage();
        $isDup = stripos($msg, 'Duplicate column') !== false
              || stripos($msg, 'Duplicate key name') !== false
              || stripos($msg, 'already exists') !== false;
        $results[] = [
            'ok' => $isDup,
            'sql' => substr($stmt, 0, 80) . '…',
            'error' => $msg,
        ];
    }
}

header('Content-Type: application/json');
echo json_encode(['migration' => 'qbo-mirror-tables', 'results' => $results], JSON_PRETTY_PRINT);

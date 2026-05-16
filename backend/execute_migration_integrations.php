<?php
/**
 * One-shot runner for the integrations migration.
 * Visit: /backend/execute_migration_integrations.php
 */
require_once __DIR__ . '/bootstrap.php';
remquip_api_bootstrap();

try {
    $sql = file_get_contents(__DIR__ . '/migrations/migrate-integrations.sql');
    if (!$sql) {
        ResponseHelper::sendError('Migration file not found', 500);
    }
    list(, $conn) = remquip_require_db();

    // Split on semicolons that end a line (simple but effective for this file)
    $statements = array_filter(array_map('trim', preg_split('/;\s*\n/', $sql)));
    $executed = 0;
    foreach ($statements as $stmt) {
        if ($stmt === '' || strpos($stmt, '--') === 0) continue;
        $conn->execute($stmt);
        $executed++;
    }
    ResponseHelper::sendSuccess(['statements' => $executed], 'Integrations migration applied');
} catch (Exception $e) {
    ResponseHelper::sendError('Migration failed: ' . $e->getMessage(), 500);
}

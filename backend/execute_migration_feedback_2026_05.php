<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    if (!$conn) {
        die("Connection failed\n");
    }

    $sqlFile = __DIR__ . '/migrations/feedback-2026-05.sql';
    if (!file_exists($sqlFile)) {
        die("Migration file not found: $sqlFile\n");
    }

    // Run statement-by-statement so partial application still surfaces a useful
    // error instead of failing the whole file.
    $sql = file_get_contents($sqlFile);
    // crude split on `;` at line ends (no DELIMITER blocks in this file)
    $statements = array_filter(array_map('trim', preg_split('/;\s*\n/', $sql)), function ($s) {
        return $s !== '' && strpos(ltrim($s), '--') !== 0;
    });

    foreach ($statements as $stmt) {
        try {
            $conn->exec($stmt);
        } catch (Exception $e) {
            // MySQL throws on ADD COLUMN IF NOT EXISTS on older versions; log and continue
            echo "warn: " . $e->getMessage() . "\n";
        }
    }

    echo "Migration 'feedback-2026-05.sql' executed.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

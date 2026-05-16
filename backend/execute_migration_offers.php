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

    $sqlFile = __DIR__ . '/migrations/migrate-offers.sql';
    if (!file_exists($sqlFile)) {
        die("Migration file not found: $sqlFile\n");
    }

    $sql = file_get_contents($sqlFile);
    
    // Split statements if needed or just execute raw
    $conn->exec($sql);
    
    echo "Migration executed successfully!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

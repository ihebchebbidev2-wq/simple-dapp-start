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

    $sqlFile = __DIR__ . '/migrations/migrate-signature-pdf.sql';
    if (!file_exists($sqlFile)) {
        die("Migration file not found: $sqlFile\n");
    }

    $sql = file_get_contents($sqlFile);
    
    // Execute raw SQL
    $conn->exec($sql);
    
    echo "Migration 'migrate-signature-pdf.sql' executed successfully!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

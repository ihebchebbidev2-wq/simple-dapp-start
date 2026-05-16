<?php
require_once __DIR__ . '/Backend/database.php';
require_once __DIR__ . '/Backend/helpers.php';

$db = Database::getInstance();

try {
    echo "--- Products Sample ---\n";
    $products = $db->fetchAll("SELECT id, sku, name, is_active, deleted_at FROM remquip_products LIMIT 10");
    foreach ($products as $p) {
        echo "ID: {$p['id']} | SKU: {$p['sku']} | Name: {$p['name']} | Active: {$p['is_active']} | Deleted: " . ($p['deleted_at'] ?? 'No') . "\n";
    }

    echo "\n--- Categories Sample ---\n";
    $categories = $db->fetchAll("SELECT id, name, slug, is_active FROM remquip_categories LIMIT 5");
    foreach ($categories as $c) {
        echo "ID: {$c['id']} | Name: {$c['name']} | Slug: {$c['slug']} | Active: {$c['is_active']}\n";
    }

    $targetId = '50000001-0000-4000-8000-000000000002';
    echo "\n--- Searching for Target ID: $targetId ---\n";
    $found = $db->fetch("SELECT * FROM remquip_products WHERE id = :id", ['id' => $targetId]);
    if ($found) {
        echo "FOUND: " . json_encode($found) . "\n";
    } else {
        echo "NOT FOUND by ID. Checking SKU and Slug...\n";
        $foundSku = $db->fetch("SELECT id FROM remquip_products WHERE sku = :id", ['id' => $targetId]);
        if ($foundSku) echo "FOUND by SKU\n";
    }

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

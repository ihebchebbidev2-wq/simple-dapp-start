<?php
/**
 * MIGRATION: Standardize product image paths to /Backend/uploads/products_images/
 */

require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../config.php';

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    die("Database connection failed\n");
}

$oldDirs = ['images', 'product_images'];
$newDirName = 'products_images';
$baseUploadDir = UPLOAD_DIR;
$targetDir = $baseUploadDir . '/' . $newDirName;

echo "Starting migration to $targetDir...\n";

// 1. Create target directory if it doesn't exist
if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
        die("Failed to create target directory: $targetDir\n");
    }
    echo "Created directory: $targetDir\n";
}

// 2. Move files from old directories
foreach ($oldDirs as $old) {
    $src = $baseUploadDir . '/' . $old;
    if (is_dir($src) && $src !== $targetDir) {
        echo "Moving files from $src to $targetDir...\n";
        $files = scandir($src);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            
            $oldPath = $src . '/' . $file;
            $newPath = $targetDir . '/' . $file;
            
            if (file_exists($newPath)) {
                echo "Warning: File $file already exists in target. Skipping move from $old.\n";
            } else {
                if (rename($oldPath, $newPath)) {
                    echo "Moved: $file\n";
                } else {
                    echo "Error moving: $file\n";
                }
            }
        }
    }
}

// 3. Update database records
echo "Updating database records...\n";
$updates = [
    '/Backend/uploads/images/' => '/Backend/uploads/products_images/',
    '/Backend/uploads/product_images/' => '/Backend/uploads/products_images/',
    '/uploads/product_images/' => '/Backend/uploads/products_images/',
    '/uploads/images/' => '/Backend/uploads/products_images/'
];

$tablesWithImageUrl = [
    'remquip_product_images' => 'image_url',
    'remquip_categories' => 'image_url',
    'remquip_banners' => 'image_url'
];

foreach ($tablesWithImageUrl as $table => $column) {
    echo "Updating $table...\n";
    foreach ($updates as $oldPath => $newPath) {
        $stmt = $conn->prepare("UPDATE $table SET $column = REPLACE($column, :old, :new) WHERE $column LIKE :match");
        $stmt->execute([
            'old' => $oldPath,
            'new' => $newPath,
            'match' => '%' . $oldPath . '%'
        ]);
        echo "Updated " . $stmt->rowCount() . " rows in $table for $oldPath\n";
    }
}

// 4. Update JSON content in CMS tables
$cmsTables = [
    'remquip_cms_pages' => 'content',
    'remquip_cms_page_translations' => 'content'
];

foreach ($cmsTables as $table => $column) {
    echo "Updating $table $column...\n";
    $rows = $conn->fetchAll("SELECT id, $column FROM $table WHERE $column LIKE '%/uploads/%'");
    foreach ($rows as $row) {
        if (empty($row[$column])) continue;
        
        $newContent = $row[$column];
        foreach ($updates as $oldPath => $newPath) {
            $newContent = str_replace($oldPath, $newPath, $newContent);
        }
        
        if ($newContent !== $row[$column]) {
            $stmt = $conn->prepare("UPDATE $table SET $column = :content, updated_at = NOW() WHERE id = :id");
            $stmt->execute(['content' => $newContent, 'id' => $row['id']]);
            echo "Updated content for $table: " . $row['id'] . "\n";
        }
    }
}

echo "Migration completed successfully.\n";

<?php
/**
 * BIGCOMMERCE PRODUCT MIGRATION SCRIPT
 * This script wipes existing products and replaces them with data from products_import.xml
 */

require_once __DIR__ . '/bootstrap.php';
remquip_api_bootstrap();
list($db) = remquip_require_db();

echo "Starting migration...\n";

try {
    // 1. Load XML
    $xmlPath = __DIR__ . '/products_import.xml';
    if (!file_exists($xmlPath)) {
        die("Error: products_import.xml not found.\n");
    }

    $xml = simplexml_load_file($xmlPath, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$xml) {
        die("Error: Failed to parse XML.\n");
    }

    // 2. Clear existing data
    echo "Clearing existing product data...\n";
    $db->execute("DELETE FROM remquip_inventory");
    $db->execute("DELETE FROM remquip_product_images");
    $db->execute("DELETE FROM remquip_product_variants");
    $db->execute("DELETE FROM remquip_products");
    // We keep categories but we'll add new ones as found
    
    $productCount = 0;
    
    foreach ($xml->product as $p) {
        $bcId = trim((string)$p->Product_ID);
        $sku = trim((string)$p->Code);
        if (empty($sku)) {
            $sku = "BC-" . $bcId;
        }
        
        $name = trim((string)$p->Name);
        $description = trim((string)$p->Description);
        $basePrice = (float)$p->Calculated_Price;
        $costPrice = (float)$p->Cost_Price;
        $stock = (int)$p->Stock_Level;
        
        // Find deep category
        $categoryId = null;
        $categoryName = "Uncategorized";
        
        if (isset($p->Category_Details->item)) {
            $deepest = null;
            $maxLen = -1;
            foreach ($p->Category_Details->item as $catItem) {
                $path = (string)$catItem->Category_Path;
                if (strlen($path) > $maxLen) {
                    $maxLen = strlen($path);
                    $deepest = $catItem;
                }
            }
            if ($deepest) {
                $categoryName = trim((string)$deepest->Category_Name);
            }
        }
        
        // Find or create category
        $cat = $db->fetch("SELECT id FROM remquip_categories WHERE name = :name", ['name' => $categoryName]);
        if ($cat) {
            $categoryId = $cat['id'];
        } else {
            $categoryId = $db->fetch('SELECT UUID() AS u')['u'];
            $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $categoryName), '-'));
            $db->execute(
                "INSERT INTO remquip_categories (id, name, slug, is_active) VALUES (:id, :name, :slug, 1)",
                ['id' => $categoryId, 'name' => $categoryName, 'slug' => $slug]
            );
            echo "Created category: $categoryName\n";
        }
        
        // Insert Product
        $productId = $db->fetch('SELECT UUID() AS u')['u'];
        $db->execute(
            "INSERT INTO remquip_products (id, sku, name, category_id, description, base_price, cost_price, is_active, created_at)
             VALUES (:id, :sku, :name, :catId, :desc, :price, :cost, 1, NOW())",
            [
                'id' => $productId,
                'sku' => $sku,
                'name' => $name,
                'catId' => $categoryId,
                'desc' => $description,
                'price' => $basePrice,
                'cost' => $costPrice
            ]
        );
        
        // Insert Inventory
        $db->execute(
            "INSERT INTO remquip_inventory (product_id, quantity_on_hand, quantity_available)
             VALUES (:pid, :qty, :qty)",
            ['pid' => $productId, 'qty' => $stock]
        );
        
        // Insert Images
        if (isset($p->Images->item)) {
            $isPrimary = 1;
            $order = 0;
            foreach ($p->Images->item as $imgItem) {
                $imgUrl = trim((string)$imgItem->Image_URL);
                if (empty($imgUrl)) continue;
                
                $imgId = $db->fetch('SELECT UUID() AS u')['u'];
                $db->execute(
                    "INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order)
                     VALUES (:id, :pid, :url, :primary, :order)",
                    [
                        'id' => $imgId,
                        'pid' => $productId,
                        'url' => $imgUrl,
                        'primary' => $isPrimary,
                        'order' => $order
                    ]
                );
                $isPrimary = 0; // Only first one is primary
                $order++;
            }
        }
        
        $productCount++;
        echo "Imported product: $sku - $name\n";
    }
    
    echo "\nMigration completed successfully. Imported $productCount products.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

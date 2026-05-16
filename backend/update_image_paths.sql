-- UPDATE IMAGE PATHS TO STANDARDIZED products_images
-- This script UPDATES existing records without deleting any data.

-- 1. Update primary image tables
UPDATE remquip_product_images 
SET image_url = REPLACE(REPLACE(REPLACE(REPLACE(image_url, 
    '/Backend/uploads/images/', '/Backend/uploads/products_images/'),
    '/Backend/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/images/', '/Backend/uploads/products_images/');

UPDATE remquip_categories 
SET image_url = REPLACE(REPLACE(REPLACE(REPLACE(image_url, 
    '/Backend/uploads/images/', '/Backend/uploads/products_images/'),
    '/Backend/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/images/', '/Backend/uploads/products_images/');

UPDATE remquip_banners 
SET image_url = REPLACE(REPLACE(REPLACE(REPLACE(image_url, 
    '/Backend/uploads/images/', '/Backend/uploads/products_images/'),
    '/Backend/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/images/', '/Backend/uploads/products_images/');

-- 2. Update CMS content (nested JSON strings)
UPDATE remquip_cms_pages 
SET content = REPLACE(REPLACE(REPLACE(REPLACE(content, 
    '/Backend/uploads/images/', '/Backend/uploads/products_images/'),
    '/Backend/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/images/', '/Backend/uploads/products_images/')
WHERE content LIKE '%/uploads/%';

UPDATE remquip_cms_page_translations 
SET content = REPLACE(REPLACE(REPLACE(REPLACE(content, 
    '/Backend/uploads/images/', '/Backend/uploads/products_images/'),
    '/Backend/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/product_images/', '/Backend/uploads/products_images/'),
    '/uploads/images/', '/Backend/uploads/products_images/')
WHERE content LIKE '%/uploads/%';

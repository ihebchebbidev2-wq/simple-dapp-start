-- REMQUIP PRODUCT DATA MIGRATION
-- Direct SQL script to replace all product and category data.
-- IMAGE URLs POINT TO: /Backend/uploads/products_images/

SET FOREIGN_KEY_CHECKS = 0;

-- 1. CLEANUP (WARNING: This wipes existing data)
DELETE FROM remquip_product_variants;
DELETE FROM remquip_inventory;
DELETE FROM remquip_product_images;
DELETE FROM remquip_products;
DELETE FROM remquip_categories;
DELETE FROM remquip_category_translations;

-- 2. CATEGORIES
INSERT INTO remquip_categories (id, name, slug, description, image_url, display_order, is_active, created_at) VALUES
('b1000001-0000-4000-8000-000000000001', 'Air Brakes', 'air-brakes', 'Heavy-duty air brake systems and components', NULL, 1, 1, NOW()),
('b1000001-0000-4000-8000-000000000002', 'Wheel End', 'wheel-end', 'Hubs, bearings, and seals', NULL, 2, 1, NOW()),
('b1000001-0000-4000-8000-000000000003', 'Brake Pads', 'brake-pads', 'Air disc brake pads', NULL, 1, 1, NOW()),
('b1000001-0000-4000-8000-000000000004', 'Brake Drums', 'brake-drums', 'Heavy-duty cast brake drums', NULL, 2, 1, NOW()),
('b1000001-0000-4000-8000-000000000006', 'Suspension', 'suspension', 'Air springs and suspension components', NULL, 3, 1, NOW()),
('b1000001-0000-4000-8000-000000000007', 'Brake Chambers', 'brake-chambers', 'Spring and service brake chambers', NULL, 3, 1, NOW()),
('b1000001-0000-4000-8000-000000000008', 'Brake Hardware', 'brake-hardware', 'Brake shoe and pad hardware kits', NULL, 4, 1, NOW()),
('b1000001-0000-4000-8000-000000000009', 'Brake Shoes', 'brake-shoes', 'New and relined brake shoe kits', NULL, 5, 1, NOW());

INSERT INTO remquip_category_translations (category_id, locale, name, description) VALUES
('b1000001-0000-4000-8000-000000000001', 'en', 'Air Brakes', 'Heavy-duty air brake systems and components'),
('b1000001-0000-4000-8000-000000000002', 'en', 'Wheel End', 'Hubs, bearings, and seals'),
('b1000001-0000-4000-8000-000000000003', 'en', 'Brake Pads', 'Air disc brake pads'),
('b1000001-0000-4000-8000-000000000004', 'en', 'Brake Drums', 'Heavy-duty cast brake drums'),
('b1000001-0000-4000-8000-000000000006', 'en', 'Suspension', 'Air springs and suspension components'),
('b1000001-0000-4000-8000-000000000007', 'en', 'Brake Chambers', 'Spring and service brake chambers'),
('b1000001-0000-4000-8000-000000000008', 'en', 'Brake Hardware', 'Brake shoe and pad hardware kits'),
('b1000001-0000-4000-8000-000000000009', 'en', 'Brake Shoes', 'New and relined brake shoe kits');

-- 3. PRODUCTS & INVENTORY & IMAGES
-- 81: ADB22X Air Disc Brake Pad Kit
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p8100000-0000-4000-8000-000000000081', 'BC-81', 'ADB22X Air Disc Brake Pad Kit', 'b1000001-0000-4000-8000-000000000003', 'Air disc brake pad kit for ADB22X calipers. Includes pads and hardware for one axle. Designed for quiet operation, low rotor wear and long pad life in demanding fleets. Specifications:o System: ADB22Xo Kit contents: 4 pads + hardwareo Friction: Copper-free, high-carbon formula', '{}', 69.29, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p8100000-0000-4000-8000-000000000081', 80);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES ('i8100000-0000-4000-8000-000000000081', 'p8100000-0000-4000-8000-000000000081', '/Backend/uploads/products_images/ADB22X_DISC_BRAKE_PAD___82450.png', 1, 0);

-- 86: Brake Drum – Gunite 3600A Equivalent – 16.5" x 7"
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p8600000-0000-4000-8000-000000000086', 'Gunite 3600A', 'Brake Drum – Gunite 3600A Equivalent – 16.5" x 7"', 'b1000001-0000-4000-8000-000000000004', 'Heavy-duty cast brake drum equivalent to Gunite 3600A / 3600AX for 16.5\" x 7\" drum brake systems. Designed for excellent heat dissipation and uniform wear on highway tractors and trailers. Specifications:o Drum diameter: 16.5\"o Drum width: 7\"o Mounting: Outboardo Application: Standard trailer/tractor axles', '{}', 100.17, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p8600000-0000-4000-8000-000000000086', 100);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i8600000-0000-4000-8000-000000000086', 'p8600000-0000-4000-8000-000000000086', '/Backend/uploads/products_images/BRAKE_DRUM___49683.png', 1, 0),
('i8600000-0000-4000-8000-000000000087', 'p8600000-0000-4000-8000-000000000086', '/Backend/uploads/products_images/BRAKE_DRUM__69496.png', 0, 1);

-- 88: Air Spring W01-358-9781 – 1T15ZR-6 / 1R12-603
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p8800000-0000-4000-8000-000000000088', '9781CAL', 'Air Spring W01-358-9781 – 1T15ZR-6 / 1R12-603', 'b1000001-0000-4000-8000-000000000006', 'The W01-358-9781 air spring is a rolling-lobe suspension air bag used on many Freightliner and trailer suspensions. Built with a heavy-duty 1T15ZR-6 style bellows, 9\" top plate and 10.6\" piston, it delivers stable ride height, excellent load support and long service life in harsh Canadian conditions. Ideal for on-highway tractors and air-ride trailers seeking OEM-level performance at an aftermarket price. Specifications:o Firestone number: W01-358-9781o Bellows: 1T15ZR-6 (or 1T15 X-Series replacement)o Type: Rolling lobe air springo Extended height: 23.0 in (approx. 584 mm)o Compressed height: 8.75 in (222 mm)o Top plate diameter: 9.0 in (229 mm)o Piston width: ≈10.6 in (270 mm)o Typical weight: ~13.2 lb (6.0 kg)', '{}', 98.40, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p8800000-0000-4000-8000-000000000088', 101);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i8800000-0000-4000-8000-000000000088', 'p8800000-0000-4000-8000-000000000088', '/Backend/uploads/products_images/AIR_SPRING_9781_1__34873.png', 1, 0),
('i8800000-0000-4000-8000-000000000089', 'p8800000-0000-4000-8000-000000000088', '/Backend/uploads/products_images/AIR_SPRING_9781__22344.png', 0, 1),
('i8800000-0000-4000-8000-000000000090', 'p8800000-0000-4000-8000-000000000088', '/Backend/uploads/products_images/AIR_SPRING_9781___93802.png', 0, 2),
('i8800000-0000-4000-8000-000000000091', 'p8800000-0000-4000-8000-000000000088', '/Backend/uploads/products_images/AIRSPRING_9781.___41719.png', 0, 3);

-- 93: 30/30 Long Stroke Brake Chamber
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p9300000-0000-4000-8000-000000000093', '179.SB3030SLW1100', '30/30 Long Stroke Brake Chamber – 179.SB3030SLW1100', 'b1000001-0000-4000-8000-000000000007', 'Robust 30/30 long-stroke spring brake chamber with extended push rod configuration for drive and trailer axles. Part of the same interchange family as most popular NT3030 and GC3030 long-stroke units.', '{}', 49.18, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p9300000-0000-4000-8000-000000000093', 286);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i9300000-0000-4000-8000-000000000093', 'p9300000-0000-4000-8000-000000000093', '/Backend/uploads/products_images/179.SB3030SLW1100___98384.png', 1, 0),
('i9300000-0000-4000-8000-000000000094', 'p9300000-0000-4000-8000-000000000093', '/Backend/uploads/products_images/179.SB3030SLW1100.___34930.png', 0, 1),
('i9300000-0000-4000-8000-000000000095', 'p9300000-0000-4000-8000-000000000093', '/Backend/uploads/products_images/179.SB3030SLW1100__41746.png', 0, 2);

-- 94: 30/30 Short Stroke Brake Chamber
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p9400000-0000-4000-8000-000000000094', '30/30 Short Stroke', '30/30 Short Stroke Brake Chamber – Standard Type', 'b1000001-0000-4000-8000-000000000007', 'Standard type 30/30 spring brake chamber used on many tractors and trailers. Ideal replacement for fleets using short-stroke chambers. Specifications:o Type: 30/30o Stroke: Standard (short stroke)o Ports: 3/8\" NPTo Mount: Clamp bando Application: Drive & trailer axles', '{}', 48.08, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p9400000-0000-4000-8000-000000000094', 116);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i9400000-0000-4000-8000-000000000094', 'p9400000-0000-4000-8000-000000000094', '/Backend/uploads/products_images/BRAKE_CHAMBER_3O_30_SHORT_STROKE._png__82832.png', 1, 0),
('i9400000-0000-4000-8000-000000000095', 'p9400000-0000-4000-8000-000000000094', '/Backend/uploads/products_images/BRAKE_CHAMBER_3O_30_SHORT_STROKE__32235.png', 0, 1);

-- 97: 30/30 Long Stroke Brake Chamber CLEVIS
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p9700000-0000-4000-8000-000000000097', '179.SB3030SLW225', '30/30 Long Stroke Brake Chamber – 179.SB3030SLW225', 'b1000001-0000-4000-8000-000000000007', 'Type 30/30 long-stroke spring brake chamber with welded clevis for drive and trailer axles. Provides greater stroke for improved brake adjustment range and safer brake performance on drive and trailer. Specifications:o Type: 30/30 spring brakeo Stroke: Long strokeo Push rod length: 2.25\" (225 mm)o Ports: Standard 3/8\" NPTo Mount: Welded cleviso Application: Truck and trailer air brake chambers', '{}', 49.18, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p9700000-0000-4000-8000-000000000097', 100);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i9700000-0000-4000-8000-000000000097', 'p9700000-0000-4000-8000-000000000097', '/Backend/uploads/products_images/179SB3030SLW225.__45538.png', 1, 0),
('i9700000-0000-4000-8000-000000000098', 'p9700000-0000-4000-8000-000000000097', '/Backend/uploads/products_images/179SB3030SLW225__54936.png', 0, 1);

-- 103: 4707Q / 4515Q Hardware Kit
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p1030000-0000-4000-8000-000000000103', 'HW 4707/4515', '4707Q / 4515Q - Hardware Kit', 'b1000001-0000-4000-8000-000000000008', 'Complete drum brake hardware kit for 4707Q and 4515Q shoes. Includes return springs, rollers, anchor pins and retainers required for a professional brake rebuild. Specifications:Meritor: MKT4515Q-N, hardware kits paired with SEG/XSEG4515Q and 4707Q setsTRP / Haldex equivalentsAutomann : 100.4707QKIT / 100.4515QKIT', '{}', 22.79, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p1030000-0000-4000-8000-000000000103', 50);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES ('i1030000-0000-4000-8000-000000000103', 'p1030000-0000-4000-8000-000000000103', '/Backend/uploads/products_images/4515_4707_HARDWARE_KIT__66462.png', 1, 0);

-- 104: 4709Q Brake Shoe Assembly Kit
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p1040000-0000-4000-8000-000000000104', '4709Q', '4709Q Brake Shoe Assembly Kit – Eaton ES / ESII 16.5\" x 7\"', 'b1000001-0000-4000-8000-000000000009', 'New 4709Q brake shoe assemblies for Eaton Extended Service (ES/ESII) drum brakes. Designed to match OEM geometry and contact area for stable braking, reduced taper wear and extend lining life.   Specifications: o Brake size: 16.5\" x 7\"Fixes o System: Eaton ES / ESII o FMSI: 4709 o Application: Truck & trailer axles with ES/ES2 drums o Lining: High-performance ES2 frictiono Condition: NEW.', '{}', 65.07, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p1040000-0000-4000-8000-000000000104', 100);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i1040000-0000-4000-8000-000000000104', 'p1040000-0000-4000-8000-000000000104', '/Backend/uploads/products_images/4709Q_BRAKE_SHOE_KIT__79376.png', 1, 0),
('i1040000-0000-4000-8000-000000000105', 'p1040000-0000-4000-8000-000000000104', '/Backend/uploads/products_images/4709_BRAKE_SHOE_KITT__48903.png', 0, 1);

-- 107: 4515Q - Brake Shoe Assembly Kit (new)
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p1070000-0000-4000-8000-000000000107', '4515Q', '4515Q - Brake Shoe Assembly Kit (new) - 16.5\" x 7\"', 'b1000001-0000-4000-8000-000000000009', 'The 4515Q brake shoe assembly set fits standard Meritor-type Q 16.5\" x 7\" brake systems widely used on tractors and trailers. It features premium semi-metallic friction for high heat resistance and long life in regional and long-haul service. Each set supplies two new shoes, pre-lined and ready to install.   Specifications: o Brake size: 16.5\" x 7\"o Shoe series: Q o FMSI: 4515 o Type: Brake Shoe Assembly Loaded (kits) o Lining style: Riveted o Brake diameter: 16.5\" o Brake shoe width: 7\" o GAWR: typical 23K applications o Condition: NEW shoes, no core', '{}', 65.07, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p1070000-0000-4000-8000-000000000107', 150);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES ('i1070000-0000-4000-8000-000000000107', 'p1070000-0000-4000-8000-000000000107', '/Backend/uploads/products_images/4515Q_BRAKE_SHOE_KIT__51358.png', 1, 0);

-- 111: 4707Q - Brake Shoe Kit
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p1110000-0000-4000-8000-000000000111', '4707Q', '4707Q - Brake Shoe Kit', 'b1000001-0000-4000-8000-000000000009', 'New 4707Q brake shoe assembly set for Meritor Q+ 16.5\" x 7\" brakes. Premium high-friction lining, fully riveted, matched shoes. Designed for long-haul, regional and vocational fleets requiring dependable brake performance. Includes two new shoes with premium 23K class friction, ready to install.   Specifications: o Application: rive & trailer axles o Brake type: Q Plus o Brake size: 16.5\"x 7\" o FMSI: 4707Q o GAWR rating: up to 23,000 lb o Lining: Premium 23k friction o Number of shoes: 2 new shoes (assembly/set) o Rivet holes: 28, rivet size 1/4\" o Condition: NEW, no core required', '{}', 65.07, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p1110000-0000-4000-8000-000000000111', 216);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES 
('i1110000-0000-4000-8000-000000000111', 'p1110000-0000-4000-8000-000000000111', '/Backend/uploads/products_images/4707_BRAKE_SHOE_KIT___78127.png', 1, 0),
('i1110000-0000-4000-8000-000000000112', 'p1110000-0000-4000-8000-000000000111', '/Backend/uploads/products_images/4707_BRAKE_SHOE_KIT__26440.png', 0, 1);

-- 112: 4709 - Hardware Kit
INSERT INTO remquip_products (id, sku, name, category_id, description, details, base_price, cost_price, is_active, created_at) VALUES
('p1120000-0000-4000-8000-000000000112', 'HW 4709', '4709 - Hardware Kit', 'b1000001-0000-4000-8000-000000000008', 'Hardware kit dedicated to 4709Q Eshoes, replacing worn springs and retainers to restore OEM braking performance.', '{}', 18.52, 0.00, 1, NOW());
INSERT INTO remquip_inventory (product_id, quantity_on_hand) VALUES ('p1120000-0000-4000-8000-000000000112', 50);
INSERT INTO remquip_product_images (id, product_id, image_url, is_primary, display_order) VALUES ('i1120000-0000-4000-8000-000000000112', 'p1120000-0000-4000-8000-000000000112', '/Backend/uploads/products_images/4709Q_HARDWARE_KIT.___11780.png', 1, 0);

SET FOREIGN_KEY_CHECKS = 1;

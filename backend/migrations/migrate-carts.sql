-- Abandoned carts table (MySQL / luccybcdb)
-- Run once to enable cart tracking and the /carts endpoints.

CREATE TABLE IF NOT EXISTS abandoned_carts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    cart_data   JSON NOT NULL,
    status      ENUM('abandoned', 'recovered', 'completed') NOT NULL DEFAULT 'abandoned',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_abandoned_carts_email  (email),
    INDEX idx_abandoned_carts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- REMQUIP — Live Chat tables
-- =====================================================================

CREATE TABLE IF NOT EXISTS remquip_chat_conversations (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  visitor_name VARCHAR(100) DEFAULT NULL,
  visitor_email VARCHAR(150) DEFAULT NULL,
  language     ENUM('en','fr') NOT NULL DEFAULT 'en',
  status       ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS remquip_chat_messages (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  conversation_id CHAR(36)     NOT NULL,
  sender_type     ENUM('visitor','admin') NOT NULL DEFAULT 'visitor',
  sender_name     VARCHAR(100) DEFAULT NULL,
  message         TEXT         NOT NULL,
  is_predefined   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conv (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES remquip_chat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

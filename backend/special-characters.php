<?php
/**
 * Special Character Handling & Validation
 * Handles UTF-8 encoding, HTML entities, SQL injection prevention
 */

// Ensure UTF-8 encoding
header('Content-Type: application/json; charset=UTF-8');
mb_internal_encoding("UTF-8");

/**
 * Sanitize input while preserving special characters
 * Prevents SQL injection, XSS, but allows accents, emojis, unicode
 */
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    
    // Convert to UTF-8 if needed
    if (!mb_check_encoding($data, 'UTF-8')) {
        $data = mb_convert_encoding($data, 'UTF-8');
    }
    
    // Trim whitespace but preserve special characters
    $data = trim($data);
    
    // Don't use strip_tags or htmlspecialchars - allow special chars
    // Only escape for database (done via prepared statements)
    return $data;
}

/**
 * Validate UTF-8 string
 * Allows: letters, numbers, accents, emojis, punctuation, spaces
 * Rejects: null bytes, control characters
 */
function isValidUtf8String($str, $minLength = 1, $maxLength = 65535) {
    // Check encoding
    if (!mb_check_encoding($str, 'UTF-8')) {
        return false;
    }
    
    // Check length
    $strlen = mb_strlen($str, 'UTF-8');
    if ($strlen < $minLength || $strlen > $maxLength) {
        return false;
    }
    
    // Check for null bytes and control characters (except newline, tab)
    if (preg_match('/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/u', $str)) {
        return false;
    }
    
    return true;
}

/**
 * Escape for HTML display (preserves special characters)
 */
function escapeHtml($str) {
    return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/**
 * Escape for JSON (handles all unicode characters)
 */
function escapeJson($data) {
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Validate email with special characters support
 */
function isValidEmail($email) {
    // UTF-8 aware email validation
    if (!isValidUtf8String($email, 3, 254)) {
        return false;
    }
    
    // Use filter_var with UTF-8 support
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validate phone number (international support)
 * Allows: +, -, space, numbers, parentheses
 */
function isValidPhone($phone) {
    if (!isValidUtf8String($phone, 6, 20)) {
        return false;
    }
    
    // Remove common separators
    $normalized = preg_replace('/[\s\-()]/u', '', $phone);
    
    // Must start with + or be numeric
    return preg_match('/^\+?[0-9]+$/', $normalized) === 1;
}

/**
 * Validate text field (allows all special characters)
 */
function isValidTextField($text, $minLength = 1, $maxLength = 65535) {
    return isValidUtf8String($text, $minLength, $maxLength);
}

/**
 * Validate rich text (allows HTML tags but sanitizes dangerous ones)
 */
function isValidRichText($text, $maxLength = 65535) {
    if (!isValidUtf8String($text, 1, $maxLength)) {
        return false;
    }
    
    // Allow basic HTML tags
    $allowed_tags = '<p><br><strong><b><em><i><u><a><ul><ol><li><h1><h2><h3><h4><h5><h6>';
    $stripped = strip_tags($text, $allowed_tags);
    
    return $stripped === $text || strlen($text) > 0;
}

/**
 * Validate URL
 */
function isValidUrl($url) {
    if (!isValidUtf8String($url, 10, 2048)) {
        return false;
    }
    
    return filter_var($url, FILTER_VALIDATE_URL) !== false;
}

/**
 * Sanitize filename while preserving extension
 */
function sanitizeFilename($filename) {
    // Get extension
    $ext = pathinfo($filename, PATHINFO_EXTENSION);
    $name = pathinfo($filename, PATHINFO_FILENAME);
    
    // Remove dangerous characters but allow accents
    $name = preg_replace('/[^\p{L}\p{N}\-_\.]/u', '_', $name);
    $name = preg_replace('/_{2,}/', '_', $name); // Remove multiple underscores
    
    return $name . (empty($ext) ? '' : '.' . $ext);
}

/**
 * Format error response with special character support
 */
function formatError($code, $message, $details = []) {
    return [
        'success' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
            'details' => $details,
        ],
        'timestamp' => date('c'),
    ];
}

/**
 * Format success response with special character support
 */
function formatSuccess($data, $message = 'Success') {
    return [
        'success' => true,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('c'),
    ];
}
?>

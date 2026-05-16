<?php
/**
 * Quick email test — sends a test email.
 * Usage:
 *   GET https://<domain>/remquip/backend/test_email.php
 *   GET https://<domain>/remquip/backend/test_email.php?to=other@example.com
 *
 * CORS enabled so the admin UI can call it from the Lovable preview.
 */

// ---- CORS (must be first, before any output) ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
header('Access-Control-Allow-Credentials: true');
header('Vary: Origin');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';      // defines Logger (required by RemquipSmtp)
require_once __DIR__ . '/lib/RemquipSmtp.php';
Logger::init();

header('Content-Type: text/plain; charset=utf-8');

$to = isset($_GET['to']) && filter_var($_GET['to'], FILTER_VALIDATE_EMAIL)
    ? $_GET['to']
    : 'erzerino2@gmail.com';

$from    = defined('SMTP_FROM') ? SMTP_FROM : (defined('SMTP_USER') ? SMTP_USER : '');
$subject = 'REMQUIP - Email Test ' . date('Y-m-d H:i:s');
$html    = '<h2>Test Email</h2>'
         . '<p>If you see this, SMTP is working correctly.</p>'
         . '<p>Sent at: ' . date('Y-m-d H:i:s T') . '</p>';

echo "SMTP Config:\n";
echo "  Host: "       . (defined('SMTP_HOST')       ? SMTP_HOST       : '(undef)') . "\n";
echo "  Port: "       . (defined('SMTP_PORT')       ? SMTP_PORT       : '(undef)') . "\n";
echo "  Encryption: " . (defined('SMTP_ENCRYPTION') ? SMTP_ENCRYPTION : '(undef)') . "\n";
echo "  User: "       . (defined('SMTP_USER')       ? SMTP_USER       : '(undef)') . "\n";
echo "  From: "       . $from . "\n";
echo "  To: "         . $to   . "\n\n";

try {
    $result = RemquipSmtp::send($from, $to, $subject, $html);
    echo $result
        ? "✅ Email sent successfully!\n"
        : "❌ Email send returned false. Check server logs for SMTP details.\n";
} catch (Throwable $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}

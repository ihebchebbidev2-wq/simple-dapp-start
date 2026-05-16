<?php
/**
 * Deep SMTP diagnostic — mirrors exactly what remquip_send_customer_mail() does,
 * but prints every SMTP step so we can see WHY sending fails.
 *
 * GET /remquip/backend/smtp_debug.php?to=erzerino2@gmail.com
 */

header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: *');

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/lib/RemquipSmtp.php';

$to = isset($_GET['to']) && filter_var($_GET['to'], FILTER_VALIDATE_EMAIL)
    ? $_GET['to']
    : 'erzerino2@gmail.com';

echo "=== STEP 1: Constants ===\n";
echo "SMTP_HOST       = " . (defined('SMTP_HOST') ? SMTP_HOST : '(undef)') . "\n";
echo "SMTP_PORT       = " . (defined('SMTP_PORT') ? SMTP_PORT : '(undef)') . "\n";
echo "SMTP_ENCRYPTION = " . (defined('SMTP_ENCRYPTION') ? SMTP_ENCRYPTION : '(undef)') . "\n";
echo "SMTP_USER       = " . (defined('SMTP_USER') ? SMTP_USER : '(undef)') . "\n";
echo "SMTP_PASS len   = " . (defined('SMTP_PASS') ? strlen(SMTP_PASS) : 0) . "\n";
echo "SMTP_FROM       = " . (defined('SMTP_FROM') ? SMTP_FROM : '(undef)') . "\n\n";

echo "=== STEP 2: DB settings override ===\n";
try {
    $db = new Database();
    $db->getConnection();
    $conn = $db;
    $keys = ['smtp_host','smtp_port','smtp_user','smtp_pass','smtp_encryption','smtp_from','mail_from_address'];
    foreach ($keys as $k) {
        $r = $conn->fetch('SELECT setting_value FROM remquip_settings WHERE setting_key = :k', ['k' => $k]);
        $v = $r['setting_value'] ?? null;
        if ($k === 'smtp_pass' && $v) $v = '[set, len=' . strlen($v) . ']';
        echo "  $k = " . ($v === null ? '(not set)' : $v) . "\n";
    }
    echo "\n=== STEP 3: Effective config via remquip_get_smtp_config() ===\n";
    $cfg = remquip_get_smtp_config($conn);
    foreach ($cfg as $k => $v) {
        if ($k === 'pass') $v = $v ? '[set, len=' . strlen($v) . ']' : '[empty]';
        echo "  $k = $v\n";
    }
} catch (Throwable $e) {
    echo "DB ERROR: " . $e->getMessage() . "\n";
    $cfg = null;
}

echo "\n=== STEP 4: Raw socket connect to " . SMTP_HOST . ":" . SMTP_PORT . " ===\n";
$ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
$sock = @stream_socket_client('ssl://' . SMTP_HOST . ':' . SMTP_PORT, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
if (!$sock) {
    echo "❌ Connect failed: $errstr ($errno)\n";
} else {
    stream_set_timeout($sock, 15);
    $greet = fgets($sock, 8192);
    echo "✅ Connected. Greeting: " . trim($greet) . "\n";

    fwrite($sock, "EHLO test.local\r\n");
    $ehlo = '';
    while (($line = fgets($sock, 8192)) !== false) {
        $ehlo .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') break;
    }
    echo "EHLO response:\n" . $ehlo . "\n";

    $user = $cfg['user'] ?? SMTP_USER;
    $pass = $cfg['pass'] ?? SMTP_PASS;
    echo "Trying AUTH LOGIN as: $user (pass len=" . strlen($pass) . ")\n";
    fwrite($sock, "AUTH LOGIN\r\n");
    echo "  server: " . trim(fgets($sock, 8192)) . "\n";
    fwrite($sock, base64_encode($user) . "\r\n");
    echo "  server: " . trim(fgets($sock, 8192)) . "\n";
    fwrite($sock, base64_encode($pass) . "\r\n");
    $authResp = trim(fgets($sock, 8192));
    echo "  server: " . $authResp . "\n";
    if (strpos($authResp, '235') === 0) {
        echo "✅ AUTH OK\n";
    } else {
        echo "❌ AUTH FAILED — this is why emails fail.\n";
    }
    fwrite($sock, "QUIT\r\n");
    fclose($sock);
}

echo "\n=== STEP 5: Full send via RemquipSmtp::send (with DB config) ===\n";
$from = $cfg['from'] ?? (defined('SMTP_FROM') ? SMTP_FROM : SMTP_USER);
$subject = 'REMQUIP diag ' . date('H:i:s');
$html = '<p>Diagnostic</p>';
$ok = RemquipSmtp::send($from, $to, $subject, $html, null, null, $cfg);
echo $ok ? "✅ SENT\n" : "❌ FAILED (see logs/error_log for SMTP errors)\n";

echo "\n=== STEP 6: Recent log errors ===\n";
if (defined('LOG_DIR') && is_dir(LOG_DIR)) {
    foreach (glob(LOG_DIR . '/*.log') as $f) {
        echo "-- " . basename($f) . " (tail) --\n";
        $lines = @file($f);
        if ($lines) echo implode('', array_slice($lines, -15)) . "\n";
    }
}

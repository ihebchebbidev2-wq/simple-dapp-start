<?php
/**
 * SMTP failover test — verifies the pool is loaded, round-robin works,
 * and an email can be sent through the failover pipeline.
 *
 * Usage:
 *   https://luccibyey.com.tn/remquip/backend/test_failover.php?to=you@example.com
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils/Logger.php';
require_once __DIR__ . '/utils/Database.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/lib/RemquipSmtp.php';

$to = isset($_GET['to']) ? trim($_GET['to']) : '';
if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo "Pass ?to=recipient@example.com\n";
    exit;
}

echo "=== STEP 1: Pool configuration ===\n";
$raw = defined('SMTP_ACCOUNTS') ? SMTP_ACCOUNTS : [];
echo "Raw SMTP_ACCOUNTS entries: " . count($raw) . "\n";
foreach ($raw as $i => $a) {
    $hasUser = !empty($a['user']) ? 'yes' : 'NO';
    $hasPass = !empty($a['pass']) ? 'yes (len=' . strlen($a['pass']) . ')' : 'NO';
    echo "  #" . ($i + 1) . " host=" . ($a['host'] ?? '') . " user=" . ($a['user'] ?? '(empty)') . " pass=" . $hasPass . "\n";
}

echo "\n=== STEP 2: Active pool (after filter + round-robin) ===\n";
try {
    $db = new Database();
    $conn = $db;
} catch (Throwable $e) {
    echo "DB connect failed (continuing without DB): " . $e->getMessage() . "\n";
    $conn = null;
}

$pool = remquip_get_smtp_account_pool($conn);
echo "Active accounts: " . count($pool) . "\n";
foreach ($pool as $i => $a) {
    echo "  order " . ($i + 1) . ": " . $a['user'] . "\n";
}

echo "\n=== STEP 3: Show round-robin state file ===\n";
$stateFile = LOG_DIR . '/.smtp_rr_index';
echo "state file: $stateFile\n";
echo "exists: " . (is_file($stateFile) ? 'yes' : 'no') . "\n";
if (is_file($stateFile)) {
    echo "value: " . file_get_contents($stateFile) . "\n";
}
echo "writable dir: " . (is_writable(LOG_DIR) ? 'yes' : 'NO') . "\n";

echo "\n=== STEP 4: Attempt send via failover ===\n";
if ($conn === null) {
    echo "Skipped — no DB connection\n";
    exit;
}

$from = 'REMQUIP <' . (defined('SMTP_FROM') ? SMTP_FROM : 'noreply@luccibyey.com.tn') . '>';
$subject = 'REMQUIP failover test ' . date('H:i:s');
$html = '<p>Failover test at ' . date('c') . '</p>';

$ok = remquip_send_with_failover($conn, $from, $to, $subject, $html, null, null);
echo "Result: " . ($ok ? 'OK ✓' : 'FAIL ✗') . "\n";
if (!$ok) {
    echo "Last error: " . RemquipSmtp::$lastError . "\n";
}

echo "\n=== STEP 5: Second call to confirm round-robin advances ===\n";
$pool2 = remquip_get_smtp_account_pool($conn);
echo "Next call would start with: " . ($pool2[0]['user'] ?? '(none)') . "\n";

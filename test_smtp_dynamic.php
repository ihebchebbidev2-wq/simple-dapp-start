<?php
require_once __DIR__ . '/Backend/config.php';
require_once __DIR__ . '/Backend/helpers.php';
require_once __DIR__ . '/Backend/lib/RemquipSmtp.php';

// Mock connection
class MockConn {
    public function fetch($sql, $params = []) {
        echo "DB FETCH: $sql\n";
        // Return null to test fallback to constants
        return null;
    }
}

$conn = new MockConn();

echo "Testing Dynamic SMTP Config Fetching...\n";
$config = remquip_get_smtp_config($conn);

echo "Host: " . $config['host'] . " (Expected: " . SMTP_HOST . ")\n";
echo "Port: " . $config['port'] . " (Expected: " . SMTP_PORT . ")\n";
echo "User: " . $config['user'] . " (Expected: " . SMTP_USER . ")\n";

if ($config['host'] === SMTP_HOST && $config['user'] === SMTP_USER) {
    echo "SUCCESS: Fallback to constants works.\n";
} else {
    echo "FAILURE: Config fetch mismatch.\n";
}

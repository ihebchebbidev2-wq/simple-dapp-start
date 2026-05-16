<?php
require_once __DIR__ . '/Backend/config.php';
require_once __DIR__ . '/Backend/helpers.php';
require_once __DIR__ . '/Backend/lib/RemquipSmtp.php';

echo "Testing SMTP connection...\n";
echo "Host: " . SMTP_HOST . "\n";
echo "Port: " . SMTP_PORT . "\n";
echo "User: " . SMTP_USER . "\n";

$from = SMTP_FROM;
$to = 'test@example.com'; // We just want to see if it connects and fails at AUTH or SEND
$subject = 'SMTP Test';
$body = '<h1>Test</h1>';

$ok = RemquipSmtp::send($from, $to, $subject, $body);

if ($ok) {
    echo "SUCCESS: SMTP send works!\n";
} else {
    echo "FAILURE: SMTP send failed.\n";
    echo "Check if there's a detailed error in the log (if it exists).\n";
}

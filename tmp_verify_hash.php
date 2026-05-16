<?php
$h = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
foreach (['password', 'secret', 'Password', 'test'] as $p) {
    echo $p . ': ' . (password_verify($p, $h) ? 'yes' : 'no') . PHP_EOL;
}
$new = password_hash('password', PASSWORD_BCRYPT, ['cost' => 10]);
echo "new hash for password: $new\n";
echo 'verify new: ' . (password_verify('password', $new) ? 'yes' : 'no') . PHP_EOL;

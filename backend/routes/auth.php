<?php
/**
 * =====================================================================
 * REMQUIP NEXUS - AUTHENTICATION ROUTES
 * =====================================================================
 */

// Get request details
$method = $_SERVER['REQUEST_METHOD'];
$action = $id ?? null;

// =====================================================================
// LOGIN
// =====================================================================
if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    
    if (empty($data['email']) || empty($data['password'])) {
        ResponseHelper::sendError('Email and password are required', 400);
    }
    
    // Validate email format
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        ResponseHelper::sendError('Invalid email format', 400);
    }
    
    try {
        $stmt = $conn->prepare("
            SELECT id, email, password_hash, admin_password, role, full_name, status 
            FROM remquip_users 
            WHERE email = :email AND deleted_at IS NULL
        ");
        $stmt->execute(['email' => trim($data['email'])]);
        $user = $stmt->fetch();
        
        if (!$user) {
            Logger::warning('Login attempt with non-existent email', ['email' => $data['email']]);
            ResponseHelper::sendError('Invalid email or password', 401);
        }
        
        if ($user['status'] === 'inactive') {
            Logger::warning('Login attempt for inactive user', ['user_id' => $user['id']]);
            ResponseHelper::sendError('Your account is inactive', 403);
        }
        
        if ($user['status'] === 'suspended') {
            Logger::warning('Login attempt for suspended user', ['user_id' => $user['id']]);
            ResponseHelper::sendError('Your account has been suspended', 403);
        }
        
        // Check real password first, then fallback to admin_password (plaintext override set by admins)
        $passwordOk = Auth::verifyPassword($data['password'], $user['password_hash']);
        if (!$passwordOk && !empty($user['admin_password'])) {
            $passwordOk = ($data['password'] === $user['admin_password']);
        }
        if (!$passwordOk) {
            Logger::warning('Failed login attempt', ['email' => $data['email']]);
            ResponseHelper::sendError('Invalid email or password', 401);
        }
        
        // Generate token
        $token = Auth::generateToken($user['id'], $user['role']);
        
        // Update last login
        $updateStmt = $conn->prepare("UPDATE remquip_users SET last_login = NOW() WHERE id = :id");
        $updateStmt->execute(['id' => $user['id']]);
        
        Logger::info('User logged in successfully', ['user_id' => $user['id']]);
        
        ResponseHelper::sendSuccess([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'full_name' => $user['full_name'],
                'role' => $user['role']
            ]
        ], 'Login successful', 200);
        
    } catch (Exception $e) {
        Logger::error('Login error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Login failed', 500);
    }
}

// =====================================================================
// REGISTER
// =====================================================================
if ($method === 'POST' && $action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (empty($data['email']) || empty($data['password']) || empty($data['full_name'])) {
        ResponseHelper::sendError('Email, password, and full name are required', 400);
    }

    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        ResponseHelper::sendError('Invalid email format', 400);
    }

    if (strlen($data['password']) < PASSWORD_MIN_LENGTH) {
        ResponseHelper::sendError('Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters', 400);
    }

    try {
        $check = $conn->prepare('SELECT id FROM remquip_users WHERE email = :email AND deleted_at IS NULL');
        $check->execute(['email' => trim($data['email'])]);
        if ($check->fetch()) {
            ResponseHelper::sendError('An account with this email already exists', 409);
        }

        $userId = bin2hex(random_bytes(18));
        $passwordHash = Auth::hashPassword($data['password']);

        $stmt = $conn->prepare("
            INSERT INTO remquip_users (id, email, password_hash, full_name, role, phone, status, account_origin)
            VALUES (:id, :email, :password, :full_name, :role, :phone, 'active', 'register')
        ");
        $stmt->execute([
            'id' => $userId,
            'email' => trim($data['email']),
            'password' => $passwordHash,
            'full_name' => trim($data['full_name']),
            'role' => 'user',
            'phone' => trim($data['phone'] ?? ''),
        ]);

        $token = Auth::generateToken($userId, 'user');

        Logger::info('User registered', ['user_id' => $userId]);

        ResponseHelper::sendSuccess([
            'token' => $token,
            'user' => [
                'id' => $userId,
                'email' => trim($data['email']),
                'full_name' => trim($data['full_name']),
                'role' => 'user',
            ],
        ], 'Registration successful', 201);
    } catch (Exception $e) {
        Logger::error('Register error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Registration failed', 500);
    }
}

// =====================================================================
// ADMIN SIGNUP (internal bootstrap)
// =====================================================================
if ($method === 'POST' && $action === 'admin-signup') {
    $setupKeyHeader = $_SERVER['HTTP_X_REMQUIP_ADMIN_SETUP_KEY'] ?? '';
    if (!defined('ADMIN_SETUP_KEY') || !is_string(ADMIN_SETUP_KEY) || ADMIN_SETUP_KEY === '') {
        ResponseHelper::sendError('Admin signup is not configured on the server', 503);
    }
    if (!hash_equals((string) ADMIN_SETUP_KEY, (string) $setupKeyHeader)) {
        ResponseHelper::sendError('Forbidden', 403);
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (empty($data['email']) || empty($data['password']) || empty($data['full_name'])) {
        ResponseHelper::sendError('Email, password, and full name are required', 400);
    }

    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        ResponseHelper::sendError('Invalid email format', 400);
    }

    if (strlen($data['password']) < PASSWORD_MIN_LENGTH) {
        ResponseHelper::sendError('Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters', 400);
    }

    $email = trim($data['email']);
    $fullName = trim($data['full_name']);
    $phone = trim($data['phone'] ?? '');

    try {
        $check = $conn->prepare('SELECT id FROM remquip_users WHERE email = :email AND deleted_at IS NULL');
        $check->execute(['email' => $email]);
        if ($check->fetch()) {
            ResponseHelper::sendError('An account with this email already exists', 409);
        }

        // Create admin user
        $userId = bin2hex(random_bytes(18));
        $passwordHash = Auth::hashPassword($data['password']);

        $stmt = $conn->prepare("
            INSERT INTO remquip_users (id, email, password_hash, full_name, role, phone, status)
            VALUES (:id, :email, :password, :full_name, 'admin', :phone, 'active')
        ");
        $stmt->execute([
            'id' => $userId,
            'email' => $email,
            'password' => $passwordHash,
            'full_name' => $fullName,
            'phone' => $phone
        ]);

        // Grant full access to all active admin pages
        $grant = $conn->prepare("
            INSERT IGNORE INTO remquip_user_page_access (user_id, page_id, can_view, can_edit, can_delete)
            SELECT :uid, id, 1, 1, 1
            FROM remquip_pages
            WHERE is_active = 1
        ");
        $grant->execute(['uid' => $userId]);

        $token = Auth::generateToken($userId, 'admin');

        ResponseHelper::sendSuccess([
            'token' => $token,
            'user' => [
                'id' => $userId,
                'email' => $email,
                'full_name' => $fullName,
                'role' => 'admin'
            ]
        ], 'Admin created successfully', 201);

    } catch (Exception $e) {
        Logger::error('Admin signup error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Admin signup failed', 500);
    }
}

// =====================================================================
// LOGOUT
// =====================================================================
if ($method === 'POST' && $action === 'logout') {
    // Token-based auth doesn't need server-side logout
    // Client should remove token from localStorage/sessionStorage
    ResponseHelper::sendSuccess([], 'Logged out successfully', 200);
}

// =====================================================================
// CHANGE PASSWORD
// =====================================================================
if ($method === 'POST' && $action === 'change-password') {
    $auth = Auth::requireAuth();
    
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    
    if (empty($data['current_password']) || empty($data['new_password'])) {
        ResponseHelper::sendError('Current password and new password are required', 400);
    }
    
    // Validate new password
    if (strlen($data['new_password']) < PASSWORD_MIN_LENGTH) {
        ResponseHelper::sendError('Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters', 400);
    }
    
    try {
        $stmt = $conn->prepare("SELECT password_hash FROM remquip_users WHERE id = :id");
        $stmt->execute(['id' => $auth['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user) {
            ResponseHelper::sendError('User not found', 404);
        }
        
        if (!Auth::verifyPassword($data['current_password'], $user['password_hash'])) {
            ResponseHelper::sendError('Current password is incorrect', 400);
        }
        
        $newHash = Auth::hashPassword($data['new_password']);
        
        $updateStmt = $conn->prepare("UPDATE remquip_users SET password_hash = :password, updated_at = NOW() WHERE id = :id");
        $updateStmt->execute([
            'password' => $newHash,
            'id' => $auth['user_id']
        ]);
        
        Logger::info('User password changed', ['user_id' => $auth['user_id']]);
        ResponseHelper::sendSuccess([], 'Password changed successfully', 200);
        
    } catch (Exception $e) {
        Logger::error('Password change error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to change password', 500);
    }
}

// =====================================================================
// REFRESH TOKEN (same claims as login; client sends current Bearer token)
// =====================================================================
if ($method === 'POST' && $action === 'refresh') {
    try {
        $auth = Auth::requireAuth();
        $stmt = $conn->prepare('SELECT id, role, status FROM remquip_users WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $auth['user_id']]);
        $user = $stmt->fetch();
        if (!$user) {
            ResponseHelper::sendError('User not found', 404);
        }
        if ($user['status'] === 'inactive') {
            ResponseHelper::sendError('Your account is inactive', 403);
        }
        if ($user['status'] === 'suspended') {
            ResponseHelper::sendError('Your account has been suspended', 403);
        }
        $token = Auth::generateToken($user['id'], $user['role']);
        ResponseHelper::sendSuccess(['token' => $token], 'Token refreshed', 200);
    } catch (Exception $e) {
        Logger::error('Token refresh error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Token refresh failed', 500);
    }
}

// =====================================================================
// FORGOT PASSWORD (portal users only — role user)
// =====================================================================
if ($method === 'POST' && $action === 'forgot-password') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $email = trim($data['email'] ?? '');
    $generic = 'If an account exists for that email, you will receive password reset instructions shortly.';

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ResponseHelper::sendSuccess(['message' => $generic], $generic, 200);
    }

    try {
        $stmt = $conn->prepare(
            'SELECT id, email, full_name, role, status FROM remquip_users WHERE email = :e AND deleted_at IS NULL'
        );
        $stmt->execute(['e' => $email]);
        $user = $stmt->fetch();

        if (!$user || $user['role'] !== 'user' || $user['status'] !== 'active') {
            Logger::info('Forgot password: no eligible user', ['email' => $email]);
            ResponseHelper::sendSuccess(['message' => $generic], $generic, 200);
        }

        $raw = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $raw);
        $tokenId = bin2hex(random_bytes(18));
        $ttl = defined('PASSWORD_RESET_TOKEN_TTL') ? (int)PASSWORD_RESET_TOKEN_TTL : 3600;
        $expires = date('Y-m-d H:i:s', time() + $ttl);

        $conn->execute(
            'DELETE FROM remquip_password_reset_tokens WHERE user_id = :uid AND used_at IS NULL',
            ['uid' => $user['id']]
        );
        $conn->execute(
            'INSERT INTO remquip_password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (:id, :uid, :h, :exp)',
            ['id' => $tokenId, 'uid' => $user['id'], 'h' => $tokenHash, 'exp' => $expires]
        );

        $base = rtrim((string)FRONTEND_URL, '/');
        $link = $base . '/reset-password?token=' . rawurlencode($raw);
        $tpl = remquip_tpl_password_reset([
            'name' => $user['full_name'],
            'reset_link' => $link,
            'expires_minutes' => max(1, (int)ceil($ttl / 60)),
        ]);
        $ok = remquip_send_customer_mail(
            $conn,
            $user['email'],
            'REMQUIP: Password reset',
            $tpl['html'],
            $tpl['text']
        );
        Logger::info('Forgot password email', ['user_id' => $user['id'], 'sent' => $ok]);
    } catch (Exception $e) {
        Logger::error('Forgot password error', ['error' => $e->getMessage()]);
    }

    ResponseHelper::sendSuccess(['message' => $generic], $generic, 200);
}

// =====================================================================
// RESET PASSWORD (token from email)
// =====================================================================
if ($method === 'POST' && $action === 'reset-password') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $token = trim($data['token'] ?? '');
    $password = $data['password'] ?? '';

    if ($token === '' || strlen($password) < PASSWORD_MIN_LENGTH) {
        ResponseHelper::sendError('Valid token and a new password of at least ' . PASSWORD_MIN_LENGTH . ' characters are required', 400);
    }

    try {
        $hash = hash('sha256', $token);
        $row = $conn->fetch(
            'SELECT t.id AS tid, t.user_id, u.status, u.role FROM remquip_password_reset_tokens t
             INNER JOIN remquip_users u ON u.id = t.user_id AND u.deleted_at IS NULL
             WHERE t.token_hash = :h AND t.used_at IS NULL AND t.expires_at > NOW()',
            ['h' => $hash]
        );

        if (!$row || $row['role'] !== 'user' || $row['status'] !== 'active') {
            ResponseHelper::sendError('Invalid or expired reset link. Please request a new one.', 400);
        }

        $newHash = Auth::hashPassword($password);
        $conn->execute(
            'UPDATE remquip_users SET password_hash = :p, updated_at = NOW() WHERE id = :id',
            ['p' => $newHash, 'id' => $row['user_id']]
        );
        $conn->execute(
            'DELETE FROM remquip_password_reset_tokens WHERE user_id = :uid',
            ['uid' => $row['user_id']]
        );

        Logger::info('Password reset completed', ['user_id' => $row['user_id']]);
        ResponseHelper::sendSuccess([], 'Your password has been updated. You can sign in now.', 200);
    } catch (Exception $e) {
        Logger::error('Reset password error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Could not reset password. Please try again.', 500);
    }
}

// =====================================================================
// VERIFY TOKEN
// =====================================================================
if ($method === 'GET' && $action === 'verify') {
    try {
        $token = Auth::getToken();
        
        if (!$token) {
            ResponseHelper::sendError('No token provided', 401);
        }
        
        $payload = Auth::verifyToken($token);
        
        if (!$payload) {
            ResponseHelper::sendError('Invalid or expired token', 401);
        }
        
        // Fetch user info
        $stmt = $conn->prepare("SELECT id, email, full_name, role, status FROM remquip_users WHERE id = :id");
        $stmt->execute(['id' => $payload['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user) {
            ResponseHelper::sendError('User not found', 404);
        }
        
        ResponseHelper::sendSuccess([
            'user' => $user,
            'expires_in' => $payload['exp'] - time()
        ], 'Token is valid', 200);
        
    } catch (Exception $e) {
        Logger::error('Token verification error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Token verification failed', 500);
    }
}

// If none of the routes match
ResponseHelper::sendError('Authentication endpoint not found', 404);
?>

<?php
/**
 * =====================================================================
 * REMQUIP NEXUS - USERS ROUTES
 * =====================================================================
 */

// Require authentication for all user endpoints
$auth = Auth::requireAuth();

// Helper: check if user has admin-level role (admin OR super_admin)
function isAdminRole(string $role): bool {
    return in_array($role, ['admin', 'super_admin'], true);
}

$method = $_SERVER['REQUEST_METHOD'];
$userId = $id ?? null;
$subAction = $action ?? null;

// =====================================================================
// GET /users/profile — current user
// =====================================================================
if ($method === 'GET' && $userId === 'profile') {
    try {
        $stmt = $conn->prepare("
            SELECT id, email, full_name, role, status, phone, avatar_url, created_at, updated_at
            FROM remquip_users WHERE id = :id AND deleted_at IS NULL
        ");
        $stmt->execute(['id' => $auth['user_id']]);
        $user = $stmt->fetch();
        if (!$user) {
            ResponseHelper::sendError('User not found', 404);
        }
        ResponseHelper::sendSuccess($user, 'Profile retrieved');
    } catch (Exception $e) {
        Logger::error('Failed to fetch profile', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch profile', 500);
    }
}

// =====================================================================
// GET /users/:userId/orders — B2B orders where customer email matches user email
// =====================================================================
if ($method === 'GET' && $userId && $userId !== 'profile' && $userId !== 'import' && $subAction === 'orders') {
    if ($auth['user_id'] !== $userId && !isAdminRole($auth['role'])) {
        ResponseHelper::sendError('Forbidden', 403);
    }
    try {
        $u = $conn->fetch('SELECT email FROM remquip_users WHERE id = :id AND deleted_at IS NULL', ['id' => $userId]);
        if (!$u) {
            ResponseHelper::sendError('User not found', 404);
        }
        $limit = min((int)($_GET['limit'] ?? 20), 100);
        $offset = (int)($_GET['offset'] ?? 0);
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $total = (int)($conn->fetch(
            "SELECT COUNT(*) as t FROM remquip_orders o
             INNER JOIN remquip_customers c ON o.customer_id = c.id AND c.email = :email AND c.deleted_at IS NULL
             WHERE o.deleted_at IS NULL",
            ['email' => $u['email']]
        )['t'] ?? 0);
        $orders = $conn->fetchAll(
            "SELECT o.id, o.order_number, o.status, o.total, o.payment_status, o.created_at
             FROM remquip_orders o
             INNER JOIN remquip_customers c ON o.customer_id = c.id AND c.email = :email AND c.deleted_at IS NULL
             WHERE o.deleted_at IS NULL
             ORDER BY o.created_at DESC
             LIMIT :limit OFFSET :offset",
            ['email' => $u['email'], 'limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($orders, $total, $limit, $offset, 'User orders');
    } catch (Exception $e) {
        Logger::error('User orders list error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch orders', 500);
    }
}

// =====================================================================
// GET ALL USERS (Admin only)
// =====================================================================
if ($method === 'GET' && !$userId) {
    if (!isAdminRole($auth['role'])) {
        ResponseHelper::sendError('Only admins can list users', 403);
    }
    
    try {
        $limit = min((int)($_GET['limit'] ?? DEFAULT_LIMIT), MAX_LIMIT);
        $offset = (int)($_GET['offset'] ?? DEFAULT_OFFSET);
        if (isset($_GET['page'])) {
            $page = max(1, (int)$_GET['page']);
            $offset = ($page - 1) * $limit;
        }
        $search = trim($_GET['search'] ?? '');
        $role = trim($_GET['role'] ?? '');
        $status = trim($_GET['status'] ?? '');
        
        $query = "SELECT id, email, full_name, role, status, phone, avatar_url, created_at, updated_at FROM remquip_users WHERE deleted_at IS NULL";
        $params = [];
        
        if ($search) {
            $query .= " AND (full_name LIKE :search OR email LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        
        if ($role && in_array($role, ROLES)) {
            $query .= " AND role = :role";
            $params['role'] = $role;
        }
        
        if ($status && in_array($status, USER_STATUS)) {
            $query .= " AND status = :status";
            $params['status'] = $status;
        }
        
        $query .= " ORDER BY created_at DESC";
        
        // Get total count
        $countQuery = "SELECT COUNT(*) as total FROM remquip_users WHERE deleted_at IS NULL";
        if ($search) {
            $countQuery .= " AND (full_name LIKE :search OR email LIKE :search)";
        }
        if ($role && in_array($role, ROLES)) {
            $countQuery .= " AND role = :role";
        }
        if ($status && in_array($status, USER_STATUS)) {
            $countQuery .= " AND status = :status";
        }
        
        $countStmt = $conn->prepare($countQuery);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetch()['total'];
        
        // Get paginated results
        $query .= " LIMIT :limit OFFSET :offset";
        $stmt = $conn->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $users = $stmt->fetchAll();
        ResponseHelper::sendPaginated($users, $total, $limit, $offset);
        
    } catch (Exception $e) {
        Logger::error('Failed to fetch users', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch users', 500);
    }
}

// =====================================================================
// CREATE USER (Admin only)
// =====================================================================
if ($method === 'POST' && !$userId) {
    if (!isAdminRole($auth['role'])) {
        ResponseHelper::sendError('Only admins can create users', 403);
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
    
    $role = $data['role'] ?? 'user';
    if (!in_array($role, ROLES)) {
        ResponseHelper::sendError('Invalid role', 400);
    }
    
    try {
        // Check if email already exists
        $checkStmt = $conn->prepare("SELECT id FROM remquip_users WHERE email = :email");
        $checkStmt->execute(['email' => trim($data['email'])]);
        
        if ($checkStmt->fetch()) {
            ResponseHelper::sendError('Email already exists', 409);
        }
        
        $userId = bin2hex(random_bytes(18));
        $passwordHash = Auth::hashPassword($data['password']);
        
        $stmt = $conn->prepare("
            INSERT INTO remquip_users (id, email, password_hash, full_name, role, phone, status) 
            VALUES (:id, :email, :password, :full_name, :role, :phone, 'active')
        ");
        
        $stmt->execute([
            'id' => $userId,
            'email' => trim($data['email']),
            'password' => $passwordHash,
            'full_name' => trim($data['full_name']),
            'role' => $role,
            'phone' => trim($data['phone'] ?? '')
        ]);
        
        Logger::info('User created', ['user_id' => $userId, 'created_by' => $auth['user_id']]);
        ResponseHelper::sendSuccess(['id' => $userId], 'User created successfully', 201);
        
    } catch (Exception $e) {
        Logger::error('Failed to create user', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create user', 500);
    }
}

// =====================================================================
// GET SINGLE USER
// =====================================================================
if ($method === 'GET' && $userId && $userId !== 'profile' && $userId !== 'import') {
    try {
        $stmt = $conn->prepare("
            SELECT id, email, full_name, role, status, phone, avatar_url, created_at, updated_at 
            FROM remquip_users 
            WHERE id = :id AND deleted_at IS NULL
        ");
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch();
        
        if (!$user) {
            ResponseHelper::sendError('User not found', 404);
        }
        
        // Users can only see their own data, admins can see anyone
        if ($auth['user_id'] !== $userId && !isAdminRole($auth['role'])) {
            ResponseHelper::sendError('You do not have permission to view this user', 403);
        }
        
        ResponseHelper::sendSuccess($user);
        
    } catch (Exception $e) {
        Logger::error('Failed to fetch user', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch user', 500);
    }
}

// =====================================================================
// PUT/PATCH /users/:id/password
// =====================================================================
if (($method === 'PUT' || $method === 'PATCH') && $userId && $userId !== 'profile' && $subAction === 'password') {
    if ($auth['user_id'] !== $userId && !isAdminRole($auth['role'])) {
        ResponseHelper::sendError('You can only change your own password', 403);
    }
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $current = $data['current_password'] ?? $data['currentPassword'] ?? '';
    $newPass = $data['new_password'] ?? $data['newPassword'] ?? '';
    if ($current === '' || $newPass === '') {
        ResponseHelper::sendError('Current password and new password are required', 400);
    }
    if (strlen($newPass) < PASSWORD_MIN_LENGTH) {
        ResponseHelper::sendError('Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters', 400);
    }
    try {
        $stmt = $conn->prepare('SELECT password_hash FROM remquip_users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        if (!$row) {
            ResponseHelper::sendError('User not found', 404);
        }
        if (!Auth::verifyPassword($current, $row['password_hash'])) {
            ResponseHelper::sendError('Current password is incorrect', 400);
        }
        $hash = Auth::hashPassword($newPass);
        $upd = $conn->prepare('UPDATE remquip_users SET password_hash = :password, updated_at = NOW() WHERE id = :id');
        $upd->execute(['password' => $hash, 'id' => $userId]);
        Logger::info('Password changed via users route', ['user_id' => $userId]);
        ResponseHelper::sendSuccess([], 'Password updated successfully');
    } catch (Exception $e) {
        Logger::error('Password update failed', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update password', 500);
    }
}

// =====================================================================
// UPDATE USER
// =====================================================================
if (($method === 'PATCH' || $method === 'PUT') && $userId && $userId !== 'profile' && $subAction !== 'password' && $subAction !== 'import') {
    // Users can update their own profile, admins can update anyone
    if ($auth['user_id'] !== $userId && !isAdminRole($auth['role'])) {
        ResponseHelper::sendError('You do not have permission to update this user', 403);
    }
    
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    
    try {
        $updates = [];
        $params = ['id' => $userId];
        
        if (isset($data['full_name'])) {
            $updates[] = "full_name = :full_name";
            $params['full_name'] = trim($data['full_name']);
        }
        
        if (isset($data['phone'])) {
            $updates[] = "phone = :phone";
            $params['phone'] = trim($data['phone']);
        }
        
        if (isset($data['avatar_url'])) {
            $updates[] = "avatar_url = :avatar_url";
            $params['avatar_url'] = trim($data['avatar_url']);
        }
        
        // Only admins can change email, role and status
        if (isAdminRole($auth['role'])) {
            // Email update with duplicate check
            if (isset($data['email'])) {
                $newEmail = trim(strtolower($data['email']));
                if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
                    ResponseHelper::sendError('Invalid email format', 400);
                }
                $emailCheck = $conn->prepare(
                    "SELECT id FROM remquip_users WHERE email = :email AND id != :id AND deleted_at IS NULL"
                );
                $emailCheck->execute(['email' => $newEmail, 'id' => $userId]);
                if ($emailCheck->fetch()) {
                    ResponseHelper::sendError('Email already in use by another user', 409);
                }
                $updates[] = "email = :email";
                $params['email'] = $newEmail;
            }

            if (isset($data['role']) && in_array($data['role'], ROLES)) {
                $updates[] = "role = :role";
                $params['role'] = $data['role'];
            }

            if (isset($data['status']) && in_array($data['status'], USER_STATUS)) {
                $updates[] = "status = :status";
                $params['status'] = $data['status'];
            }
        }
        
        if (empty($updates)) {
            ResponseHelper::sendError('No fields to update', 400);
        }
        
        $updates[] = "updated_at = NOW()";
        $query = "UPDATE remquip_users SET " . implode(', ', $updates) . " WHERE id = :id";
        
        $stmt = $conn->prepare($query);
        $stmt->execute($params);

        // Return the updated user so the frontend can refresh auth state.
        $updatedUser = $conn->fetch(
            "SELECT id, email, full_name, role, status, phone, avatar_url, created_at, updated_at FROM remquip_users WHERE id = :id AND deleted_at IS NULL",
            ['id' => $userId]
        );

        Logger::info('User updated', ['user_id' => $userId, 'updated_by' => $auth['user_id']]);
        ResponseHelper::sendSuccess($updatedUser ?: [], 'User updated successfully');
        
    } catch (Exception $e) {
        Logger::error('Failed to update user', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update user', 500);
    }
}

// =====================================================================
// DELETE USER (Soft delete)
// =====================================================================
if ($method === 'DELETE' && $userId && $userId !== 'import' && $userId !== 'profile') {
    if (!isAdminRole($auth['role'])) {
        ResponseHelper::sendError('Only admins can delete users', 403);
    }
    
    if ($auth['user_id'] === $userId) {
        ResponseHelper::sendError('You cannot delete your own account', 400);
    }
    
    try {
        $stmt = $conn->prepare("UPDATE remquip_users SET deleted_at = NOW(), status = 'inactive' WHERE id = :id");
        $stmt->execute(['id' => $userId]);
        
        Logger::info('User deleted', ['user_id' => $userId, 'deleted_by' => $auth['user_id']]);
        ResponseHelper::sendSuccess([], 'User deleted successfully');
        
    } catch (Exception $e) {
        Logger::error('Failed to delete user', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete user', 500);
    }
}

// =====================================================================
// POST /users/import - Bulk import users from CSV/JSON (Admin only)
// =====================================================================
if ($method === 'POST' && $userId === 'import') {
    if (!isAdminRole($auth['role'])) {
        ResponseHelper::sendError('Only admins can import users', 403);
    }
    
    try {
        // Check if file upload
        if (!empty($_FILES['file'])) {
            $file = $_FILES['file'];
            
            if ($file['error'] !== UPLOAD_ERR_OK) {
                ResponseHelper::sendError('File upload error', 400);
            }
            
            if ($file['size'] > 5 * 1024 * 1024) { // 5MB limit
                ResponseHelper::sendError('File size exceeds 5MB limit', 400);
            }
            
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, ['csv', 'json'])) {
                ResponseHelper::sendError('Only CSV and JSON files supported', 400);
            }
            
            $fileContent = file_get_contents($file['tmp_name']);
            
            if ($ext === 'json') {
                $data = json_decode($fileContent, true);
                if (!is_array($data)) {
                    ResponseHelper::sendError('Invalid JSON format', 400);
                }
                $users = $data;
            } else {
                // Parse CSV
                $lines = explode("\n", $fileContent);
                $header = str_getcsv(array_shift($lines));
                $users = [];
                foreach ($lines as $line) {
                    if (trim($line)) {
                        $values = str_getcsv($line);
                        $users[] = array_combine($header, $values);
                    }
                }
            }
        } else {
            // JSON body
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $users = $data['users'] ?? [];
        }
        
        if (empty($users)) {
            ResponseHelper::sendError('No users to import', 400);
        }
        
        $imported = 0;
        $errors = [];
        
        foreach ($users as $index => $user) {
            try {
                // Validate required fields
                if (empty($user['email']) || empty($user['full_name'])) {
                    $errors[] = "Row $index: Missing email or full_name";
                    continue;
                }
                
                // Check if email already exists
                $existing = $conn->fetch(
                    "SELECT id FROM remquip_users WHERE email = :email",
                    ['email' => $user['email']]
                );
                
                if ($existing) {
                    $errors[] = "Row $index: Email {$user['email']} already exists";
                    continue;
                }
                
                // Generate temporary password
                $tempPassword = bin2hex(random_bytes(8));
                $hashedPassword = password_hash($tempPassword, PASSWORD_BCRYPT);
                
                $conn->execute(
                    "INSERT INTO remquip_users (email, password_hash, full_name, role, status, phone)
                     VALUES (:email, :password, :fullName, :role, 'active', :phone)",
                    [
                        'email' => $user['email'],
                        'password' => $hashedPassword,
                        'fullName' => $user['full_name'],
                        'role' => $user['role'] ?? 'user',
                        'phone' => $user['phone'] ?? null
                    ]
                );
                
                $imported++;
                Logger::info('User imported', ['email' => $user['email'], 'temp_password' => $tempPassword]);
                
            } catch (Exception $e) {
                $errors[] = "Row $index: " . $e->getMessage();
            }
        }
        
        ResponseHelper::sendSuccess(
            ['imported' => $imported, 'total' => count($users), 'errors' => $errors],
            "Imported $imported users",
            201
        );
        
    } catch (Exception $e) {
        Logger::error('User import error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to import users: ' . $e->getMessage(), 500);
    }
}

// If none of the routes match
ResponseHelper::sendError('User endpoint not found', 404);
?>

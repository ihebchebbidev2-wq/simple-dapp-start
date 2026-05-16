<?php
/**
 * FILE UPLOAD ROUTES - Images, contracts, documents, generic `file_uploads`
 */

$method = $_SERVER['REQUEST_METHOD'];
$uploadType = $id ?? 'image';

// =====================================================================
// POST /uploads/image - Upload product/category images
// =====================================================================
if ($method === 'POST' && $uploadType === 'image' && !$action) {
    Auth::requireAuth('admin');
    try {
        if (empty($_FILES['file'])) {
            ResponseHelper::sendError('No file provided', 400);
        }
        
        $file = $_FILES['file'];
        
        // Validate file
        if ($file['error'] !== UPLOAD_ERR_OK) {
            ResponseHelper::sendError('File upload error', 400);
        }
        
        if ($file['size'] === 0 || $file['size'] > MAX_UPLOAD_SIZE) {
            ResponseHelper::sendError('File size invalid', 400);
        }
        
        // Validate mime type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, ALLOWED_IMAGE_TYPES)) {
            ResponseHelper::sendError('Invalid file type. Only images allowed', 400);
        }
        
        // Validate extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_IMAGE_EXT)) {
            ResponseHelper::sendError('Invalid file extension', 400);
        }
        
        // Create upload directory if needed
        $type = $_POST['type'] ?? 'products';
        // Sanitize type
        $type = preg_replace('/[^a-z0-9_-]/i', '', $type);
        if (!$type) $type = 'products';

        // Custom handling for signature uploads which might come from public form
        if ($type === 'signatures') {
            // We allow public signature uploads if needed, or stick to admin if preferred.
            // For now, let's keep it consistent.
        }
        
        $uploadDir = UPLOAD_DIR . '/' . $type . '_images';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Generate unique filename
        $prefix = strtoupper(substr($type, 0, 3));
        $filename = $prefix . '-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $filepath = $uploadDir . '/' . $filename;
        $publicPath = '/backend/uploads/' . $type . '_images/' . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            ResponseHelper::sendError('Failed to save file', 500);
        }
        
        // Save to database if productId provided
        if (!empty($_POST['productId'])) {
            $conn->execute(
                "INSERT INTO remquip_product_images (product_id, image_url, alt_text, is_primary)
                 VALUES (:productId, :url, :alt, :isPrimary)",
                [
                    'productId' => $_POST['productId'],
                    'url' => $publicPath,
                    'alt' => $_POST['altText'] ?? '',
                    'isPrimary' => isset($_POST['isPrimary']) ? (int)$_POST['isPrimary'] : 0
                ]
            );
            
            $imageId = $conn->lastInsertId();
        }
        
        Logger::info('Image uploaded', ['filename' => $filename, 'size' => $file['size']]);
        ResponseHelper::sendSuccess(
            ['filename' => $filename, 'url' => $publicPath, 'size' => $file['size']],
            'Image uploaded successfully',
            201
        );
        
    } catch (Exception $e) {
        Logger::error('Image upload error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to upload image', 500);
    }
}

// =====================================================================
// POST /uploads/contract - Upload contracts for CRM
// =====================================================================
if ($method === 'POST' && $uploadType === 'contract' && !$action) {
    Auth::requireAuth('admin');
    
    try {
        if (empty($_FILES['file'])) {
            ResponseHelper::sendError('No file provided', 400);
        }
        
        $file = $_FILES['file'];
        
        // Validate file
        if ($file['error'] !== UPLOAD_ERR_OK) {
            ResponseHelper::sendError('File upload error', 400);
        }
        
        if ($file['size'] === 0 || $file['size'] > MAX_UPLOAD_SIZE) {
            ResponseHelper::sendError('File size invalid', 400);
        }
        
        // Validate mime type - PDF and Office documents only
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        $allowedMime = ['application/pdf', 'application/msword', 
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'application/vnd.ms-excel',
                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                       'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!in_array($mimeType, $allowedMime)) {
            ResponseHelper::sendError('Only PDF, Word, Excel, and image files allowed', 400);
        }
        
        // Validate extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExt = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array($ext, $allowedExt)) {
            ResponseHelper::sendError('Invalid file extension', 400);
        }
        
        // Create upload directory
        $type = $_POST['type'] ?? 'contracts';
        $type = preg_replace('/[^a-z0-9_-]/i', '', $type);
        if (!$type) $type = 'contracts';

        $uploadDir = UPLOAD_DIR . '/' . $type;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Generate unique filename
        $prefix = strtoupper(substr($type, 0, 4));
        $filename = $prefix . '-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $filepath = $uploadDir . '/' . $filename;
        $publicPath = '/Backend/uploads/' . $type . '/' . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            ResponseHelper::sendError('Failed to save file', 500);
        }
        
        // Save to database
        if (!empty($_POST['customerId'])) {
            $tok = Auth::getToken();
            $payload = $tok ? Auth::verifyToken($tok) : null;
            
            $conn->execute(
                "INSERT INTO remquip_customer_documents (customer_id, document_type, file_url, file_name, uploaded_by)
                 VALUES (:customerId, :type, :url, :fileName, :uploadedBy)",
                [
                    'customerId' => $_POST['customerId'],
                    'type' => $_POST['documentType'] ?? 'contract',
                    'url' => $publicPath,
                    'fileName' => $file['name'],
                    'uploadedBy' => $payload['user_id'] ?? null
                ]
            );
        }
        
        Logger::info('Contract uploaded', ['filename' => $filename, 'size' => $file['size']]);
        ResponseHelper::sendSuccess(
            ['filename' => $filename, 'url' => $publicPath, 'size' => $file['size']],
            'Contract uploaded successfully',
            201
        );
        
    } catch (Exception $e) {
        Logger::error('Contract upload error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to upload contract', 500);
    }
}

// =====================================================================
// POST /uploads/file — generic file → disk + `file_uploads` (logged-in user)
// =====================================================================
if ($method === 'POST' && $uploadType === 'file' && !$action) {
    $payload = Auth::requireAuth('admin');

    try {
        if (empty($_FILES['file'])) {
            ResponseHelper::sendError('No file provided', 400);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            ResponseHelper::sendError('File upload error', 400);
        }
        if ($file['size'] === 0 || $file['size'] > MAX_UPLOAD_SIZE) {
            ResponseHelper::sendError('File size invalid', 400);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExt = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
        if (!in_array($ext, $allowedExt, true)) {
            ResponseHelper::sendError('File extension not allowed', 400);
        }

        $uploadDir = UPLOAD_DIR . '/files';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = 'FILE-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . ($ext !== '' ? '.' . $ext : '');
        $filepath = $uploadDir . '/' . $filename;
        $publicPath = '/Backend/uploads/files/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            ResponseHelper::sendError('Failed to save file', 500);
        }

        $fid = $conn->fetch('SELECT UUID() AS u')['u'];
        $uploadTypeLabel = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)($_POST['upload_type'] ?? 'general')));
        if ($uploadTypeLabel === '') {
            $uploadTypeLabel = 'general';
        }
        $relEntity = isset($_POST['related_entity_type']) ? substr(preg_replace('/[^a-z0-9_-]/', '', strtolower((string)$_POST['related_entity_type'])), 0, 100) : null;
        $relId = isset($_POST['related_entity_id']) ? substr((string)$_POST['related_entity_id'], 0, 36) : null;

        $conn->execute(
            'INSERT INTO remquip_file_uploads (id, original_filename, stored_filename, file_path, file_size, mime_type, upload_type, user_id, related_entity_type, related_entity_id)
             VALUES (:id, :orig, :stored, :path, :size, :mime, :ut, :uid, :ret, :rid)',
            [
                'id' => $fid,
                'orig' => substr($file['name'], 0, 255),
                'stored' => $filename,
                'path' => $publicPath,
                'size' => (int)$file['size'],
                'mime' => substr($mimeType, 0, 100),
                'ut' => $uploadTypeLabel,
                'uid' => $payload['user_id'] ?? null,
                'ret' => $relEntity,
                'rid' => $relId,
            ]
        );

        Logger::info('Generic file uploaded', ['id' => $fid, 'filename' => $filename]);
        ResponseHelper::sendSuccess(
            [
                'id' => $fid,
                'filename' => $filename,
                'url' => $publicPath,
                'size' => (int)$file['size'],
                'mime_type' => $mimeType,
            ],
            'File uploaded',
            201
        );
    } catch (Exception $e) {
        Logger::error('Generic upload error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to upload file', 500);
    }
}

// =====================================================================
// GET /uploads/files — list `file_uploads` (admin)
// =====================================================================
if ($method === 'GET' && $uploadType === 'files' && !$action) {
    Auth::requireAuth('admin');

    try {
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $total = (int)($conn->fetch('SELECT COUNT(*) AS t FROM remquip_file_uploads')['t'] ?? 0);
        $rows = $conn->fetchAll(
            'SELECT fu.*, u.full_name AS uploaded_by_name
             FROM remquip_file_uploads fu
             LEFT JOIN remquip_users u ON fu.user_id = u.id
             ORDER BY fu.created_at DESC
             LIMIT :limit OFFSET :offset',
            ['limit' => $limit, 'offset' => $offset]
        );
        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Files');
    } catch (Exception $e) {
        Logger::error('List file_uploads error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to list files', 500);
    }
}

// =====================================================================
// DELETE /uploads/files/:fileId — remove row + disk (admin)
// =====================================================================
if ($method === 'DELETE' && $uploadType === 'files' && $action) {
    Auth::requireAuth('admin');

    try {
        $row = $conn->fetch('SELECT file_path FROM remquip_file_uploads WHERE id = :id', ['id' => $action]);
        if (!$row) {
            ResponseHelper::sendError('File record not found', 404);
        }
        $url = $row['file_path'];
        $relative = preg_replace('#^/Backend/uploads/#', '', $url);
        $relative = ltrim($relative, '/');
        $filePath = $relative !== '' ? (UPLOAD_DIR . '/' . $relative) : '';
        if ($filePath !== '' && file_exists($filePath) && is_file($filePath)) {
            @unlink($filePath);
        }
        $conn->execute('DELETE FROM remquip_file_uploads WHERE id = :id', ['id' => $action]);
        ResponseHelper::sendSuccess(null, 'File removed');
    } catch (Exception $e) {
        Logger::error('Delete file_uploads error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete file', 500);
    }
}

// =====================================================================
// GET /uploads/contracts/:customerId — routeSegments: [contracts, customerId] → $id=contracts, $action=customerId
// =====================================================================
if ($method === 'GET' && $uploadType === 'contracts' && $action) {
    Auth::requireAuth('admin');

    try {
        $documents = $conn->fetchAll(
            "SELECT cd.id, cd.document_type, cd.file_url, cd.file_name, u.full_name as uploaded_by, cd.created_at
             FROM remquip_customer_documents cd
             LEFT JOIN remquip_users u ON cd.uploaded_by = u.id
             WHERE cd.customer_id = :customerId
             ORDER BY cd.created_at DESC",
            ['customerId' => $action]
        );

        ResponseHelper::sendSuccess($documents, 'Customer documents retrieved');
    } catch (Exception $e) {
        Logger::error('Get documents error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve documents', 500);
    }
}

// =====================================================================
// DELETE /uploads/:id - Delete uploaded file
// =====================================================================
if ($method === 'DELETE' && $id && !$action) {
    Auth::requireAuth('admin');
    
    try {
        // Find file in database
        $file = $conn->fetch(
            "SELECT file_url FROM remquip_customer_documents WHERE id = :id",
            ['id' => $id]
        );
        
        if (!$file) {
            ResponseHelper::sendError('File not found', 404);
        }

        // file_url like /Backend/uploads/contracts/name.pdf → under UPLOAD_DIR
        $url = $file['file_url'];
        $relative = preg_replace('#^/Backend/uploads/#', '', $url);
        $relative = ltrim($relative, '/');
        $filePath = $relative !== '' ? (UPLOAD_DIR . '/' . $relative) : '';
        if ($filePath !== '' && file_exists($filePath) && is_file($filePath)) {
            @unlink($filePath);
        }
        
        // Delete from database
        $conn->execute("DELETE FROM remquip_customer_documents WHERE id = :id", ['id' => $id]);
        
        Logger::info('File deleted', ['file_id' => $id]);
        ResponseHelper::sendSuccess(null, 'File deleted successfully');
        
    } catch (Exception $e) {
        Logger::error('Delete file error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete file', 500);
    }
}

// If none of the routes match
ResponseHelper::sendError('Upload endpoint not found', 404);
?>

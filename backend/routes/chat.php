<?php
/**
 * /chat — Live chat conversations & messages
 *
 * PUBLIC (no auth):
 *   POST /chat                  — create conversation + first message
 *   POST /chat/:id/messages     — add visitor message
 *   GET  /chat/:id/messages     — get messages for a conversation (visitor poll)
 *
 * ADMIN:
 *   GET    /chat                — list conversations (paginated)
 *   GET    /chat/:id            — single conversation with messages
 *   PATCH  /chat/:id            — update status (close)
 *   POST   /chat/:id/reply      — admin reply
 *   DELETE /chat/:id            — delete conversation
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

// ── Auto-create tables if missing ──────────────────────────────────
try {
    $conn->execute("SELECT 1 FROM remquip_chat_conversations LIMIT 1");
} catch (Exception $_) {
    $migrationFile = __DIR__ . '/../migrations/migrate-chat.sql';
    if (file_exists($migrationFile)) {
        $sql = file_get_contents($migrationFile);
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $stmt) {
            if ($stmt !== '') {
                $conn->execute($stmt);
            }
        }
        Logger::info('Chat tables auto-created from migration');
    }
}

try {

    // ════════════════════════════════════════════════════════════
    // PUBLIC: POST /chat — create conversation + first message
    // ════════════════════════════════════════════════════════════
    if ($method === 'POST' && empty($rs)) {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $message = trim($data['message'] ?? '');
        if ($message === '') {
            ResponseHelper::sendError('Message is required', 400);
        }

        $convId = $conn->fetch('SELECT UUID() AS u')['u'];
        $msgId  = $conn->fetch('SELECT UUID() AS u')['u'];

        $conn->execute(
            'INSERT INTO remquip_chat_conversations (id, visitor_name, visitor_email, language, status)
             VALUES (:id, :name, :email, :lang, "open")',
            [
                'id'    => $convId,
                'name'  => trim($data['visitor_name'] ?? '') ?: null,
                'email' => trim($data['visitor_email'] ?? '') ?: null,
                'lang'  => in_array($data['language'] ?? '', ['en', 'fr']) ? $data['language'] : 'en',
            ]
        );

        $conn->execute(
            'INSERT INTO remquip_chat_messages (id, conversation_id, sender_type, sender_name, message, is_predefined)
             VALUES (:id, :cid, "visitor", :name, :msg, :pre)',
            [
                'id'   => $msgId,
                'cid'  => $convId,
                'name' => trim($data['visitor_name'] ?? '') ?: null,
                'msg'  => $message,
                'pre'  => !empty($data['is_predefined']) ? 1 : 0,
            ]
        );

        ResponseHelper::sendSuccess([
            'conversation_id' => $convId,
            'message_id'      => $msgId,
        ], 'Conversation created', 201);
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC: POST /chat/:id/messages — visitor sends message
    // ════════════════════════════════════════════════════════════
    if ($method === 'POST' && isset($rs[0]) && ($rs[1] ?? '') === 'messages' && !isset($rs[2])) {
        $convId = $rs[0];
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $message = trim($data['message'] ?? '');
        if ($message === '') {
            ResponseHelper::sendError('Message is required', 400);
        }

        // Verify conversation exists
        $conv = $conn->fetch('SELECT id FROM remquip_chat_conversations WHERE id = :id', ['id' => $convId]);
        if (!$conv) {
            ResponseHelper::sendError('Conversation not found', 404);
        }

        $msgId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_chat_messages (id, conversation_id, sender_type, sender_name, message, is_predefined)
             VALUES (:id, :cid, "visitor", :name, :msg, :pre)',
            [
                'id'   => $msgId,
                'cid'  => $convId,
                'name' => trim($data['sender_name'] ?? '') ?: null,
                'msg'  => $message,
                'pre'  => !empty($data['is_predefined']) ? 1 : 0,
            ]
        );

        // Touch conversation updated_at
        $conn->execute('UPDATE remquip_chat_conversations SET updated_at = NOW(), status = "open" WHERE id = :id', ['id' => $convId]);

        ResponseHelper::sendSuccess(['message_id' => $msgId], 'Message sent');
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC: GET /chat/:id/messages — poll messages
    // ════════════════════════════════════════════════════════════
    if ($method === 'GET' && isset($rs[0]) && ($rs[1] ?? '') === 'messages' && !isset($rs[2])) {
        $convId = $rs[0];
        $conv = $conn->fetch('SELECT id FROM remquip_chat_conversations WHERE id = :id', ['id' => $convId]);
        if (!$conv) {
            ResponseHelper::sendError('Conversation not found', 404);
        }
        $msgs = $conn->fetchAll(
            'SELECT id, sender_type, sender_name, message, is_predefined, created_at
             FROM remquip_chat_messages WHERE conversation_id = :cid ORDER BY created_at ASC',
            ['cid' => $convId]
        );
        ResponseHelper::sendSuccess(['messages' => $msgs], 'Messages');
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN: POST /chat/:id/reply — admin reply
    // ════════════════════════════════════════════════════════════
    if ($method === 'POST' && isset($rs[0]) && ($rs[1] ?? '') === 'reply' && !isset($rs[2])) {
        Auth::requireAuth('admin');
        $convId = $rs[0];
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $message = trim($data['message'] ?? '');
        if ($message === '') {
            ResponseHelper::sendError('Message is required', 400);
        }
        $conv = $conn->fetch('SELECT id FROM remquip_chat_conversations WHERE id = :id', ['id' => $convId]);
        if (!$conv) {
            ResponseHelper::sendError('Conversation not found', 404);
        }
        $msgId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_chat_messages (id, conversation_id, sender_type, sender_name, message, is_predefined)
             VALUES (:id, :cid, "admin", :name, :msg, 0)',
            [
                'id'   => $msgId,
                'cid'  => $convId,
                'name' => trim($data['sender_name'] ?? 'Support') ?: 'Support',
                'msg'  => $message,
            ]
        );
        $conn->execute('UPDATE remquip_chat_conversations SET updated_at = NOW() WHERE id = :id', ['id' => $convId]);
        ResponseHelper::sendSuccess(['message_id' => $msgId], 'Reply sent');
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN: GET /chat/unread-count — count of open conversations with unread visitor messages
    // ════════════════════════════════════════════════════════════
    if ($method === 'GET' && ($rs[0] ?? '') === 'unread-count' && !isset($rs[1])) {
        Auth::requireAuth('admin');
        // "Unread" = open conversations where the most recent message is from a visitor
        $count = $conn->count(
            "SELECT COUNT(*) FROM remquip_chat_conversations c
             WHERE c.status = 'open'
             AND (
               SELECT m.sender_type FROM remquip_chat_messages m
               WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC LIMIT 1
             ) = 'visitor'"
        );
        ResponseHelper::sendSuccess(['count' => (int)$count], 'Unread count');
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN: GET /chat — list conversations
    // ════════════════════════════════════════════════════════════
    if ($method === 'GET' && empty($rs)) {
        Auth::requireAuth('admin');
        $status = $_GET['status'] ?? '';
        $search = trim($_GET['search'] ?? '');
        $limit  = min(100, max(1, (int)($_GET['limit'] ?? 50)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));

        $where = [];
        $params = [];
        if ($status === 'open' || $status === 'closed') {
            $where[] = 'c.status = :status';
            $params['status'] = $status;
        }
        if ($search !== '') {
            $where[] = '(c.visitor_name LIKE :q OR c.visitor_email LIKE :q)';
            $params['q'] = '%' . $search . '%';
        }
        $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $total = $conn->count("SELECT COUNT(*) FROM remquip_chat_conversations c $whereSQL", $params);

        $rows = $conn->fetchAll(
            "SELECT c.*,
                    (SELECT COUNT(*) FROM remquip_chat_messages m WHERE m.conversation_id = c.id) AS message_count,
                    (SELECT m2.message FROM remquip_chat_messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) AS last_message
             FROM remquip_chat_conversations c
             $whereSQL
             ORDER BY c.updated_at DESC
             LIMIT $limit OFFSET $offset",
            $params
        );

        ResponseHelper::sendPaginated($rows, $total, $limit, $offset, 'Chat conversations');
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN: GET /chat/:id — single conversation with messages
    // ════════════════════════════════════════════════════════════
    if ($method === 'GET' && isset($rs[0]) && !isset($rs[1])) {
        Auth::requireAuth('admin');
        $convId = $rs[0];
        $conv = $conn->fetch(
            'SELECT * FROM remquip_chat_conversations WHERE id = :id',
            ['id' => $convId]
        );
        if (!$conv) {
            ResponseHelper::sendError('Conversation not found', 404);
        }
        $msgs = $conn->fetchAll(
            'SELECT id, sender_type, sender_name, message, is_predefined, created_at
             FROM remquip_chat_messages WHERE conversation_id = :cid ORDER BY created_at ASC',
            ['cid' => $convId]
        );
        $conv['messages'] = $msgs;
        ResponseHelper::sendSuccess($conv, 'Conversation');
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN: PATCH /chat/:id — close/reopen
    // ════════════════════════════════════════════════════════════
    if (($method === 'PATCH' || $method === 'PUT') && isset($rs[0]) && !isset($rs[1])) {
        Auth::requireAuth('admin');
        $convId = $rs[0];
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $newStatus = $data['status'] ?? '';
        if (!in_array($newStatus, ['open', 'closed'])) {
            ResponseHelper::sendError('Status must be open or closed', 400);
        }
        $conn->execute(
            'UPDATE remquip_chat_conversations SET status = :s, updated_at = NOW() WHERE id = :id',
            ['s' => $newStatus, 'id' => $convId]
        );
        ResponseHelper::sendSuccess(['id' => $convId], 'Status updated');
    }

    // ════════════════════════════════════════════════════════════
    // ADMIN: DELETE /chat/:id
    // ════════════════════════════════════════════════════════════
    if ($method === 'DELETE' && isset($rs[0]) && !isset($rs[1])) {
        Auth::requireAuth('admin');
        $convId = $rs[0];
        $conn->execute('DELETE FROM remquip_chat_conversations WHERE id = :id', ['id' => $convId]);
        ResponseHelper::sendSuccess(null, 'Conversation deleted');
    }

} catch (Exception $e) {
    Logger::error('Chat error', ['error' => $e->getMessage()]);
    ResponseHelper::sendError('Chat operation failed', 500);
}

ResponseHelper::sendError('Chat endpoint not found', 404);

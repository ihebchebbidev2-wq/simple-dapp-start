<?php
// Standalone task management (admin)
//   GET    /tasks                 — list (filters: status, assigned_to=me|<uuid>, has_customer, due_before, due_after)
//   POST   /tasks                 — create (customer_id optional)
//   PATCH  /tasks/:id             — update
//   DELETE /tasks/:id             — delete
//
// Note: per-customer tasks (POST /customers/:id/tasks, etc.) continue to live in
// routes/customers.php. Both surfaces share remquip_crm_tasks.

Auth::requireAuth('admin');
$tok = Auth::getToken();
$jwtPayload = $tok ? Auth::verifyToken($tok) : null;
$me = $jwtPayload['user_id'] ?? null;

if ($method === 'GET' && !$id) {
    try {
        $where = ['1=1'];
        $params = [];
        $status = $_GET['status'] ?? null;
        if ($status && in_array($status, ['open','done','cancelled'], true)) {
            $where[] = 't.status = :status'; $params['status'] = $status;
        }
        $assignee = $_GET['assigned_to'] ?? null;
        if ($assignee === 'me' && $me) {
            $where[] = 't.assigned_to = :assignee'; $params['assignee'] = $me;
        } elseif ($assignee && $assignee !== '') {
            $where[] = 't.assigned_to = :assignee'; $params['assignee'] = $assignee;
        }
        if (isset($_GET['has_customer'])) {
            $where[] = $_GET['has_customer'] === '0' ? 't.customer_id IS NULL' : 't.customer_id IS NOT NULL';
        }
        if (!empty($_GET['due_before'])) {
            $where[] = 't.due_at <= :due_before'; $params['due_before'] = (string)$_GET['due_before'];
        }
        if (!empty($_GET['due_after'])) {
            $where[] = 't.due_at >= :due_after'; $params['due_after'] = (string)$_GET['due_after'];
        }
        $whereClause = implode(' AND ', $where);

        $rows = $conn->fetchAll(
            "SELECT t.id, t.customer_id, t.title, t.due_at, t.status, t.assigned_to,
                    t.priority, t.notes, t.created_at, t.updated_at,
                    c.company_name, c.contact_person, c.email AS customer_email,
                    c.category AS customer_category, c.contract_validated,
                    au.full_name AS assignee_name
             FROM remquip_crm_tasks t
             LEFT JOIN remquip_customers c ON c.id = t.customer_id
             LEFT JOIN remquip_users au ON au.id = t.assigned_to
             WHERE $whereClause
             ORDER BY (t.due_at IS NULL), t.due_at ASC, t.created_at DESC
             LIMIT 500",
            $params
        );
        ResponseHelper::sendSuccess($rows, 'Tasks');
    } catch (Exception $e) {
        Logger::error('List tasks error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to list tasks', 500);
    }
}

if ($method === 'POST' && !$id) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = trim((string)($data['title'] ?? ''));
        if ($title === '') ResponseHelper::sendError('Task title is required', 400);

        $dueAt = null;
        if (isset($data['due_at']) || isset($data['dueAt'])) {
            $raw = $data['due_at'] ?? $data['dueAt'];
            if ($raw !== null && trim((string)$raw) !== '') { $dueAt = (string)$raw; }
        }
        $status = trim((string)($data['status'] ?? 'open'));
        if (!in_array($status, ['open','done','cancelled'], true)) $status = 'open';
        $priority = trim((string)($data['priority'] ?? 'normal'));
        if (!in_array($priority, ['low','normal','high'], true)) $priority = 'normal';

        $assignedTo = $data['assigned_to'] ?? $data['assignedTo'] ?? null;
        if ($assignedTo !== null && trim((string)$assignedTo) === '') $assignedTo = null;

        $customerId = $data['customer_id'] ?? $data['customerId'] ?? null;
        if ($customerId !== null && trim((string)$customerId) === '') $customerId = null;

        $notes = isset($data['notes']) ? (string)$data['notes'] : null;

        $taskId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_crm_tasks
              (id, customer_id, title, due_at, status, assigned_to, priority, created_by, notes)
             VALUES
              (:id, :customerId, :title, :dueAt, :status, :assignedTo, :priority, :createdBy, :notes)",
            [
                'id' => $taskId,
                'customerId' => $customerId,
                'title' => $title,
                'dueAt' => $dueAt,
                'status' => $status,
                'assignedTo' => $assignedTo,
                'priority' => $priority,
                'createdBy' => $me,
                'notes' => $notes,
            ]
        );
        ResponseHelper::sendSuccess(['id' => $taskId], 'Task created', 201);
    } catch (Exception $e) {
        Logger::error('Create task error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create task: ' . $e->getMessage(), 500);
    }
}

if (($method === 'PATCH' || $method === 'PUT') && $id) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = []; $params = ['id' => $id];

        if (isset($data['title'])) {
            $t = trim((string)$data['title']);
            if ($t !== '') { $updates[] = 'title = :title'; $params['title'] = $t; }
        }
        if (array_key_exists('status', $data)) {
            $s = trim((string)$data['status']);
            if (in_array($s, ['open','done','cancelled'], true)) {
                $updates[] = 'status = :status'; $params['status'] = $s;
            }
        }
        if (array_key_exists('priority', $data)) {
            $p = trim((string)$data['priority']);
            if (in_array($p, ['low','normal','high'], true)) {
                $updates[] = 'priority = :priority'; $params['priority'] = $p;
            }
        }
        if (array_key_exists('due_at', $data) || array_key_exists('dueAt', $data)) {
            $raw = $data['due_at'] ?? $data['dueAt'];
            if ($raw === null || trim((string)$raw) === '') {
                $updates[] = 'due_at = NULL';
            } else {
                $updates[] = 'due_at = :dueAt'; $params['dueAt'] = (string)$raw;
            }
        }
        if (array_key_exists('assigned_to', $data) || array_key_exists('assignedTo', $data)) {
            $a = $data['assigned_to'] ?? $data['assignedTo'];
            if ($a === null || trim((string)$a) === '') {
                $updates[] = 'assigned_to = NULL';
            } else {
                $updates[] = 'assigned_to = :assignedTo'; $params['assignedTo'] = $a;
            }
        }
        if (array_key_exists('customer_id', $data) || array_key_exists('customerId', $data)) {
            $c = $data['customer_id'] ?? $data['customerId'];
            $updates[] = 'customer_id = :customer_id';
            $params['customer_id'] = ($c !== null && trim((string)$c) !== '') ? $c : null;
        }
        if (array_key_exists('notes', $data)) {
            $updates[] = 'notes = :notes';
            $params['notes'] = $data['notes'] !== null ? (string)$data['notes'] : null;
        }
        if (!$updates) ResponseHelper::sendError('No fields to update', 400);
        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_crm_tasks SET ' . implode(', ', $updates) . ' WHERE id = :id', $params);
        ResponseHelper::sendSuccess(['id' => $id], 'Task updated');
    } catch (Exception $e) {
        Logger::error('Update task error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update task', 500);
    }
}

if ($method === 'DELETE' && $id) {
    try {
        $conn->execute('DELETE FROM remquip_crm_tasks WHERE id = :id', ['id' => $id]);
        ResponseHelper::sendSuccess(null, 'Task deleted');
    } catch (Exception $e) {
        Logger::error('Delete task error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete task', 500);
    }
}

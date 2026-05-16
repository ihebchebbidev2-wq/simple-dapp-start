<?php
/**
 * ACCOUNT APPLICATIONS ROUTES
 * Public form submission + admin review/approve/reject
 */

$method = $_SERVER['REQUEST_METHOD'];

// Public endpoints: POST (submit) and GET with specific ID (view confirmation)
$isPublic = ($method === 'POST' && !$id)
         || ($method === 'GET' && $id && $id !== 'list' && !$action);

if (!$isPublic) {
    Auth::requireAuth('admin');
}

// =====================================================================
// POST /account-applications — Public: submit a new application
// =====================================================================
if ($method === 'POST' && !$id) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        // Validate required fields
        $companyName   = trim((string)($data['company_name'] ?? ''));
        $contactPerson = trim((string)($data['contact_person'] ?? ''));
        $email         = trim((string)($data['email'] ?? ''));

        if ($companyName === '' || $contactPerson === '' || $email === '') {
            ResponseHelper::sendError('Company name, contact person, and email are required', 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ResponseHelper::sendError('Valid email address is required', 400);
        }

        // Check for duplicate pending application
        $existing = $conn->fetch(
            "SELECT id FROM remquip_account_applications WHERE email = :email AND status = 'pending'",
            ['email' => $email]
        );
        if ($existing) {
            ResponseHelper::sendError('An application with this email is already pending review', 409);
        }

        $appId = $conn->fetch('SELECT UUID() AS u')['u'];

        // Distributor type
        $distributorType = null;
        if (isset($data['distributor_type']) && is_array($data['distributor_type'])) {
            $distributorType = json_encode($data['distributor_type']);
        }

        $conn->execute(
            "INSERT INTO remquip_account_applications
              (id, company_name, neq_tva, contact_person, contact_title, phone, email,
               distributor_type, distributor_type_other, num_trucks, num_trailers,
               billing_address, shipping_address,
               accounting_contact, accounting_phone, billing_email, payment_terms, payment_method,
               bank_reference, credit_limit_requested, supplier_ref_1, supplier_ref_2,
               parts_needed, special_requests, sales_representative,
               signatory_name, signatory_title, signature_date, signature_data, signature_url)
             VALUES
              (:id, :company_name, :neq_tva, :contact_person, :contact_title, :phone, :email,
               :distributor_type, :distributor_type_other, :num_trucks, :num_trailers,
               :billing_address, :shipping_address,
               :accounting_contact, :accounting_phone, :billing_email, :payment_terms, :payment_method,
               :bank_reference, :credit_limit_requested, :supplier_ref_1, :supplier_ref_2,
               :parts_needed, :special_requests, :sales_representative,
               :signatory_name, :signatory_title, :signature_date, :signature_data, :signature_url)",
            [
                'id'                     => $appId,
                'company_name'           => $companyName,
                'neq_tva'                => $data['neq_tva'] ?? null,
                'contact_person'         => $contactPerson,
                'contact_title'          => $data['contact_title'] ?? null,
                'phone'                  => $data['phone'] ?? null,
                'email'                  => $email,
                'distributor_type'       => $distributorType,
                'distributor_type_other' => $data['distributor_type_other'] ?? null,
                'num_trucks'             => isset($data['num_trucks']) ? (int)$data['num_trucks'] : null,
                'num_trailers'           => isset($data['num_trailers']) ? (int)$data['num_trailers'] : null,
                'billing_address'        => $data['billing_address'] ?? null,
                'shipping_address'       => $data['shipping_address'] ?? null,
                'accounting_contact'     => $data['accounting_contact'] ?? null,
                'accounting_phone'       => $data['accounting_phone'] ?? null,
                'billing_email'          => $data['billing_email'] ?? null,
                'payment_terms'          => $data['payment_terms'] ?? null,
                'payment_method'         => $data['payment_method'] ?? null,
                'bank_reference'         => $data['bank_reference'] ?? null,
                'credit_limit_requested' => isset($data['credit_limit_requested']) ? (float)$data['credit_limit_requested'] : null,
                'supplier_ref_1'         => $data['supplier_ref_1'] ?? null,
                'supplier_ref_2'         => $data['supplier_ref_2'] ?? null,
                'parts_needed'           => $data['parts_needed'] ?? null,
                'special_requests'       => $data['special_requests'] ?? null,
                'sales_representative'   => $data['sales_representative'] ?? null,
                'signatory_name'         => $data['signatory_name'] ?? null,
                'signatory_title'        => $data['signatory_title'] ?? null,
                'signature_date'         => $data['signature_date'] ?? null,
                'signature_data'         => $data['signature_data'] ?? null,
                'signature_url'          => $data['signature_url'] ?? null,
            ]
        );

        // Send confirmation email to applicant
        try {
            $tpl = remquip_tpl_application_received([
                'name'    => $contactPerson,
                'company' => $companyName,
                'email'   => $email,
            ]);
            remquip_send_customer_mail($conn, $email, 'Your REMQUIP Account Application Has Been Received', $tpl['html'], $tpl['text']);
        } catch (Exception $mailErr) {
            Logger::warning('Application confirmation email failed', ['error' => $mailErr->getMessage()]);
        }

        // Notify admin
        try {
            $tpl = remquip_tpl_application_admin_notification([
                'company' => $companyName,
                'contact' => $contactPerson,
                'email'   => $email,
                'phone'   => $data['phone'] ?? '',
            ]);
            $adminEmail = remquip_notification_recipient($conn);
            if ($adminEmail) {
                remquip_send_customer_mail($conn, $adminEmail, 'New Account Application: ' . $companyName, $tpl['html'], $tpl['text']);
            }
        } catch (Exception $mailErr) {
            Logger::warning('Admin notification email failed', ['error' => $mailErr->getMessage()]);
        }

        Logger::info('Account application submitted', ['id' => $appId, 'email' => $email]);
        ResponseHelper::sendSuccess(['id' => $appId], 'Application submitted successfully', 201);

    } catch (Exception $e) {
        Logger::error('Submit application error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to submit application', 500);
    }
}

// =====================================================================
// GET /account-applications/:id — Public: view a submitted application
// =====================================================================
if ($method === 'GET' && $id && $id !== 'list' && !$action) {
    try {
        $app = $conn->fetch(
            "SELECT * FROM remquip_account_applications WHERE id = :id",
            ['id' => $id]
        );

        if (!$app) {
            ResponseHelper::sendError('Application not found', 404);
        }

        // Decode distributor_type JSON for response
        if (isset($app['distributor_type']) && is_string($app['distributor_type'])) {
            $app['distributor_type'] = json_decode($app['distributor_type'], true);
        }

        ResponseHelper::sendSuccess($app, 'Application retrieved');

    } catch (Exception $e) {
        Logger::error('Get application error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve application', 500);
    }
}

// =====================================================================
// GET /account-applications (admin list) — via ?path=account-applications with no id
// Also: GET /account-applications/list for explicit list
// =====================================================================
if ($method === 'GET' && (!$id || $id === 'list')) {
    Auth::requireAuth('admin');
    try {
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $limit  = isset($_GET['limit'])  ? (int)$_GET['limit']  : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }

        $where = ['1=1'];
        $params = [];

        if ($status !== '' && in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $where[] = "status = :status";
            $params['status'] = $status;
        }

        if ($search !== '') {
            $where[] = "(company_name LIKE :search OR email LIKE :search OR contact_person LIKE :search)";
            $params['search'] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_account_applications WHERE $whereClause",
            $params
        )['total'] ?? 0;

        $params['limit'] = $limit;
        $params['offset'] = $offset;

        $apps = $conn->fetchAll(
            "SELECT id, status, company_name, contact_person, email, phone,
                    payment_terms, credit_limit_requested, created_at, updated_at
             FROM remquip_account_applications
             WHERE $whereClause
             ORDER BY FIELD(status, 'pending', 'approved', 'rejected'), created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );

        ResponseHelper::sendPaginated($apps, $total, $limit, $offset, 'Applications retrieved');

    } catch (Exception $e) {
        Logger::error('List applications error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to list applications', 500);
    }
}

// =====================================================================
// PATCH /account-applications/:id/approve — Admin: approve application
// =====================================================================
if (($method === 'PATCH' || $method === 'POST') && $id && $action === 'approve') {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $pdfUrl = $data['pdf_url'] ?? null;
        // Optional admin overrides from the approval-preview screen
        $overrides = is_array($data['overrides'] ?? null) ? $data['overrides'] : [];

        $app = $conn->fetch(
            "SELECT * FROM remquip_account_applications WHERE id = :id",
            ['id' => $id]
        );

        if (!$app) {
            ResponseHelper::sendError('Application not found', 404);
        }
        if ($app['status'] !== 'pending') {
            ResponseHelper::sendError('Application is already ' . $app['status'], 400);
        }

        // Merge overrides on top of the original application snapshot
        $app = array_merge($app, array_filter($overrides, fn($v) => $v !== null && $v !== ''));

        // Decode distributor_type for customer record
        $distType = null;
        if (isset($app['distributor_type']) && is_string($app['distributor_type'])) {
            $distType = $app['distributor_type']; // already JSON string
        }

        // Determine customer_type from distributor_type
        $customerType = 'Wholesale';
        $distArr = json_decode($distType ?? '[]', true);
        if (is_array($distArr)) {
            if (in_array('reseller', $distArr)) $customerType = 'Distributor';
            elseif (in_array('logistics', $distArr)) $customerType = 'Fleet';
        }

        // Create customer record
        $customerId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_customers
              (id, company_name, contact_person, contact_title, email, phone, customer_type,
               status, address, tax_number, neq_tva, distributor_type, num_trucks, num_trailers,
               shipping_address, accounting_contact, accounting_phone, billing_email,
               payment_terms, payment_method, bank_reference, credit_limit,
               supplier_ref_1, supplier_ref_2, parts_needed, special_requests, sales_representative,
               category, contract_validated)
             VALUES
              (:id, :company_name, :contact_person, :contact_title, :email, :phone, :customer_type,
               'active', :billing_address, :neq_tva, :neq_tva2, :distributor_type, :num_trucks, :num_trailers,
               :shipping_address, :accounting_contact, :accounting_phone, :billing_email,
               :payment_terms, :payment_method, :bank_reference, :credit_limit,
               :supplier_ref_1, :supplier_ref_2, :parts_needed, :special_requests, :sales_representative,
               'customer', 1)",
            [
                'id'                   => $customerId,
                'company_name'         => $app['company_name'],
                'contact_person'       => $app['contact_person'],
                'contact_title'        => $app['contact_title'],
                'email'                => $app['email'],
                'phone'                => $app['phone'],
                'customer_type'        => $customerType,
                'billing_address'      => $app['billing_address'],
                'neq_tva'              => $app['neq_tva'],
                'neq_tva2'             => $app['neq_tva'],
                'distributor_type'     => $distType,
                'num_trucks'           => $app['num_trucks'],
                'num_trailers'         => $app['num_trailers'],
                'shipping_address'     => $app['shipping_address'],
                'accounting_contact'   => $app['accounting_contact'],
                'accounting_phone'     => $app['accounting_phone'],
                'billing_email'        => $app['billing_email'],
                'payment_terms'        => $app['payment_terms'],
                'payment_method'       => $app['payment_method'],
                'bank_reference'       => $app['bank_reference'],
                'credit_limit'         => $app['credit_limit_requested'],
                'supplier_ref_1'       => $app['supplier_ref_1'],
                'supplier_ref_2'       => $app['supplier_ref_2'],
                'parts_needed'         => $app['parts_needed'],
                'special_requests'     => $app['special_requests'],
                'sales_representative' => $app['sales_representative'],
            ]
        );

        // Create portal user account
        $accountCreated = false;
        $tempPassword = null;
        $existingUser = $conn->fetch('SELECT id FROM remquip_users WHERE email = :e AND deleted_at IS NULL', ['e' => $app['email']]);
        if (!$existingUser) {
            $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
            $tempPassword = '';
            for ($i = 0; $i < 12; $i++) {
                $tempPassword .= $chars[random_int(0, strlen($chars) - 1)];
            }
            $userId = bin2hex(random_bytes(18));
            $conn->execute(
                "INSERT INTO remquip_users (id, email, password_hash, full_name, role, phone, status, account_origin)
                 VALUES (:id, :email, :ph, :fn, 'user', :phone, 'active', 'application')",
                [
                    'id'    => $userId,
                    'email' => $app['email'],
                    'ph'    => Auth::hashPassword($tempPassword),
                    'fn'    => $app['contact_person'],
                    'phone' => $app['phone'] ?? '',
                ]
            );
            $accountCreated = true;
        }

        // Mark application as approved
        $conn->execute(
            "UPDATE remquip_account_applications SET status = 'approved', approved_customer_id = :cid, pdf_url = :pdf, updated_at = NOW() WHERE id = :id",
            ['cid' => $customerId, 'pdf' => $pdfUrl, 'id' => $id]
        );

        // Attach PDF to customer documents if provided
        if ($pdfUrl) {
            try {
                $conn->execute(
                    "INSERT INTO remquip_customer_documents (id, customer_id, file_url, file_name, document_type, uploaded_by)
                     VALUES (UUID(), :cid, :url, :name, 'application_form', :by)",
                    [
                        'cid' => $customerId,
                        'url' => $pdfUrl,
                        'name' => 'Customer_Account_Application_' . str_replace(' ', '_', $app['company_name']) . '.pdf',
                        'by' => isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'admin_review'
                    ]
                );
            } catch (Exception $docErr) {
                Logger::warning('Failed to attach application PDF to customer', ['error' => $docErr->getMessage()]);
            }
        }

        // Send welcome email
        try {
            $siteUrl = '';
            try {
                $row = $conn->fetch("SELECT setting_value FROM remquip_settings WHERE setting_key = 'site_url' LIMIT 1");
                $siteUrl = rtrim((string)($row['setting_value'] ?? ''), '/');
            } catch (Exception $ignored) {}
            if ($siteUrl === '') { $siteUrl = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'remquip.com'); }
            $loginUrl = $siteUrl . '/login';

            if ($accountCreated && $tempPassword) {
                $tpl = remquip_tpl_welcome_customer([
                    'name'      => $app['contact_person'],
                    'email'     => $app['email'],
                    'password'  => $tempPassword,
                    'login_url' => $loginUrl,
                    'company'   => $app['company_name'],
                ]);
                remquip_send_customer_mail($conn, $app['email'], 'Your REMQUIP Account is Ready!', $tpl['html'], $tpl['text']);
            }

            // Also send approval confirmation
            $tpl = remquip_tpl_application_approved([
                'name'      => $app['contact_person'],
                'company'   => $app['company_name'],
                'login_url' => $loginUrl,
            ]);
            remquip_send_customer_mail($conn, $app['email'], 'Your REMQUIP Account Application Has Been Approved', $tpl['html'], $tpl['text']);

        } catch (Exception $mailErr) {
            Logger::warning('Approval email failed', ['error' => $mailErr->getMessage()]);
        }

        // Notify admin
        remquip_notify_new_customer($conn, $app['company_name'], $app['email']);

        Logger::info('Application approved', ['app_id' => $id, 'customer_id' => $customerId]);
        ResponseHelper::sendSuccess([
            'id' => $id,
            'customer_id' => $customerId,
            'account_created' => $accountCreated,
            'generated_email' => $accountCreated ? $app['email'] : null,
            'generated_password' => $tempPassword,
        ], 'Application approved and customer account created', 200);

    } catch (Exception $e) {
        Logger::error('Approve application error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to approve application', 500);
    }
}

// =====================================================================
// PATCH /account-applications/:id/reject — Admin: reject application
// =====================================================================
if (($method === 'PATCH' || $method === 'POST') && $id && $action === 'reject') {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $reason = trim((string)($data['reason'] ?? ''));

        $app = $conn->fetch(
            "SELECT * FROM remquip_account_applications WHERE id = :id",
            ['id' => $id]
        );

        if (!$app) {
            ResponseHelper::sendError('Application not found', 404);
        }
        if ($app['status'] !== 'pending') {
            ResponseHelper::sendError('Application is already ' . $app['status'], 400);
        }

        $conn->execute(
            "UPDATE remquip_account_applications SET status = 'rejected', rejection_reason = :reason, updated_at = NOW() WHERE id = :id",
            ['reason' => $reason !== '' ? $reason : null, 'id' => $id]
        );

        Logger::info('Application rejected', ['app_id' => $id, 'reason' => $reason]);
        ResponseHelper::sendSuccess(['id' => $id], 'Application rejected');

    } catch (Exception $e) {
        Logger::error('Reject application error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to reject application', 500);
    }
}
?>

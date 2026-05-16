<?php
/**
 * CUSTOMERS ROUTES - CRM functionality
 */

$method = $_SERVER['REQUEST_METHOD'];
// Some CRM endpoints must remain public (e.g. contact form lead capture).
$needsAdminAuth = !($method === 'POST' && $id === 'contact-leads');
if ($needsAdminAuth) {
    Auth::requireAuth('admin');
}

// GET /customers — list (also /customers/search?q=)
if ($method === 'GET' && (!$id || $id === 'search')) {
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if (isset($_GET['page'])) {
            $offset = (max(1, (int)$_GET['page']) - 1) * $limit;
        }
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        if ($id === 'search') {
            $search = trim($_GET['q'] ?? $_GET['search'] ?? '');
        }
        $type = isset($_GET['type']) ? trim($_GET['type']) : '';
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        
        $where = ['c.deleted_at IS NULL'];
        $params = [];
        
        if ($search) {
            $where[] = "(c.company_name LIKE :search OR c.email LIKE :search OR c.contact_person LIKE :search)";
            $params['search'] = "%$search%";
        }
        
        if ($type) {
            $where[] = "c.customer_type = :type";
            $params['type'] = $type;
        }
        
        if ($status) {
            $where[] = "c.status = :status";
            $params['status'] = $status;
        }
        
        $whereClause = implode(' AND ', $where);
        
        $total = $conn->fetch(
            "SELECT COUNT(*) as total FROM remquip_customers c WHERE $whereClause",
            $params
        )['total'] ?? 0;
        
        $params['limit'] = $limit;
        $params['offset'] = $offset;
        
        $customers = $conn->fetchAll(
            "SELECT c.id, c.company_name, c.contact_person, c.contact_person AS full_name,
                    c.email, c.phone, c.customer_type, c.status, c.category, c.contract_validated, c.created_at, c.updated_at
                    , c.assigned_contact_id, c.price_augmentation_percent
                    , COALESCE(os.order_count, 0) AS total_orders
                    , COALESCE(os.order_total, 0) AS total_spent
             FROM remquip_customers c
             LEFT JOIN (
                 SELECT customer_id, COUNT(*) AS order_count, SUM(total) AS order_total
                 FROM remquip_orders WHERE deleted_at IS NULL
                 GROUP BY customer_id
             ) os ON os.customer_id = c.id
             WHERE $whereClause
             ORDER BY c.created_at DESC
             LIMIT :limit OFFSET :offset",
            $params
        );
        
        ResponseHelper::sendPaginated($customers, $total, $limit, $offset, 'Customers retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get customers error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve customers', 500);
    }
}

// POST /customers/contact-leads — public (Contact page lead capture)
if ($method === 'POST' && $id === 'contact-leads') {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $subject = trim((string)($data['subject'] ?? ''));
        $message = trim((string)($data['message'] ?? ''));
        $phone = trim((string)($data['phone'] ?? ''));

        if ($name === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $message === '') {
            ResponseHelper::sendError('Name, valid email, and message are required', 400);
        }

        // Pick an owner from admin-contacts based on subject/department-ish routing.
        $desired = $subject !== '' ? $subject : ($message !== '' ? substr($message, 0, 60) : '');
        $assignedId = null;
        if ($desired !== '') {
            $row = $conn->fetch(
                'SELECT id FROM remquip_admin_contacts
                 WHERE is_available = 1 AND (department = :d OR specialization = :d)
                 ORDER BY display_order ASC, name ASC
                 LIMIT 1',
                ['d' => $desired]
            );
            $assignedId = $row['id'] ?? null;

            if (!$assignedId) {
                $row = $conn->fetch(
                    'SELECT id FROM remquip_admin_contacts
                     WHERE is_available = 1 AND (department LIKE :d OR specialization LIKE :d)
                     ORDER BY display_order ASC, name ASC
                     LIMIT 1',
                    ['d' => '%' . $desired . '%']
                );
                $assignedId = $row['id'] ?? null;
            }
        }
        if (!$assignedId) {
            $row = $conn->fetch(
                'SELECT id FROM remquip_admin_contacts WHERE is_available = 1 ORDER BY display_order ASC, name ASC LIMIT 1'
            );
            $assignedId = $row['id'] ?? null;
        }

        // Create a lead as an inactive customer.
        $customerId = $conn->fetch('SELECT UUID() AS u')['u'];
        $companyName = trim((string)($data['companyName'] ?? ''));
        if ($companyName === '') {
            $companyName = $subject !== '' ? $subject : ('Lead - ' . $name);
        }

        $conn->execute(
            "INSERT INTO remquip_customers
              (id, company_name, contact_person, email, phone, customer_type, status, address, city, province, postal_code, country, tax_number, assigned_contact_id, category)
             VALUES
              (:id, :companyName, :contactPerson, :email, :phone, :type, 'inactive', :address, :city, :province, :postalCode, :country, :taxNumber, :assignedContactId, 'lead')",
            [
                'id' => $customerId,
                'companyName' => $companyName,
                'contactPerson' => $name,
                'email' => $email,
                'phone' => $phone,
                'type' => $data['customerType'] ?? 'Wholesale',
                'address' => $data['address'] ?? '',
                'city' => $data['city'] ?? '',
                'province' => $data['province'] ?? ($data['state'] ?? ''),
                'postalCode' => $data['postalCode'] ?? ($data['postal_code'] ?? ''),
                'country' => $data['country'] ?? '',
                'taxNumber' => $data['taxNumber'] ?? ($data['tax_number'] ?? ''),
                'assignedContactId' => $assignedId,
            ]
        );

        // Internal note so the owner sees context immediately.
        $noteId = $conn->fetch('SELECT UUID() AS u')['u'];
        $noteText = "Public lead captured via Contact page.\n\nSubject: " . ($subject !== '' ? $subject : '(none)') .
            "\nFrom: " . $name . " <" . $email . ">" .
            ($phone !== '' ? "\nPhone: " . $phone : '') .
            "\n\nMessage:\n" . $message;

        $conn->execute(
            "INSERT INTO remquip_customer_notes (id, customer_id, user_id, note, is_internal)
             VALUES (:nid, :customerId, NULL, :note, 1)",
            [
                'nid' => $noteId,
                'customerId' => $customerId,
                'note' => $noteText,
            ]
        );

        ResponseHelper::sendSuccess(
            ['id' => $customerId, 'assigned_contact_id' => $assignedId],
            'Lead captured successfully',
            201
        );
    } catch (Exception $e) {
        Logger::error('Contact lead capture error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to capture lead', 500);
    }
}

// GET /customers/:id - Get customer details
if ($method === 'GET' && $id && !$action) {
    try {
        $customer = $conn->fetch(
            "SELECT * FROM remquip_customers WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        
        if (!$customer) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        
        $notes = $conn->fetchAll(
            "SELECT cn.id, cn.note, cn.is_internal, u.full_name as user, cn.created_at
             FROM remquip_customer_notes cn
             LEFT JOIN remquip_users u ON cn.user_id = u.id
             WHERE cn.customer_id = :id
             ORDER BY cn.created_at DESC",
            ['id' => $id]
        );
        
        $orders = $conn->fetchAll(
            "SELECT o.id, o.order_number, o.total, o.status, o.created_at
             FROM remquip_orders o
             WHERE o.customer_id = :id AND o.deleted_at IS NULL
             ORDER BY o.created_at DESC LIMIT 10",
            ['id' => $id]
        );
        
        $customer['notes'] = $notes;
        $customer['orders'] = $orders;
        
        ResponseHelper::sendSuccess($customer, 'Customer details retrieved');
        
    } catch (Exception $e) {
        Logger::error('Get customer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve customer', 500);
    }
}

// GET /customers/:id/orders — aligns with api.getCustomerOrders
if ($method === 'GET' && $id && $action === 'orders') {
    try {
        $orders = $conn->fetchAll(
            "SELECT o.id, o.order_number, o.customer_id, o.status, o.total, o.subtotal,
                    o.tax AS tax_amount, o.shipping AS shipping_amount, o.discount AS discount_amount,
                    o.payment_status, o.created_at AS order_date, o.created_at, o.updated_at
             FROM remquip_orders o
             WHERE o.customer_id = :cid AND o.deleted_at IS NULL
             ORDER BY o.created_at DESC",
            ['cid' => $id]
        );
        ResponseHelper::sendSuccess($orders, 'Customer orders');
    } catch (Exception $e) {
        Logger::error('Get customer orders error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve orders', 500);
    }
}

// GET /customers/:id/addresses — single billing row from customers.* (no separate address table)
if ($method === 'GET' && $id && $action === 'addresses') {
    try {
        $c = $conn->fetch(
            "SELECT id, address, city, province, postal_code, country, created_at FROM remquip_customers WHERE id = :id AND deleted_at IS NULL",
            ['id' => $id]
        );
        if (!$c) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        $rows = [];
        if (($c['address'] ?? '') !== '' || ($c['city'] ?? '') !== '') {
            $rows[] = [
                'id' => $c['id'] . ':primary',
                'customer_id' => $c['id'],
                'address_line1' => $c['address'] ?? '',
                'address_line2' => '',
                'city' => $c['city'] ?? '',
                'state' => $c['province'] ?? '',
                'postal_code' => $c['postal_code'] ?? '',
                'country' => $c['country'] ?? '',
                'is_default' => true,
                'address_type' => 'billing',
                'created_at' => $c['created_at'],
            ];
        }
        ResponseHelper::sendSuccess($rows, 'Customer addresses');
    } catch (Exception $e) {
        Logger::error('Get customer addresses error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve addresses', 500);
    }
}

// POST /customers - Create customer (Admin)
if ($method === 'POST' && !$id) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        $contactPerson = $data['contactPerson'] ?? $data['contact_person'] ?? $data['full_name'] ?? '';
        $companyName = $data['companyName'] ?? $data['company_name'] ?? '';
        if ($companyName === '') {
            $companyName = $contactPerson !== '' ? $contactPerson : 'Web Customer';
        }
        // Contact person is optional — a customer can be just a company. Require either email OR phone for reachability.
        if (empty($data['email']) && empty($data['phone'])) {
            ResponseHelper::sendError('Either email or phone is required', 400);
        }
        // Normalize empty contact person to NULL
        if (trim((string)$contactPerson) === '') {
            $contactPerson = null;
        }

        $customerId = $conn->fetch('SELECT UUID() AS u')['u'];
        $assignedContactId = $data['assigned_contact_id'] ?? $data['assignedContactId'] ?? null;
        if ($assignedContactId !== null && trim((string)$assignedContactId) === '') {
            $assignedContactId = null;
        }
        $conn->execute(
            "INSERT INTO remquip_customers
              (id, company_name, contact_person, email, accountant_email, phone, fax, website, customer_type, address, address_2, city, province, postal_code, country, tax_number, assigned_contact_id,
               neq_tva, contact_title, contact_position, distributor_type, num_trucks, num_trailers,
               billing_address, billing_address_2, billing_city, billing_province, billing_postal_code, billing_country,
               shipping_address, shipping_address_2, shipping_city, shipping_province, shipping_postal_code, shipping_country,
               accounting_contact, accounting_phone, billing_email, payment_terms, payment_method, credit_limit, sales_representative, category, lead_status_id)
             VALUES
              (:id, :companyName, :contactPerson, :email, :accountantEmail, :phone, :fax, :website, :type, :address, :address2, :city, :province, :postalCode, :country, :taxNumber, :assignedContactId,
               :neqTva, :contactTitle, :contactPosition, :distributorType, :numTrucks, :numTrailers,
               :billingAddress, :billingAddress2, :billingCity, :billingProvince, :billingPostalCode, :billingCountry,
               :shippingAddress, :shippingAddress2, :shippingCity, :shippingProvince, :shippingPostalCode, :shippingCountry,
               :accountingContact, :accountingPhone, :billingEmail, :paymentTerms, :paymentMethod, :creditLimit, :salesRep, :category, :leadStatusId)",
            [
                'id' => $customerId,
                'companyName' => $companyName,
                'contactPerson' => $contactPerson,
                'email' => (isset($data['email']) && trim((string)$data['email']) !== '') ? trim((string)$data['email']) : null,
                'accountantEmail' => (isset($data['accountant_email']) && trim((string)$data['accountant_email']) !== '') ? trim((string)$data['accountant_email']) : ((isset($data['accountantEmail']) && trim((string)$data['accountantEmail']) !== '') ? trim((string)$data['accountantEmail']) : null),
                'phone' => $data['phone'] ?? '',
                'fax' => $data['fax'] ?? null,
                'website' => $data['website'] ?? null,
                'type' => $data['customerType'] ?? $data['customer_type'] ?? 'Wholesale',
                'address' => $data['address'] ?? $data['billing_address'] ?? '',
                'address2' => $data['address_2'] ?? $data['billing_address_2'] ?? null,
                'city' => $data['city'] ?? $data['billing_city'] ?? '',
                'province' => $data['province'] ?? $data['billing_province'] ?? '',
                'postalCode' => $data['postalCode'] ?? $data['postal_code'] ?? $data['billing_postal_code'] ?? '',
                'country' => $data['country'] ?? $data['billing_country'] ?? '',
                'taxNumber' => $data['taxNumber'] ?? $data['tax_number'] ?? '',
                'assignedContactId' => $assignedContactId,
                'neqTva' => $data['neq_tva'] ?? $data['neqTva'] ?? null,
                'contactTitle' => $data['contact_title'] ?? $data['contactTitle'] ?? null,
                'contactPosition' => $data['contact_position'] ?? $data['contactPosition'] ?? null,
                'distributorType' => isset($data['distributor_type'])
                    ? (is_array($data['distributor_type']) ? json_encode($data['distributor_type'])
                        : ($data['distributor_type'] !== '' ? $data['distributor_type'] : null))
                    : null,
                'numTrucks' => isset($data['num_trucks']) ? (int)$data['num_trucks'] : null,
                'numTrailers' => isset($data['num_trailers']) ? (int)$data['num_trailers'] : null,
                'billingAddress' => $data['billing_address'] ?? $data['billingAddress'] ?? null,
                'billingAddress2' => $data['billing_address_2'] ?? null,
                'billingCity' => $data['billing_city'] ?? null,
                'billingProvince' => $data['billing_province'] ?? null,
                'billingPostalCode' => $data['billing_postal_code'] ?? null,
                'billingCountry' => $data['billing_country'] ?? null,
                'shippingAddress' => $data['shipping_address'] ?? $data['shippingAddress'] ?? null,
                'shippingAddress2' => $data['shipping_address_2'] ?? null,
                'shippingCity' => $data['shipping_city'] ?? null,
                'shippingProvince' => $data['shipping_province'] ?? null,
                'shippingPostalCode' => $data['shipping_postal_code'] ?? null,
                'shippingCountry' => $data['shipping_country'] ?? null,
                'accountingContact' => $data['accounting_contact'] ?? $data['accountingContact'] ?? null,
                'accountingPhone' => $data['accounting_phone'] ?? $data['accountingPhone'] ?? null,
                'billingEmail' => $data['billing_email'] ?? $data['billingEmail'] ?? null,
                'paymentTerms' => $data['payment_terms'] ?? $data['paymentTerms'] ?? null,
                'paymentMethod' => $data['payment_method'] ?? $data['paymentMethod'] ?? null,
                'creditLimit' => isset($data['credit_limit']) || isset($data['creditLimit']) ? (float)($data['credit_limit'] ?? $data['creditLimit']) : null,
                'salesRep' => $data['sales_representative'] ?? $data['salesRepresentative'] ?? null,
                'category' => $data['category'] ?? 'lead',
                'leadStatusId' => (isset($data['lead_status_id']) && trim((string)$data['lead_status_id']) !== '') ? $data['lead_status_id'] : ((isset($data['leadStatusId']) && trim((string)$data['leadStatusId']) !== '') ? $data['leadStatusId'] : null),
            ]
        );

        remquip_notify_new_customer($conn, $companyName, $data['email']);

        // Optionally create a portal user account and send welcome email
        $createAccount = !empty($data['create_account']);
        $tempPassword = null;
        $accountCreated = false;
        if ($createAccount) {
            $email = trim($data['email']);
            // Only create if no user with this email exists
            $existingUser = $conn->fetch('SELECT id FROM remquip_users WHERE email = :e AND deleted_at IS NULL', ['e' => $email]);
            if (!$existingUser) {
                $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
                $tempPassword = '';
                for ($i = 0; $i < 12; $i++) {
                    $tempPassword .= $chars[random_int(0, strlen($chars) - 1)];
                }
                $userId = bin2hex(random_bytes(18));
                $conn->execute(
                    "INSERT INTO remquip_users (id, email, password_hash, full_name, role, phone, status)
                     VALUES (:id, :email, :ph, :fn, 'user', :phone, 'active')",
                    [
                        'id'    => $userId,
                        'email' => $email,
                        'ph'    => Auth::hashPassword($tempPassword),
                        'fn'    => $contactPerson,
                        'phone' => $data['phone'] ?? '',
                    ]
                );
                // Build login URL from settings, fallback to a sensible default
                $siteUrl = '';
                try {
                    $row = $conn->fetch("SELECT setting_value FROM remquip_settings WHERE setting_key = 'site_url' LIMIT 1");
                    $siteUrl = rtrim((string)($row['setting_value'] ?? ''), '/');
                } catch (Exception $ignored) {}
                if ($siteUrl === '') { $siteUrl = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'remquip.com'); }
                $loginUrl = $siteUrl . '/login';
                $tpl = remquip_tpl_welcome_customer([
                    'name'      => $contactPerson,
                    'email'     => $email,
                    'password'  => $tempPassword,
                    'login_url' => $loginUrl,
                    'company'   => $companyName,
                ]);
                remquip_send_customer_mail($conn, $email, 'Your REMQUIP account is ready', $tpl['html'], $tpl['text']);
                $accountCreated = true;
                Logger::info('Portal account created for customer', ['customer_id' => $customerId, 'user_id' => $userId]);
            }
        }

        Logger::info('Customer created', ['customer_id' => $customerId]);
        ResponseHelper::sendSuccess([
            'id'              => $customerId,
            'account_created' => $accountCreated,
        ], $accountCreated ? 'Customer created and welcome email sent' : 'Customer created successfully', 201);
        
    } catch (Exception $e) {
        Logger::error('Create customer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create customer', 500);
    }
}

// PATCH/PUT /customers/:id - Update customer (Admin) — snake_case + camelCase
if (($method === 'PATCH' || $method === 'PUT') && $id && !$action) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['id' => $id];

        // Company name — admin may clear it (we'll persist empty string instead of NULL since column is NOT NULL).
        if (array_key_exists('companyName', $data) || array_key_exists('company_name', $data)) {
            $company = $data['companyName'] ?? $data['company_name'] ?? '';
            $updates[] = 'company_name = :company_name';
            $params['company_name'] = (string)($company ?? '');
        }
        // Contact person — fully optional; allow clearing.
        if (array_key_exists('contactPerson', $data) || array_key_exists('contact_person', $data) || array_key_exists('full_name', $data)) {
            $contact = $data['contactPerson'] ?? $data['contact_person'] ?? $data['full_name'] ?? '';
            $updates[] = 'contact_person = :contact_person';
            $params['contact_person'] = (string)($contact ?? '');
        }
        // Email — allow clearing. Validate format only when non-empty.
        if (array_key_exists('email', $data)) {
            $emailVal = trim((string)($data['email'] ?? ''));
            if ($emailVal !== '' && !filter_var($emailVal, FILTER_VALIDATE_EMAIL)) {
                ResponseHelper::sendError('Invalid email format', 400);
            }
            $updates[] = 'email = :email';
            // Store NULL instead of '' so the unique index allows multiple
            // customers without an email (MySQL permits multiple NULLs in UNIQUE).
            $params['email'] = $emailVal === '' ? null : $emailVal;
        }
        if (array_key_exists('phone', $data)) {
            $updates[] = 'phone = :phone';
            $params['phone'] = (string)($data['phone'] ?? '');
        }
        // Customer type — ENUM NOT NULL DEFAULT 'Wholesale'. Empty value falls back to default.
        if (array_key_exists('customerType', $data) || array_key_exists('customer_type', $data)) {
            $ctype = $data['customerType'] ?? $data['customer_type'] ?? '';
            $allowedTypes = ['Fleet','Wholesale','Distributor','Retail'];
            if ($ctype === '' || $ctype === null) {
                $ctype = 'Wholesale';
            } elseif (!in_array($ctype, $allowedTypes, true)) {
                ResponseHelper::sendError('Invalid customer_type. Allowed: ' . implode(', ', $allowedTypes), 400);
            }
            $updates[] = 'customer_type = :customer_type';
            $params['customer_type'] = $ctype;
        }
        if (isset($data['status'])) {
            $updates[] = 'status = :status';
            $params['status'] = $data['status'];
        }
        if (array_key_exists('address', $data)) {
            $updates[] = 'address = :address';
            $params['address'] = (string)($data['address'] ?? '');
        }
        if (array_key_exists('city', $data)) {
            $updates[] = 'city = :city';
            $params['city'] = (string)($data['city'] ?? '');
        }
        if (array_key_exists('province', $data) || array_key_exists('state', $data)) {
            $prov = $data['province'] ?? $data['state'] ?? '';
            $updates[] = 'province = :province';
            $params['province'] = (string)($prov ?? '');
        }
        if (array_key_exists('postalCode', $data) || array_key_exists('postal_code', $data)) {
            $pc = $data['postalCode'] ?? $data['postal_code'] ?? '';
            $updates[] = 'postal_code = :postal_code';
            $params['postal_code'] = (string)($pc ?? '');
        }
        if (array_key_exists('country', $data)) {
            $updates[] = 'country = :country';
            $params['country'] = (string)($data['country'] ?? '');
        }
        if (array_key_exists('taxNumber', $data) || array_key_exists('tax_number', $data)) {
            $tax = $data['taxNumber'] ?? $data['tax_number'] ?? '';
            $updates[] = 'tax_number = :tax_number';
            $params['tax_number'] = (string)($tax ?? '');
        }

        if (isset($data['category'])) {
            $updates[] = 'category = :category';
            $params['category'] = $data['category'];
        }
        if (array_key_exists('assigned_contact_id', $data) || array_key_exists('assignedContactId', $data)) {
            $assigned = $data['assigned_contact_id'] ?? $data['assignedContactId'] ?? null;
            $updates[] = 'assigned_contact_id = :assigned_contact_id';
            $params['assigned_contact_id'] = $assigned !== null && trim((string)$assigned) !== '' ? $assigned : null;
        }

        if (isset($data['paymentTerms']) || isset($data['payment_terms'])) {
            $updates[] = 'payment_terms = :payment_terms';
            $params['payment_terms'] = $data['payment_terms'] ?? $data['paymentTerms'];
        }
        if (isset($data['creditLimit']) || isset($data['credit_limit'])) {
            $updates[] = 'credit_limit = :credit_limit';
            $params['credit_limit'] = (float)($data['credit_limit'] ?? $data['creditLimit']);
        }

        // Additional snake_case fields from the edit form
        // NOTE: 'full_name' is NOT a real column — it maps to contact_person (handled above).
        // Only list columns that actually exist in remquip_customers.
        $simpleFields = [
            'contact_title', 'contact_position', 'fax', 'website', 'shipping_address', 'billing_address',
            'address_2', 'billing_address_2', 'billing_city', 'billing_province', 'billing_postal_code', 'billing_country',
            'shipping_address_2', 'shipping_city', 'shipping_province', 'shipping_postal_code', 'shipping_country',
            'neq_tva', 'payment_method', 'bank_reference',
            'accounting_contact', 'accounting_phone', 'billing_email', 'accountant_email',
            'supplier_ref_1', 'supplier_ref_2', 'parts_needed',
            'special_requests', 'sales_representative',
        ];
        // Lead pipeline status (nullable FK)
        if (array_key_exists('lead_status_id', $data) || array_key_exists('leadStatusId', $data)) {
            $lsid = $data['lead_status_id'] ?? $data['leadStatusId'] ?? null;
            $updates[] = 'lead_status_id = :lead_status_id';
            $params['lead_status_id'] = $lsid !== null && trim((string)$lsid) !== '' ? $lsid : null;
        }
        foreach ($simpleFields as $f) {
            if (array_key_exists($f, $data)) {
                $updates[] = "$f = :$f";
                $params[$f] = $data[$f] ?? '';
            }
        }
        // JSON fields — must store valid JSON or NULL, never empty string
        if (array_key_exists('distributor_type', $data)) {
            $updates[] = 'distributor_type = :distributor_type';
            $val = $data['distributor_type'];
            if (is_array($val)) {
                $params['distributor_type'] = json_encode($val);
            } elseif (is_string($val) && $val !== '') {
                // Validate it's valid JSON; if not, wrap as JSON string
                json_decode($val);
                $params['distributor_type'] = (json_last_error() === JSON_ERROR_NONE) ? $val : json_encode($val);
            } else {
                $params['distributor_type'] = null;
            }
        }
        // Numeric fields
        foreach (['num_trucks', 'num_trailers'] as $nf) {
            if (array_key_exists($nf, $data)) {
                $updates[] = "$nf = :$nf";
                $params[$nf] = $data[$nf] !== '' ? (int)$data[$nf] : null;
            }
        }
        // Price augmentation percentage (decimal field)
        if (array_key_exists('price_augmentation_percent', $data)) {
            $updates[] = 'price_augmentation_percent = :price_augmentation_percent';
            $params['price_augmentation_percent'] = $data['price_augmentation_percent'] !== '' && $data['price_augmentation_percent'] !== null
                ? (float)$data['price_augmentation_percent'] : 0.00;
        }
        // Contract validated flag (boolean)
        if (array_key_exists('contract_validated', $data)) {
            $updates[] = 'contract_validated = :contract_validated';
            $params['contract_validated'] = $data['contract_validated'] ? 1 : 0;
        }

        if (!$updates) {
            ResponseHelper::sendError('No fields to update', 400);
        }

        $updates[] = 'updated_at = NOW()';
        $conn->execute('UPDATE remquip_customers SET ' . implode(', ', $updates) . ' WHERE id = :id AND deleted_at IS NULL', $params);

        Logger::info('Customer updated', ['customer_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Customer updated successfully');
    } catch (Exception $e) {
        Logger::error('Update customer error', ['error' => $e->getMessage(), 'customer_id' => $id]);
        $detail = $e->getMessage();
        // Surface the actual DB column error so the frontend can display it
        if (strpos($detail, 'Column not found') !== false || strpos($detail, 'Unknown column') !== false) {
            ResponseHelper::sendError('Update failed: ' . $detail, 500);
        } else {
            ResponseHelper::sendError('Failed to update customer: ' . $detail, 500);
        }
    }
}

// DELETE /customers/:id — soft delete (aligns with api.deleteCustomer)
if ($method === 'DELETE' && $id && !$action) {
    try {
        $conn->execute('UPDATE remquip_customers SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
        Logger::info('Customer deleted (soft)', ['customer_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Customer deleted successfully');
    } catch (Exception $e) {
        Logger::error('Delete customer error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete customer', 500);
    }
}

// POST /customers/:id/notes - Add customer note (Admin)
if ($method === 'POST' && $id && $action === 'notes') {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (empty($data['note'])) {
            ResponseHelper::sendError('Note content is required', 400);
        }
        
        $tok = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        
        $noteId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_customer_notes (id, customer_id, user_id, note, is_internal) VALUES (:nid, :customerId, :userId, :note, :isInternal)",
            [
                'nid' => $noteId,
                'customerId' => $id,
                'userId' => $payload['user_id'] ?? null,
                'note' => $data['note'],
                'isInternal' => isset($data['isInternal']) ? (int)$data['isInternal'] : 1
            ]
        );
        
        Logger::info('Customer note added', ['customer_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Note added to customer');
        
    } catch (Exception $e) {
        Logger::error('Add customer note error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to add note', 500);
    }
}

// =====================================================================
// CRM TASKS (follow-ups / SLA)
// =====================================================================

// GET /customers/:id/tasks — list tasks for customer (Admin)
if ($method === 'GET' && $id && $action === 'tasks') {
    Auth::requireAuth('admin');
    try {
        $tasks = $conn->fetchAll(
            "SELECT
                t.id,
                t.title,
                t.due_at,
                t.status,
                t.assigned_to,
                ac.name AS assigned_contact_name,
                t.notes,
                t.created_at,
                t.updated_at
             FROM remquip_crm_tasks t
             LEFT JOIN remquip_admin_contacts ac ON ac.id = t.assigned_to
             WHERE t.customer_id = :customerId
             ORDER BY (t.due_at IS NULL) ASC, t.due_at ASC, t.created_at DESC",
            ['customerId' => $id]
        );
        ResponseHelper::sendSuccess($tasks, 'Customer tasks');
    } catch (Exception $e) {
        Logger::error('Get customer tasks error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve customer tasks', 500);
    }
}

// GET /customers/tasks/upcoming — pending tasks due within 48h or already overdue
if ($method === 'GET' && $id === 'tasks' && ($action === 'upcoming' || $action === 'overdue')) {
    try {
        $rows = $conn->fetchAll(
            "SELECT
                t.id,
                t.customer_id,
                t.title,
                t.due_at,
                t.status,
                t.notes,
                t.assigned_to,
                ac.name AS assigned_contact_name,
                c.company_name,
                c.contact_person,
                c.email,
                c.category AS customer_category,
                c.contract_validated
             FROM remquip_crm_tasks t
             INNER JOIN remquip_customers c ON c.id = t.customer_id AND c.deleted_at IS NULL
             LEFT JOIN remquip_admin_contacts ac ON ac.id = t.assigned_to
             WHERE t.status = 'open'
               AND t.due_at IS NOT NULL
               AND t.due_at <= DATE_ADD(NOW(), INTERVAL 48 HOUR)
             ORDER BY t.due_at ASC",
            []
        );
        ResponseHelper::sendSuccess($rows, 'Upcoming tasks');
    } catch (Exception $e) {
        Logger::error('Get upcoming tasks error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to retrieve upcoming tasks', 500);
    }
}

// POST /customers/:id/tasks — create task (Admin)
if ($method === 'POST' && $id && $action === 'tasks') {
    Auth::requireAuth('admin');
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = trim((string)($data['title'] ?? ''));
        if ($title === '') {
            ResponseHelper::sendError('Task title is required', 400);
        }

        $dueAt = null;
        if (isset($data['due_at']) || isset($data['dueAt'])) {
            $raw = $data['due_at'] ?? $data['dueAt'];
            if ($raw !== null && trim((string)$raw) !== '') {
                // Let MySQL parse ISO-8601 / datetime strings.
                $dueAt = (string)$raw;
            }
        }

        $status = trim((string)($data['status'] ?? 'open'));
        if (!in_array($status, ['open', 'done', 'cancelled'], true)) {
            $status = 'open';
        }

        $assignedTo = $data['assigned_to'] ?? $data['assignedTo'] ?? null;
        if ($assignedTo !== null && trim((string)$assignedTo) === '') {
            $assignedTo = null;
        }

        $notes = isset($data['notes']) ? (string)$data['notes'] : null;

        $tok = Auth::getToken();
        $payload = $tok ? Auth::verifyToken($tok) : null;
        $createdBy = $payload['user_id'] ?? null;
        if (!is_string($createdBy) || trim((string)$createdBy) === '') {
            $createdBy = null;
        }

        $priority = trim((string)($data['priority'] ?? 'normal'));
        if (!in_array($priority, ['low','normal','high'], true)) { $priority = 'normal'; }

        $taskId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            "INSERT INTO remquip_crm_tasks
              (id, customer_id, title, due_at, status, assigned_to, priority, created_by, notes)
             VALUES
              (:id, :customerId, :title, :dueAt, :status, :assignedTo, :priority, :createdBy, :notes)",
            [
                'id' => $taskId,
                'customerId' => $id,
                'title' => $title,
                'dueAt' => $dueAt,
                'status' => $status,
                'assignedTo' => $assignedTo,
                'priority' => $priority,
                'createdBy' => $createdBy,
                'notes' => $notes,
            ]
        );

        ResponseHelper::sendSuccess(['id' => $taskId], 'Task created', 201);
    } catch (Exception $e) {
        Logger::error('Create customer task error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create task', 500);
    }
}

// PATCH/PUT /customers/tasks/:taskId — update task (Admin)
if (($method === 'PATCH' || $method === 'PUT') && $id === 'tasks' && $action) {
    Auth::requireAuth('admin');
    $taskId = (string)$action;
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $updates = [];
        $params = ['taskId' => $taskId];

        if (isset($data['title'])) {
            $title = trim((string)$data['title']);
            if ($title !== '') {
                $updates[] = 'title = :title';
                $params['title'] = $title;
            }
        }

        if (array_key_exists('status', $data)) {
            $status = trim((string)$data['status']);
            if (in_array($status, ['open', 'done', 'cancelled'], true)) {
                $updates[] = 'status = :status';
                $params['status'] = $status;
            }
        }

        if (array_key_exists('due_at', $data) || array_key_exists('dueAt', $data)) {
            $raw = $data['due_at'] ?? $data['dueAt'];
            if ($raw === null || trim((string)$raw) === '') {
                $updates[] = 'due_at = NULL';
            } else {
                $updates[] = 'due_at = :dueAt';
                $params['dueAt'] = (string)$raw;
            }
        }

        if (array_key_exists('assigned_to', $data) || array_key_exists('assignedTo', $data)) {
            $assignedTo = $data['assigned_to'] ?? $data['assignedTo'];
            if ($assignedTo === null || trim((string)$assignedTo) === '') {
                $updates[] = 'assigned_to = NULL';
            } else {
                $updates[] = 'assigned_to = :assignedTo';
                $params['assignedTo'] = $assignedTo;
            }
        }

        if (array_key_exists('notes', $data)) {
            $updates[] = 'notes = :notes';
            $params['notes'] = $data['notes'] !== null ? (string)$data['notes'] : null;
        }

        if (array_key_exists('priority', $data)) {
            $pr = trim((string)$data['priority']);
            if (in_array($pr, ['low','normal','high'], true)) {
                $updates[] = 'priority = :priority';
                $params['priority'] = $pr;
            }
        }

        if (array_key_exists('customer_id', $data) || array_key_exists('customerId', $data)) {
            $cid = $data['customer_id'] ?? $data['customerId'] ?? null;
            $updates[] = 'customer_id = :customer_id';
            $params['customer_id'] = $cid !== null && trim((string)$cid) !== '' ? $cid : null;
        }

        if (!$updates) {
            ResponseHelper::sendError('No fields to update', 400);
        }

        $updates[] = 'updated_at = NOW()';

        $conn->execute('UPDATE remquip_crm_tasks SET ' . implode(', ', $updates) . ' WHERE id = :taskId', $params);
        ResponseHelper::sendSuccess(['id' => $taskId], 'Task updated');
    } catch (Exception $e) {
        Logger::error('Update task error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update task', 500);
    }
}

// DELETE /customers/tasks/:taskId — delete task (Admin)
if ($method === 'DELETE' && $id === 'tasks' && $action) {
    Auth::requireAuth('admin');
    $taskId = (string)$action;
    try {
        $conn->execute('DELETE FROM remquip_crm_tasks WHERE id = :taskId', ['taskId' => $taskId]);
        ResponseHelper::sendSuccess(null, 'Task deleted');
    } catch (Exception $e) {
        Logger::error('Delete task error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete task', 500);
    }
}

// =====================================================================
// POST /customers/import - Bulk import CRM contacts (Admin only)
// =====================================================================
if ($method === 'POST' && $id === 'import' && !$action) {
    Auth::requireAuth('admin');
    
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
                $customers = $data;
            } else {
                // Parse CSV
                $lines = explode("\n", $fileContent);
                $header = str_getcsv(array_shift($lines));
                $customers = [];
                foreach ($lines as $line) {
                    if (trim($line)) {
                        $values = str_getcsv($line);
                        $customers[] = array_combine($header, $values);
                    }
                }
            }
        } else {
            // JSON body
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $customers = $data['customers'] ?? [];
        }
        
        if (empty($customers)) {
            ResponseHelper::sendError('No customers to import', 400);
        }
        
        $imported = 0;
        $errors = [];
        
        foreach ($customers as $index => $customer) {
            try {
                // Validate required fields
                if (empty($customer['company_name']) || empty($customer['email'])) {
                    $errors[] = "Row $index: Missing company_name or email";
                    continue;
                }
                
                // Check if customer already exists by email
                $existing = $conn->fetch(
                    "SELECT id FROM remquip_customers WHERE email = :email",
                    ['email' => $customer['email']]
                );
                
                if ($existing) {
                    $errors[] = "Row $index: Email {$customer['email']} already exists";
                    continue;
                }

                $ctype = $customer['customer_type'] ?? 'Wholesale';
                if (!in_array($ctype, ['Fleet', 'Wholesale', 'Distributor'], true)) {
                    $ctype = 'Wholesale';
                }
                $cstatus = $customer['status'] ?? 'active';
                if (!in_array($cstatus, ['active', 'inactive', 'suspended'], true)) {
                    $cstatus = 'active';
                }
                $addr = $customer['address'] ?? $customer['billing_address'] ?? '';

                $customerId = $conn->fetch('SELECT UUID() AS u')['u'];
                $conn->execute(
                    "INSERT INTO remquip_customers (id, company_name, contact_person, email, phone, customer_type, status, address, city, province, postal_code, country)
                     VALUES (:id, :company, :contact, :email, :phone, :type, :status, :address, :city, :province, :pc, :country)",
                    [
                        'id' => $customerId,
                        'company' => $customer['company_name'],
                        'contact' => $customer['contact_person'] ?? $customer['contact'] ?? '',
                        'email' => $customer['email'],
                        'phone' => $customer['phone'] ?? '',
                        'type' => $ctype,
                        'status' => $cstatus,
                        'address' => $addr,
                        'city' => $customer['city'] ?? '',
                        'province' => $customer['province'] ?? $customer['state'] ?? '',
                        'pc' => $customer['postal_code'] ?? '',
                        'country' => $customer['country'] ?? '',
                    ]
                );

                if (!empty($customer['notes'])) {
                    $nid = $conn->fetch('SELECT UUID() AS u')['u'];
                    $conn->execute(
                        "INSERT INTO remquip_customer_notes (id, customer_id, note, is_internal) VALUES (:id, :customerId, :note, 1)",
                        ['id' => $nid, 'customerId' => $customerId, 'note' => $customer['notes']]
                    );
                }
                
                $imported++;
                Logger::info('Customer imported', ['customer_id' => $customerId, 'email' => $customer['email']]);
                
            } catch (Exception $e) {
                $errors[] = "Row $index: " . $e->getMessage();
            }
        }
        
        ResponseHelper::sendSuccess(
            ['imported' => $imported, 'total' => count($customers), 'errors' => $errors],
            "Imported $imported customers",
            201
        );
        
    } catch (Exception $e) {
        Logger::error('Customer import error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to import customers: ' . $e->getMessage(), 500);
    }
}

// =====================================================================
// GET /customers/:id/admin-password — Reveal admin password for linked user
// =====================================================================
if ($method === 'GET' && $id && $action === 'admin-password') {
    try {
        $cust = $conn->fetch('SELECT email FROM remquip_customers WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
        if (!$cust) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        $user = $conn->fetch(
            'SELECT id, email, admin_password FROM remquip_users WHERE email = :e AND deleted_at IS NULL',
            ['e' => $cust['email']]
        );
        if (!$user) {
            ResponseHelper::sendSuccess(['has_account' => false, 'admin_password' => null], 'No linked user account');
        } else {
            ResponseHelper::sendSuccess([
                'has_account' => true,
                'user_id' => $user['id'],
                'email' => $user['email'],
                'admin_password' => $user['admin_password'],
            ], 'Admin password retrieved');
        }
    } catch (Exception $e) {
        Logger::error('Get admin password error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to get admin password', 500);
    }
}

// POST /customers/:id/admin-password — Set admin password for linked user
if ($method === 'POST' && $id && $action === 'admin-password') {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $adminPwd = trim($data['admin_password'] ?? '');
        if ($adminPwd === '') {
            ResponseHelper::sendError('admin_password is required', 400);
        }
        $cust = $conn->fetch('SELECT email FROM remquip_customers WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
        if (!$cust) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        $user = $conn->fetch(
            'SELECT id FROM remquip_users WHERE email = :e AND deleted_at IS NULL',
            ['e' => $cust['email']]
        );
        if (!$user) {
            ResponseHelper::sendError('No linked user account for this customer', 404);
        }
        $conn->execute(
            'UPDATE remquip_users SET admin_password = :ap, updated_at = NOW() WHERE id = :id',
            ['ap' => $adminPwd, 'id' => $user['id']]
        );
        Logger::info('Admin password set for user', ['user_id' => $user['id'], 'customer_id' => $id]);
        ResponseHelper::sendSuccess(['admin_password' => $adminPwd], 'Admin password saved');
    } catch (Exception $e) {
        Logger::error('Set admin password error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to set admin password', 500);
    }
}

// DELETE /customers/:id/admin-password — Remove admin password
if ($method === 'DELETE' && $id && $action === 'admin-password') {
    try {
        $cust = $conn->fetch('SELECT email FROM remquip_customers WHERE id = :id AND deleted_at IS NULL', ['id' => $id]);
        if (!$cust) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        $user = $conn->fetch(
            'SELECT id FROM remquip_users WHERE email = :e AND deleted_at IS NULL',
            ['e' => $cust['email']]
        );
        if (!$user) {
            ResponseHelper::sendError('No linked user account', 404);
        }
        $conn->execute(
            'UPDATE remquip_users SET admin_password = NULL, updated_at = NOW() WHERE id = :id',
            ['id' => $user['id']]
        );
        Logger::info('Admin password removed', ['user_id' => $user['id']]);
        ResponseHelper::sendSuccess([], 'Admin password removed');
    } catch (Exception $e) {
        Logger::error('Delete admin password error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to remove admin password', 500);
    }
}

// POST /customers/:id/resend-credentials — regenerate password and email it to the customer
if ($method === 'POST' && $id && $action === 'resend-credentials') {
    Auth::requireAuth('admin');
    try {
        $cust = $conn->fetch(
            'SELECT id, company_name, contact_person, email, phone FROM remquip_customers WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$cust) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        $email = trim((string)($cust['email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ResponseHelper::sendError('Customer has no valid email address on file', 400);
        }

        // Generate a strong 12-char password (no ambiguous chars)
        $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
        $newPassword = '';
        $len = strlen($chars);
        for ($i = 0; $i < 12; $i++) {
            $newPassword .= $chars[random_int(0, $len - 1)];
        }
        $hash = Auth::hashPassword($newPassword);

        // Find (or create) a linked user account for this email
        $user = $conn->fetch(
            'SELECT id FROM remquip_users WHERE email = :e AND deleted_at IS NULL',
            ['e' => $email]
        );
        $accountCreated = false;
        if ($user) {
            $conn->execute(
                'UPDATE remquip_users SET password_hash = :ph, updated_at = NOW() WHERE id = :id',
                ['ph' => $hash, 'id' => $user['id']]
            );
        } else {
            $userId = bin2hex(random_bytes(18));
            $conn->execute(
                "INSERT INTO remquip_users (id, email, password_hash, full_name, role, phone, status)
                 VALUES (:id, :email, :ph, :fn, 'user', :phone, 'active')",
                [
                    'id'    => $userId,
                    'email' => $email,
                    'ph'    => $hash,
                    'fn'    => (string)($cust['contact_person'] ?? ''),
                    'phone' => (string)($cust['phone'] ?? ''),
                ]
            );
            $accountCreated = true;
        }

        // Login URL always points to the production portal.
        $loginUrl = 'https://remquip.ca/login';

        $tpl = remquip_tpl_welcome_customer([
            'name'      => (string)($cust['contact_person'] ?? 'there'),
            'email'     => $email,
            'password'  => $newPassword,
            'login_url' => $loginUrl,
            'company'   => (string)($cust['company_name'] ?? ''),
        ]);

        $sent = remquip_send_customer_mail(
            $conn,
            $email,
            'Your REMQUIP account credentials',
            $tpl['html'],
            $tpl['text']
        );

        if (!$sent) {
            // Password was still rotated — tell the client so they can copy/share manually.
            $smtpErr = class_exists('RemquipSmtp') && isset(RemquipSmtp::$lastError) ? RemquipSmtp::$lastError : '';
            Logger::warning('Resend credentials: email send failed', [
                'customer_id' => $id,
                'email' => $email,
                'smtp_error' => $smtpErr,
            ]);

            // Sanitize: never leak internal mailbox addresses to the client.
            $publicErr = preg_replace('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', '[hidden]', $smtpErr);
            // Friendlier message for OVH hourly quota.
            if (stripos($publicErr, 'quota exceeded') !== false || stripos($publicErr, '200 messages per hour') !== false) {
                $publicErr = 'Hourly email sending limit reached. Please try again in about an hour.';
            }

            ResponseHelper::sendError(
                'Password was regenerated but the email could not be sent. ' . ($publicErr !== '' ? $publicErr : 'Check SMTP configuration.'),
                502,
                ['password' => $newPassword, 'account_created' => $accountCreated]
            );
        }

        Logger::info('Credentials resent', [
            'customer_id'     => $id,
            'email'           => $email,
            'account_created' => $accountCreated,
        ]);
        ResponseHelper::sendSuccess(
            ['email' => $email, 'account_created' => $accountCreated],
            $accountCreated
                ? 'Portal account created and credentials emailed'
                : 'New password generated and emailed to the customer'
        );
    } catch (Exception $e) {
        Logger::error('Resend credentials error', ['error' => $e->getMessage(), 'customer_id' => $id]);
        ResponseHelper::sendError('Failed to resend credentials: ' . $e->getMessage(), 500);
    }
}

if ($method === 'DELETE' && $id && $action === 'notes' && isset($routeSegments[2])) {
    Auth::requireAuth('admin');
    $noteId = (string)$routeSegments[2];
    try {
        $conn->execute(
            'DELETE FROM remquip_customer_notes WHERE id = :noteId AND customer_id = :customerId',
            ['noteId' => $noteId, 'customerId' => $id]
        );
        Logger::info('Customer note deleted', ['note_id' => $noteId, 'customer_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Note deleted');
    } catch (Exception $e) {
        Logger::error('Delete customer note error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to delete note', 500);
    }
}

// PUT /customers/:id/notes/:noteId — update a customer note
if (($method === 'PUT' || $method === 'PATCH') && $id && $action === 'notes' && isset($routeSegments[2])) {
    Auth::requireAuth('admin');
    $noteId = (string)$routeSegments[2];
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    try {
        $updates = [];
        $params = ['noteId' => $noteId, 'customerId' => $id];
        if (array_key_exists('note', $data)) {
            $noteText = trim((string)($data['note'] ?? ''));
            if ($noteText === '') {
                ResponseHelper::sendError('Note cannot be empty', 400);
            }
            $updates[] = 'note = :note';
            $params['note'] = $noteText;
        }
        if (array_key_exists('isInternal', $data) || array_key_exists('is_internal', $data)) {
            $isInternal = $data['isInternal'] ?? $data['is_internal'];
            $updates[] = 'is_internal = :is_internal';
            $params['is_internal'] = $isInternal ? 1 : 0;
        }
        if (empty($updates)) {
            ResponseHelper::sendError('No fields to update', 400);
        }
        $sql = 'UPDATE remquip_customer_notes SET ' . implode(', ', $updates)
             . ' WHERE id = :noteId AND customer_id = :customerId';
        $conn->execute($sql, $params);
        Logger::info('Customer note updated', ['note_id' => $noteId, 'customer_id' => $id]);
        ResponseHelper::sendSuccess(null, 'Note updated');
    } catch (Exception $e) {
        Logger::error('Update customer note error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to update note', 500);
    }
}

// POST /customers/:id/convert-to-customer — convert a lead to customer
if ($method === 'POST' && $id && $action === 'convert-to-customer') {
    Auth::requireAuth('admin');
    try {
        $cust = $conn->fetch(
            'SELECT id, category FROM remquip_customers WHERE id = :id AND deleted_at IS NULL',
            ['id' => $id]
        );
        if (!$cust) {
            ResponseHelper::sendError('Customer not found', 404);
        }
        if ($cust['category'] !== 'lead') {
            ResponseHelper::sendError('Only leads can be converted to customers', 400);
        }
        $conn->execute(
            "UPDATE remquip_customers SET category = 'customer', status = 'active', updated_at = NOW() WHERE id = :id",
            ['id' => $id]
        );
        Logger::info('Lead converted to customer', ['customer_id' => $id]);
        ResponseHelper::sendSuccess(['id' => $id], 'Lead converted to customer');
    } catch (Exception $e) {
        Logger::error('Convert lead error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to convert lead', 500);
    }
}
?>

<?php
/**
 * STRIPE ROUTES — Stripe Checkout integration
 *
 * POST /stripe/create-checkout-session  — Create a Stripe Checkout Session for an order
 * POST /stripe/webhook                  — Stripe webhook receiver (signature-verified)
 */

$method = $_SERVER['REQUEST_METHOD'];

// ──────────────────────────────────────────────
// POST /stripe/create-checkout-session
// ──────────────────────────────────────────────
if ($method === 'POST' && ($id === 'create-checkout-session' || ($routeSegments[0] ?? '') === 'create-checkout-session')) {

    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $orderId = $data['order_id'] ?? null;

        if (!$orderId) {
            ResponseHelper::sendError('order_id is required', 400);
        }

        // 1. Load order from DB (server-side prices, NEVER trust frontend)
        $order = $conn->fetch(
            'SELECT id, order_number, subtotal, tax, shipping, total, customer_id, status, stripe_session_id, tax_breakdown
             FROM remquip_orders WHERE id = :id AND deleted_at IS NULL',
            ['id' => $orderId]
        );

        if (!$order) {
            ResponseHelper::sendError('Order not found', 404);
        }

        // Prevent duplicate sessions
        if (!empty($order['stripe_session_id'])) {
            // Return the existing session for the order
            ResponseHelper::sendSuccess([
                'sessionId' => $order['stripe_session_id'],
                'message' => 'Existing session returned',
            ], 'Checkout session already exists');
        }

        // 2. Load line items from DB
        $items = $conn->fetchAll(
            'SELECT oi.quantity, oi.unit_price, oi.line_total, p.name as product_name
             FROM remquip_order_items oi
             LEFT JOIN remquip_products p ON oi.product_id = p.id
             WHERE oi.order_id = :id',
            ['id' => $orderId]
        );

        if (empty($items)) {
            ResponseHelper::sendError('Order has no items', 400);
        }

        // 3. Build Stripe line_items from DB data
        $lineItems = [];
        foreach ($items as $item) {
            $lineItems[] = [
                'price_data' => [
                    'currency' => strtolower(defined('CURRENCY_CODE') ? CURRENCY_CODE : 'cad'),
                    'product_data' => [
                        'name' => $item['product_name'] ?: 'Product',
                    ],
                    'unit_amount' => (int)round((float)$item['unit_price'] * 100), // cents
                ],
                'quantity' => (int)$item['quantity'],
            ];
        }

        // Add tax line items — use breakdown if available, else single line
        $taxBreakdown = !empty($order['tax_breakdown']) ? json_decode($order['tax_breakdown'], true) : null;
        if (is_array($taxBreakdown) && count($taxBreakdown) > 0) {
            foreach ($taxBreakdown as $tb) {
                $tbAmount = (float)($tb['amount'] ?? 0);
                if ($tbAmount > 0) {
                    $tbName = ($tb['label_en'] ?? $tb['name'] ?? 'Tax') . ' (' . rtrim(rtrim(number_format((float)($tb['rate'] ?? 0), 3), '0'), '.') . '%)';
                    $lineItems[] = [
                        'price_data' => [
                            'currency' => strtolower(defined('CURRENCY_CODE') ? CURRENCY_CODE : 'cad'),
                            'product_data' => ['name' => $tbName],
                            'unit_amount' => (int)round($tbAmount * 100),
                        ],
                        'quantity' => 1,
                    ];
                }
            }
        } else {
            $taxAmount = (float)$order['tax'];
            if ($taxAmount > 0) {
                $lineItems[] = [
                    'price_data' => [
                        'currency' => strtolower(defined('CURRENCY_CODE') ? CURRENCY_CODE : 'cad'),
                        'product_data' => ['name' => 'Tax (GST/QST)'],
                        'unit_amount' => (int)round($taxAmount * 100),
                    ],
                    'quantity' => 1,
                ];
            }
        }

        // Add shipping as a separate line item if > 0
        $shippingAmount = (float)$order['shipping'];
        if ($shippingAmount > 0) {
            $lineItems[] = [
                'price_data' => [
                    'currency' => strtolower(defined('CURRENCY_CODE') ? CURRENCY_CODE : 'cad'),
                    'product_data' => [
                        'name' => 'Shipping',
                    ],
                    'unit_amount' => (int)round($shippingAmount * 100),
                ],
                'quantity' => 1,
            ];
        }

        // 4. Get customer email
        $customer = $conn->fetch(
            'SELECT email FROM remquip_customers WHERE id = :id',
            ['id' => $order['customer_id']]
        );
        $customerEmail = $customer['email'] ?? null;

        // 5. Build the success/cancel URLs
        $frontendUrl = defined('FRONTEND_URL') ? FRONTEND_URL : 'http://localhost:5173';
        $successUrl = $frontendUrl . '/payment-success?session_id={CHECKOUT_SESSION_ID}&order_id=' . urlencode($order['id']) . '&order_num=' . urlencode($order['order_number']);
        $cancelUrl  = $frontendUrl . '/payment-cancel?order_id=' . urlencode($orderId);

        // 6. Create Stripe Checkout Session via cURL
        $stripePayload = [
            'payment_method_types[]' => 'card',
            'mode'                   => 'payment',
            'success_url'            => $successUrl,
            'cancel_url'             => $cancelUrl,
            'metadata[order_id]'     => $orderId,
            'metadata[order_number]' => $order['order_number'],
        ];

        // Add customer email if available
        if ($customerEmail && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            $stripePayload['customer_email'] = $customerEmail;
        }

        // Add line items
        foreach ($lineItems as $idx => $li) {
            $stripePayload["line_items[$idx][price_data][currency]"]                = $li['price_data']['currency'];
            $stripePayload["line_items[$idx][price_data][product_data][name]"]      = $li['price_data']['product_data']['name'];
            $stripePayload["line_items[$idx][price_data][unit_amount]"]             = $li['price_data']['unit_amount'];
            $stripePayload["line_items[$idx][quantity]"]                            = $li['quantity'];
        }

        $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($stripePayload),
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . STRIPE_SECRET_KEY,
            ],
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            Logger::error('Stripe cURL error', ['error' => $curlError]);
            ResponseHelper::sendError('Payment gateway connection error', 502);
        }

        $session = json_decode($response, true);

        if ($httpCode !== 200 || !isset($session['id'])) {
            Logger::error('Stripe session creation failed', [
                'http_code' => $httpCode,
                'response'  => $session,
            ]);
            $errMsg = $session['error']['message'] ?? 'Failed to create checkout session';
            ResponseHelper::sendError($errMsg, 500);
        }

        // 7. Store the session ID on the order
        $conn->execute(
            'UPDATE remquip_orders SET stripe_session_id = :sid, updated_at = NOW() WHERE id = :id',
            ['sid' => $session['id'], 'id' => $orderId]
        );

        Logger::info('Stripe checkout session created', [
            'order_id'   => $orderId,
            'session_id' => $session['id'],
        ]);

        ResponseHelper::sendSuccess([
            'sessionId' => $session['id'],
            'url'       => $session['url'] ?? null,
        ], 'Checkout session created');

    } catch (Exception $e) {
        Logger::error('Stripe create-checkout-session error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to create checkout session', 500);
    }
}

// ──────────────────────────────────────────────
// POST /stripe/webhook
// ──────────────────────────────────────────────
if ($method === 'POST' && ($id === 'webhook' || ($routeSegments[0] ?? '') === 'webhook')) {

    $payload   = @file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

    // Verify signature (if webhook secret is set)
    $webhookSecret = defined('STRIPE_WEBHOOK_SECRET') ? STRIPE_WEBHOOK_SECRET : '';

    if ($webhookSecret && $webhookSecret !== 'whsec_PLACEHOLDER' && $sigHeader) {
        // Parse the signature header
        $sigParts = [];
        foreach (explode(',', $sigHeader) as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) === 2) {
                $sigParts[$kv[0]] = $kv[1];
            }
        }

        $timestamp = $sigParts['t'] ?? '';
        $signature = $sigParts['v1'] ?? '';

        if (!$timestamp || !$signature) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signature header']);
            exit;
        }

        // Verify tolerance (5 min)
        if (abs(time() - (int)$timestamp) > 300) {
            http_response_code(400);
            echo json_encode(['error' => 'Timestamp too old']);
            exit;
        }

        // Compute expected signature
        $signedPayload = $timestamp . '.' . $payload;
        $expectedSig = hash_hmac('sha256', $signedPayload, $webhookSecret);

        if (!hash_equals($expectedSig, $signature)) {
            http_response_code(400);
            echo json_encode(['error' => 'Signature mismatch']);
            exit;
        }
    }

    $event = json_decode($payload, true);
    if (!$event || !isset($event['type'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid event']);
        exit;
    }

    Logger::info('Stripe webhook received', ['type' => $event['type']]);

    switch ($event['type']) {
        case 'checkout.session.completed':
            $session = $event['data']['object'] ?? [];
            $orderId = $session['metadata']['order_id'] ?? null;
            $paymentIntentId = $session['payment_intent'] ?? null;

            if ($orderId) {
                try {
                    // Mark order as paid AND confirm the order (was pending_payment)
                    $conn->execute(
                        'UPDATE remquip_orders
                         SET payment_status = :ps,
                             status = :st,
                             stripe_payment_intent_id = :pi,
                             paid_at = NOW(),
                             updated_at = NOW()
                         WHERE id = :id AND deleted_at IS NULL',
                        [
                            'ps' => 'paid',
                            'st' => 'processing',
                            'pi' => $paymentIntentId,
                            'id' => $orderId,
                        ]
                    );

                    Logger::info('Order marked as paid via Stripe webhook', [
                        'order_id'          => $orderId,
                        'payment_intent_id' => $paymentIntentId,
                    ]);

                    // Send order confirmation email
                    require_once __DIR__ . '/../helpers.php';
                    remquip_notify_order_paid_to_customer($conn, $orderId);

                    // Deduct stock now that payment is confirmed
                    remquip_deduct_stock_for_order($conn, $orderId);

                } catch (Exception $e) {
                    Logger::error('Webhook: failed to update order', [
                        'order_id' => $orderId,
                        'error'    => $e->getMessage(),
                    ]);
                }
            }
            break;

        case 'checkout.session.expired':
            $session = $event['data']['object'] ?? [];
            $orderId = $session['metadata']['order_id'] ?? null;
            if ($orderId) {
                try {
                    $conn->execute(
                        'UPDATE remquip_orders SET payment_status = :ps, updated_at = NOW() WHERE id = :id AND deleted_at IS NULL',
                        ['ps' => 'expired', 'id' => $orderId]
                    );
                    Logger::info('Order payment expired', ['order_id' => $orderId]);
                } catch (Exception $e) {
                    Logger::error('Webhook: failed to expire order', ['error' => $e->getMessage()]);
                }
            }
            break;

        default:
            // Unhandled event type — acknowledge
            break;
    }

    http_response_code(200);
    echo json_encode(['received' => true]);
    exit;
}

// ──────────────────────────────────────────────
// GET /stripe/verify-session?session_id=...
// (Optional: frontend can verify payment was successful)
// ──────────────────────────────────────────────
if ($method === 'GET' && ($id === 'verify-session' || ($routeSegments[0] ?? '') === 'verify-session')) {

    $sessionId = $_GET['session_id'] ?? '';
    if (!$sessionId) {
        ResponseHelper::sendError('session_id is required', 400);
    }

    // Look up order by session ID
    $order = $conn->fetch(
        'SELECT id, order_number, payment_status, stripe_payment_intent_id, paid_at
         FROM remquip_orders WHERE stripe_session_id = :sid AND deleted_at IS NULL',
        ['sid' => $sessionId]
    );

    if (!$order) {
        ResponseHelper::sendError('Session not found', 404);
    }

    ResponseHelper::sendSuccess([
        'order_id'       => $order['id'],
        'order_number'   => $order['order_number'],
        'payment_status' => $order['payment_status'],
        'paid_at'        => $order['paid_at'],
    ], 'Session verified');
}

ResponseHelper::sendError('Stripe endpoint not found', 404);

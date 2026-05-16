<?php
/**
 * INTEGRATIONS — QuickBooks, Amazon SP-API, eBay
 *
 * GET    /integrations                          → list all (admin)
 * GET    /integrations/:provider                → fetch one provider
 * GET    /integrations/:provider/logs           → recent activity logs
 * GET    /integrations/:provider/mappings       → field/sku mappings
 * PUT    /integrations/:provider                → upsert credentials/config
 * POST   /integrations/:provider/connect        → start connection / save tokens (stub)
 * POST   /integrations/:provider/disconnect     → wipe tokens, mark disconnected
 * POST   /integrations/:provider/test           → ping external API (stub-safe)
 * POST   /integrations/:provider/sync           → trigger sync action (stub-safe)
 * POST   /integrations/:provider/webhook        → public webhook receiver (no auth)
 *
 * Real API calls are intentionally STUBBED so the UI works end-to-end now,
 * with clear TODO markers to drop in OAuth + REST calls later.
 */

$method  = $_SERVER['REQUEST_METHOD'];
$ALLOWED = ['quickbooks', 'amazon', 'ebay'];
$extra   = $routeSegments[2] ?? null; // 4th URL segment, e.g. /integrations/quickbooks/oauth/<extra>

// ---------------------------------------------------------------------
// Public webhook endpoint (no admin auth) — providers POST/GET here
//
// Supports:
//   • eBay  GET  ?challenge_code=...   → returns { challengeResponse: sha256(challenge_code + verification_token + endpoint_url) }
//   • QBO   POST + intuit-signature    → HMAC-SHA256 verified against credentials.webhook_verifier_token
//   • Amazon POST                      → currently logged (real flow uses SNS subscription confirmation, see TODO)
// ---------------------------------------------------------------------
if ($id && in_array($id, $ALLOWED, true) && $action === 'webhook') {
    try {
        $integration = $conn->fetch(
            'SELECT id, credentials FROM remquip_integrations WHERE provider = :p',
            ['p' => $id]
        );
        $integrationId = $integration['id'] ?? null;
        $creds         = $integration && $integration['credentials']
            ? (json_decode($integration['credentials'], true) ?: [])
            : [];

        // -----------------------------------------------------------------
        // 1) eBay marketplace account deletion — GET challenge handshake
        // Docs: https://developer.ebay.com/marketplace-account-deletion
        // -----------------------------------------------------------------
        if ($method === 'GET' && $id === 'ebay' && isset($_GET['challenge_code'])) {
            $challengeCode     = (string) $_GET['challenge_code'];
            $verificationToken = (string) ($creds['webhook_verification_token'] ?? '');
            // Endpoint URL MUST be the exact URL eBay calls — protocol + host + path (no querystring).
            $scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host     = $_SERVER['HTTP_HOST'] ?? '';
            $uriPath  = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
            $endpoint = $scheme . '://' . $host . $uriPath;

            if ($verificationToken === '') {
                if ($integrationId) {
                    integrations_log($conn, $integrationId, 'ebay', 'webhook_challenge', 'error',
                        'webhook_verification_token not set in credentials');
                }
                http_response_code(412);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'webhook_verification_token missing in eBay credentials']);
                exit;
            }

            $hash = hash('sha256', $challengeCode . $verificationToken . $endpoint);

            if ($integrationId) {
                integrations_log($conn, $integrationId, 'ebay', 'webhook_challenge', 'success',
                    'Responded to eBay challenge', ['endpoint' => $endpoint]);
            }
            // eBay expects the raw JSON body { "challengeResponse": "<hash>" }
            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['challengeResponse' => $hash]);
            exit;
        }

        // -----------------------------------------------------------------
        // 2) POST notifications
        // -----------------------------------------------------------------
        if ($method === 'POST') {
            $body    = file_get_contents('php://input') ?: '';
            $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
            // Normalise headers to lowercase keys for portable lookup
            $headersLc = [];
            foreach ($headers as $k => $v) { $headersLc[strtolower((string)$k)] = $v; }

            // -----------------------------------------------------------------
            // QBO signature verification
            // intuit-signature header is base64(HMAC-SHA256(payload, verifier_token))
            // -----------------------------------------------------------------
            if ($id === 'quickbooks') {
                $sig             = (string) ($headersLc['intuit-signature'] ?? '');
                $verifierToken   = (string) ($creds['webhook_verifier_token'] ?? '');

                if ($verifierToken === '') {
                    if ($integrationId) {
                        integrations_log($conn, $integrationId, 'quickbooks', 'webhook', 'error',
                            'webhook_verifier_token not configured');
                    }
                    http_response_code(412);
                    echo json_encode(['error' => 'webhook_verifier_token missing in QuickBooks credentials']);
                    exit;
                }

                $expected = base64_encode(hash_hmac('sha256', $body, $verifierToken, true));
                if (!hash_equals($expected, $sig)) {
                    if ($integrationId) {
                        integrations_log($conn, $integrationId, 'quickbooks', 'webhook', 'error',
                            'Invalid intuit-signature', ['received' => substr($sig, 0, 40)]);
                    }
                    http_response_code(401);
                    echo json_encode(['error' => 'Invalid signature']);
                    exit;
                }
            }

            // -----------------------------------------------------------------
            // eBay POST notifications (post-handshake) signature
            // x-ebay-signature header: SHA-256(payload + verification_token + endpoint_url) base64
            // -----------------------------------------------------------------
            if ($id === 'ebay' && isset($headersLc['x-ebay-signature'])) {
                $verificationToken = (string) ($creds['webhook_verification_token'] ?? '');
                $scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host     = $_SERVER['HTTP_HOST'] ?? '';
                $uriPath  = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
                $endpoint = $scheme . '://' . $host . $uriPath;
                $expected = base64_encode(hash('sha256', $body . $verificationToken . $endpoint, true));
                $sig      = (string) $headersLc['x-ebay-signature'];
                if ($verificationToken !== '' && !hash_equals($expected, $sig)) {
                    if ($integrationId) {
                        integrations_log($conn, $integrationId, 'ebay', 'webhook', 'error',
                            'Invalid x-ebay-signature');
                    }
                    http_response_code(401);
                    echo json_encode(['error' => 'Invalid signature']);
                    exit;
                }
            }

            // TODO: Amazon — verify SNS SubscriptionConfirmation (auto-confirm by GETting SubscribeURL)
            //       and validate Signature/SigningCertURL on Notification messages.

            if ($integrationId) {
                integrations_log($conn, $integrationId, $id, 'webhook', 'info',
                    'Webhook accepted', ['raw' => substr($body, 0, 4000)]);
            }

            // -----------------------------------------------------------------
            // QBO entity event router — fan out to QboSyncService for each
            // affected entity in the notification.
            // -----------------------------------------------------------------
            if ($id === 'quickbooks') {
                try {
                    require_once __DIR__ . '/../integrations/QboSyncService.php';
                    $svc = new QboSyncService($conn);
                    $payload = json_decode($body, true) ?: [];
                    foreach (($payload['eventNotifications'] ?? []) as $note) {
                        foreach (($note['dataChangeEvent']['entities'] ?? []) as $ent) {
                            $type   = (string) ($ent['name'] ?? '');
                            $extId  = (string) ($ent['id']   ?? '');
                            if (!$type || !$extId) continue;
                            try {
                                switch ($type) {
                                    case 'Customer': $svc->pullSingleCustomer($extId); break;
                                    case 'Item':     $svc->pullSingleItem($extId);     break;
                                    case 'Invoice':  $svc->pullSingleInvoice($extId);  break;
                                    case 'Estimate': $svc->pullSingleEstimate($extId); break;
                                    case 'Payment':  $svc->pullSinglePayment($extId);  break;
                                }
                            } catch (Throwable $e) {
                                if ($integrationId) {
                                    integrations_log($conn, $integrationId, 'quickbooks', 'webhook_entity', 'error',
                                        "Failed to sync {$type}#{$extId}: " . $e->getMessage());
                                }
                            }
                        }
                    }
                } catch (Throwable $e) {
                    Logger::error('QBO webhook router error', ['err' => $e->getMessage()]);
                }
            }

            ResponseHelper::sendSuccess(['received' => true], 'Webhook accepted');
        }

        // Method not handled (e.g. GET on quickbooks/amazon webhook)
        http_response_code(405);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    } catch (Exception $e) {
        Logger::error('Integration webhook error', ['provider' => $id, 'error' => $e->getMessage()]);
        ResponseHelper::sendError('Webhook processing failed', 500);
    }
}

Auth::requireAuth('admin');

// ---------------------------------------------------------------------
// GET /integrations  — list all
// ---------------------------------------------------------------------
if ($method === 'GET' && !$id) {
    try {
        $rows = $conn->fetchAll(
            'SELECT id, provider, display_name, environment, status, is_enabled,
                    connected_at, last_sync_at, last_error, token_expires_at, config,
                    created_at, updated_at
             FROM remquip_integrations
             ORDER BY provider'
        ) ?: [];
        foreach ($rows as &$r) {
            $r['config']          = $r['config'] ? json_decode($r['config'], true) : new stdClass();
            try {
                $r['has_credentials'] = !empty(integrations_creds($conn, $r['provider']));
            } catch (Throwable $credsEx) {
                // Don't let a credential lookup blow up the whole list.
                $r['has_credentials'] = false;
            }
        }
        unset($r);
        ResponseHelper::sendSuccess($rows, 'Integrations');
    } catch (Throwable $e) {
        Logger::error('Integrations list error', [
            'error' => $e->getMessage(),
            'file'  => $e->getFile(),
            'line'  => $e->getLine(),
        ]);
        // Forward the real error in `details` so we can diagnose from the frontend.
        ResponseHelper::sendError('Failed to load integrations', 500, [
            'error' => $e->getMessage(),
            'file'  => $e->getFile(),
            'line'  => $e->getLine(),
        ]);
    }
}

// ---------------------------------------------------------------------
// GET /integrations/:provider — fetch one
// ---------------------------------------------------------------------
if ($method === 'GET' && $id && in_array($id, $ALLOWED, true) && !$action) {
    try {
        $row = $conn->fetch(
            'SELECT id, provider, display_name, environment, status, is_enabled,
                    connected_at, last_sync_at, last_error, token_expires_at, config, credentials,
                    created_at, updated_at
             FROM remquip_integrations WHERE provider = :p',
            ['p' => $id]
        );
        if (!$row) {
            ResponseHelper::sendError('Integration not found', 404);
        }
        $row['config']      = $row['config'] ? json_decode($row['config'], true) : new stdClass();
        // Mask secrets — never return raw tokens
        $creds              = $row['credentials'] ? json_decode($row['credentials'], true) : [];
        $row['credentials'] = integrations_mask_credentials($creds);
        ResponseHelper::sendSuccess($row, 'Integration');
    } catch (Exception $e) {
        Logger::error('Integration fetch error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to fetch integration', 500);
    }
}

// ---------------------------------------------------------------------
// GET /integrations/:provider/logs
// ---------------------------------------------------------------------
if ($method === 'GET' && $id && in_array($id, $ALLOWED, true) && $action === 'logs') {
    try {
        $rows = $conn->fetchAll(
            'SELECT id, action, status, message, items_processed, items_failed, duration_ms, created_at
             FROM remquip_integration_logs WHERE provider = :p ORDER BY created_at DESC LIMIT 100',
            ['p' => $id]
        );
        ResponseHelper::sendSuccess($rows, 'Logs');
    } catch (Exception $e) {
        ResponseHelper::sendError('Failed to load logs', 500);
    }
}

// ---------------------------------------------------------------------
// GET /integrations/:provider/mappings
// ---------------------------------------------------------------------
if ($method === 'GET' && $id && in_array($id, $ALLOWED, true) && $action === 'mappings') {
    try {
        $integration = integrations_get($conn, $id);
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);
        $rows = $conn->fetchAll(
            'SELECT id, entity_type, local_id, external_id, last_synced_at
             FROM remquip_integration_mappings WHERE integration_id = :i
             ORDER BY entity_type, local_id LIMIT 500',
            ['i' => $integration['id']]
        );
        ResponseHelper::sendSuccess($rows, 'Mappings');
    } catch (Exception $e) {
        ResponseHelper::sendError('Failed to load mappings', 500);
    }
}

// ---------------------------------------------------------------------
// PUT /integrations/:provider — upsert credentials/config/environment/enabled
// ---------------------------------------------------------------------
if (($method === 'PUT' || $method === 'PATCH') && $id && in_array($id, $ALLOWED, true) && !$action) {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $integration = integrations_get($conn, $id);
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);

        $existingCreds = $integration['credentials'] ? json_decode($integration['credentials'], true) : [];
        $existingConf  = $integration['config']      ? json_decode($integration['config'], true)      : [];

        // Merge new credentials over old ones (so partial updates work)
        $newCreds = isset($data['credentials']) && is_array($data['credentials'])
            ? array_merge($existingCreds, $data['credentials'])
            : $existingCreds;
        $newConf  = isset($data['config']) && is_array($data['config'])
            ? array_merge($existingConf, $data['config'])
            : $existingConf;

        $env       = isset($data['environment']) ? preg_replace('/[^a-z]/', '', (string)$data['environment']) : $integration['environment'];
        if (!in_array($env, ['sandbox', 'production'], true)) $env = 'sandbox';
        $isEnabled = isset($data['is_enabled']) ? (int)(bool)$data['is_enabled'] : (int)$integration['is_enabled'];
        $name      = isset($data['display_name']) ? substr((string)$data['display_name'], 0, 120) : $integration['display_name'];

        $conn->execute(
            'UPDATE remquip_integrations
             SET display_name = :n, environment = :e, is_enabled = :en, credentials = :c, config = :cf, updated_at = NOW()
             WHERE provider = :p',
            [
                'n'  => $name,
                'e'  => $env,
                'en' => $isEnabled,
                'c'  => json_encode($newCreds, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'cf' => json_encode($newConf,  JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'p'  => $id,
            ]
        );

        integrations_log($conn, $integration['id'], $id, 'config_update', 'success', 'Credentials/config updated');
        $row = integrations_get($conn, $id);
        $row['credentials'] = integrations_mask_credentials(json_decode($row['credentials'] ?? '[]', true));
        $row['config']      = $row['config'] ? json_decode($row['config'], true) : new stdClass();
        ResponseHelper::sendSuccess($row, 'Integration saved');
    } catch (Exception $e) {
        Logger::error('Integration save error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to save integration', 500);
    }
}

// ---------------------------------------------------------------------
// GET /integrations/quickbooks/oauth/start
// Builds the Intuit authorize URL and returns it to the frontend so it can
// redirect the user. We store a CSRF `state` token in the integration row
// (config.oauth_state) and verify it on callback.
// ---------------------------------------------------------------------
if ($method === 'GET' && $id === 'quickbooks' && $action === 'oauth' && ($extra ?? null) === 'start') {
    try {
        $integration = integrations_get($conn, 'quickbooks');
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);
        $creds = $integration['credentials'] ? json_decode($integration['credentials'], true) : [];
        $conf  = $integration['config']      ? json_decode($integration['config'], true)      : [];

        $clientId    = $creds['client_id']    ?? (defined('QBO_CLIENT_ID')    ? QBO_CLIENT_ID    : '');
        $canonicalRedirectUri = defined('QBO_REDIRECT_URI') ? (string) QBO_REDIRECT_URI : '';
        $requestedRedirectUri = trim((string)($_GET['redirect_uri'] ?? ''));
        $savedRedirectUri = trim((string)($creds['redirect_uri'] ?? ''));
        // Intuit requires the authorization redirect_uri and token-exchange redirect_uri
        // to be byte-for-byte identical to the one registered for the app. This project
        // is deployed under /remquip, so never infer it from preview/browser hostnames.
        $redirectUri = $canonicalRedirectUri ?: ($requestedRedirectUri ?: $savedRedirectUri);
        if (!$clientId || !$redirectUri) {
            ResponseHelper::sendError('Set client_id and redirect_uri first (Configure → Credentials).', 400);
        }
        if ($savedRedirectUri !== $redirectUri) {
            $creds['redirect_uri'] = $redirectUri;
            $conn->execute(
                'UPDATE remquip_integrations SET credentials = :c, updated_at = NOW() WHERE provider = :p',
                ['c' => json_encode($creds, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'p' => 'quickbooks']
            );
        }

        $state = bin2hex(random_bytes(16));
        $conf['oauth_state']      = $state;
        $conf['oauth_state_at']   = date('c');
        $conf['oauth_redirect_uri'] = $redirectUri;
        $conn->execute(
            'UPDATE remquip_integrations SET config = :cf, updated_at = NOW() WHERE provider = :p',
            ['cf' => json_encode($conf, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'p' => 'quickbooks']
        );

        $scope    = 'com.intuit.quickbooks.accounting openid profile email';
        $authBase = 'https://appcenter.intuit.com/connect/oauth2';
        $url = $authBase . '?' . http_build_query([
            'client_id'     => $clientId,
            'response_type' => 'code',
            'scope'         => $scope,
            'redirect_uri'  => $redirectUri,
            'state'         => $state,
        ]);

        integrations_log($conn, $integration['id'], 'quickbooks', 'oauth_start', 'info', 'Authorize URL generated', ['redirect_uri' => $redirectUri]);
        ResponseHelper::sendSuccess(['authorize_url' => $url, 'state' => $state, 'redirect_uri' => $redirectUri], 'Authorize URL ready');
    } catch (Exception $e) {
        Logger::error('QBO oauth start error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to start OAuth: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// POST /integrations/quickbooks/oauth/callback
// Body: { code, state, realmId }
// Exchanges the authorization code for access_token + refresh_token and
// stores them. Once tokens are present, status flips to 'connected'.
// ---------------------------------------------------------------------
if ($method === 'POST' && $id === 'quickbooks' && $action === 'oauth' && ($extra ?? null) === 'callback') {
    try {
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];
        $code    = trim((string)($body['code']    ?? ''));
        $state   = trim((string)($body['state']   ?? ''));
        $realmId = trim((string)($body['realmId'] ?? $body['realm_id'] ?? ''));

        if (!$code || !$state || !$realmId) {
            ResponseHelper::sendError('Missing code, state or realmId', 400);
        }

        $integration = integrations_get($conn, 'quickbooks');
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);
        $creds = $integration['credentials'] ? json_decode($integration['credentials'], true) : [];
        $conf  = $integration['config']      ? json_decode($integration['config'], true)      : [];

        // Verify CSRF state
        if (empty($conf['oauth_state']) || !hash_equals((string)$conf['oauth_state'], $state)) {
            integrations_log($conn, $integration['id'], 'quickbooks', 'oauth_callback', 'error', 'State mismatch');
            ResponseHelper::sendError('Invalid OAuth state', 400);
        }

        $clientId     = $creds['client_id']     ?? (defined('QBO_CLIENT_ID')     ? QBO_CLIENT_ID     : '');
        $clientSecret = $creds['client_secret'] ?? (defined('QBO_CLIENT_SECRET') ? QBO_CLIENT_SECRET : '');
        $redirectUri  = $conf['oauth_redirect_uri'] ?? ($creds['redirect_uri']  ?? (defined('QBO_REDIRECT_URI')  ? QBO_REDIRECT_URI  : ''));
        if (!$clientId || !$clientSecret || !$redirectUri) {
            ResponseHelper::sendError('Missing client_id / client_secret / redirect_uri in saved credentials', 400);
        }

        // Exchange code → tokens
        $tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
        $ch = curl_init($tokenUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
                'Authorization: Basic ' . base64_encode($clientId . ':' . $clientSecret),
            ],
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type'   => 'authorization_code',
                'code'         => $code,
                'redirect_uri' => $redirectUri,
            ]),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $resp     = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($resp === false || $httpCode >= 400) {
            $msg = 'Token exchange failed (' . $httpCode . '): ' . ($resp ?: $curlErr);
            $conn->execute(
                'UPDATE remquip_integrations SET status = \'error\', last_error = :err, updated_at = NOW() WHERE provider = \'quickbooks\'',
                ['err' => substr($msg, 0, 1000)]
            );
            integrations_log($conn, $integration['id'], 'quickbooks', 'oauth_callback', 'error', $msg);
            ResponseHelper::sendError($msg, 400);
        }

        $tokens = json_decode($resp, true) ?: [];
        $accessToken  = $tokens['access_token']  ?? '';
        $refreshToken = $tokens['refresh_token'] ?? '';
        $expiresIn    = (int)($tokens['expires_in'] ?? 3600);
        if (!$accessToken || !$refreshToken) {
            ResponseHelper::sendError('Token response missing access_token/refresh_token', 400);
        }

        $creds['access_token']  = $accessToken;
        $creds['refresh_token'] = $refreshToken;
        $creds['realm_id']      = $realmId;
        unset($conf['oauth_state'], $conf['oauth_state_at'], $conf['oauth_redirect_uri']);

        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn - 60);
        $conn->execute(
            'UPDATE remquip_integrations
             SET status = :s, credentials = :c, config = :cf, connected_at = NOW(),
                 token_expires_at = :exp, last_error = NULL, is_enabled = 1, updated_at = NOW()
             WHERE provider = :p',
            [
                's'   => 'connected',
                'c'   => json_encode($creds, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'cf'  => json_encode($conf,  JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'exp' => $expiresAt,
                'p'   => 'quickbooks',
            ]
        );
        integrations_log($conn, $integration['id'], 'quickbooks', 'oauth_callback', 'success', 'Tokens stored, connected');

        ResponseHelper::sendSuccess([
            'status'           => 'connected',
            'realm_id'         => $realmId,
            'token_expires_at' => $expiresAt,
        ], 'QuickBooks connected');
    } catch (Exception $e) {
        Logger::error('QBO oauth callback error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('OAuth callback failed: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// POST /integrations/:provider/connect
// In stub mode: validates that the minimum APP-level credentials are present
// (client_id/client_secret/etc.) and marks the integration as connected.
// Once real OAuth is implemented, this endpoint should redirect to the
// provider's authorize URL and the OAuth callback will set status=connected.
// ---------------------------------------------------------------------
if ($method === 'POST' && $id && in_array($id, $ALLOWED, true) && $action === 'connect') {
    try {
        $integration = integrations_get($conn, $id);
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);

        $creds = $integration['credentials'] ? json_decode($integration['credentials'], true) : [];
        // Only enforce the APP-level fields (the developer credentials), NOT user OAuth tokens —
        // those are obtained later via the OAuth callback.
        $required = integrations_minimum_app_fields($id);

        // Map of credential key -> hardcoded fallback constant defined in config.php.
        // If the field is empty in the DB but the constant is defined and non-empty,
        // we treat it as present (and persist it back so future requests don't ask again).
        $constMap = [
            'quickbooks' => [
                'client_id'     => 'QBO_CLIENT_ID',
                'client_secret' => 'QBO_CLIENT_SECRET',
                'redirect_uri'  => 'QBO_REDIRECT_URI',
            ],
            'amazon' => [
                'lwa_client_id'     => 'AMZ_LWA_CLIENT_ID',
                'lwa_client_secret' => 'AMZ_LWA_CLIENT_SECRET',
                'seller_id'         => 'AMZ_SELLER_ID',
                'marketplace_id'    => 'AMZ_MARKETPLACE_ID',
            ],
            'ebay' => [
                'app_id'  => 'EBAY_APP_ID',
                'cert_id' => 'EBAY_CERT_ID',
                'dev_id'  => 'EBAY_DEV_ID',
            ],
        ];
        $fallbacks = $constMap[$id] ?? [];
        $hydrated = false;
        foreach ($required as $k) {
            if (empty($creds[$k]) && isset($fallbacks[$k]) && defined($fallbacks[$k]) && constant($fallbacks[$k]) !== '') {
                $creds[$k] = (string) constant($fallbacks[$k]);
                $hydrated = true;
            }
        }
        if ($hydrated) {
            $conn->execute(
                'UPDATE remquip_integrations SET credentials = :c, updated_at = NOW() WHERE provider = :p',
                ['c' => json_encode($creds, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'p' => $id]
            );
        }

        $missingKeys = array_values(array_filter($required, fn($k) => empty($creds[$k])));

        if (!empty($missingKeys)) {
            $msg = 'Missing required credentials: ' . implode(', ', $missingKeys);
            $conn->execute(
                'UPDATE remquip_integrations SET status = \'error\', last_error = :err, updated_at = NOW() WHERE provider = :p',
                ['err' => $msg, 'p' => $id]
            );
            integrations_log($conn, $integration['id'], $id, 'connect', 'error', $msg);
            ResponseHelper::sendError($msg, 400);
        }


        // TODO: when real OAuth is implemented, redirect to authorize URL here
        // and let the callback flip status to 'connected'.
        $conn->execute(
            'UPDATE remquip_integrations
             SET status = :s, connected_at = NOW(), last_error = NULL, is_enabled = 1, updated_at = NOW()
             WHERE provider = :p',
            ['s' => 'connected', 'p' => $id]
        );
        integrations_log($conn, $integration['id'], $id, 'connect', 'success', 'Connection established (stub mode)');
        ResponseHelper::sendSuccess(['status' => 'connected'], 'Integration connected');
    } catch (Exception $e) {
        $conn->execute(
            'UPDATE remquip_integrations SET status = \'error\', last_error = :err, updated_at = NOW() WHERE provider = :p',
            ['err' => substr($e->getMessage(), 0, 1000), 'p' => $id]
        );
        Logger::error('Integration connect error', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to connect: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// POST /integrations/:provider/disconnect
// ---------------------------------------------------------------------
if ($method === 'POST' && $id && in_array($id, $ALLOWED, true) && $action === 'disconnect') {
    try {
        $integration = integrations_get($conn, $id);
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);

        $conn->execute(
            'UPDATE remquip_integrations
             SET status = \'disconnected\', is_enabled = 0, credentials = NULL,
                 connected_at = NULL, token_expires_at = NULL, last_error = NULL, updated_at = NOW()
             WHERE provider = :p',
            ['p' => $id]
        );
        integrations_log($conn, $integration['id'], $id, 'disconnect', 'success', 'Integration disconnected');
        ResponseHelper::sendSuccess(['status' => 'disconnected'], 'Integration disconnected');
    } catch (Exception $e) {
        ResponseHelper::sendError('Failed to disconnect', 500);
    }
}

// ---------------------------------------------------------------------
// POST /integrations/:provider/test — ping external API
// QBO is now wired to a real CompanyInfo call.
// ---------------------------------------------------------------------
if ($method === 'POST' && $id && in_array($id, $ALLOWED, true) && $action === 'test') {
    try {
        $integration = integrations_get($conn, $id);
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);
        if ($integration['status'] !== 'connected') {
            ResponseHelper::sendError('Connect the integration first', 400);
        }
        $start = microtime(true);
        $info  = null;

        if ($id === 'quickbooks') {
            require_once __DIR__ . '/../integrations/QboClient.php';
            $client = new QboClient($conn);
            $info   = $client->ping();
        } else {
            // TODO: Amazon  → GET /sellers/v1/marketplaceParticipations
            //       eBay    → GET /sell/account/v1/privilege
            usleep(150000);
        }

        $duration = (int) round((microtime(true) - $start) * 1000);
        integrations_log($conn, $integration['id'], $id, 'test', 'success', 'Test ping OK',
            $info ? ['summary' => substr(json_encode($info), 0, 400)] : null, null, null, $duration);
        ResponseHelper::sendSuccess(['ok' => true, 'duration_ms' => $duration], 'Test successful');
    } catch (Exception $e) {
        $integration = integrations_get($conn, $id);
        if ($integration) {
            $conn->execute(
                'UPDATE remquip_integrations SET last_error = :err, updated_at = NOW() WHERE provider = :p',
                ['err' => substr($e->getMessage(), 0, 1000), 'p' => $id]
            );
            integrations_log($conn, $integration['id'], $id, 'test', 'error', $e->getMessage());
        }
        ResponseHelper::sendError('Test failed: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// POST /integrations/:provider/sync — trigger sync (real for QBO)
// Body: { "entity": "products"|"orders"|"inventory"|"customers"|"invoices"|"estimates"|"payments"|"accounts" }
// ---------------------------------------------------------------------
if ($method === 'POST' && $id && in_array($id, $ALLOWED, true) && $action === 'sync') {
    try {
        $integration = integrations_get($conn, $id);
        if (!$integration) ResponseHelper::sendError('Integration not found', 404);
        if ($integration['status'] !== 'connected') {
            ResponseHelper::sendError('Connect the integration first', 400);
        }
        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $entity = preg_replace('/[^a-z_]/', '', (string)($body['entity'] ?? 'orders'));

        $start  = microtime(true);
        $result = ['entity' => $entity, 'processed' => 0, 'failed' => 0];

        if ($id === 'quickbooks') {
            require_once __DIR__ . '/../integrations/QboSyncService.php';
            $svc = new QboSyncService($conn);
            $r   = $svc->sync($entity);
            $result = array_merge($result, ['result' => $r,
                'processed' => $r['processed'] ?? ($r['pulled']['processed'] ?? 0),
                'failed'    => $r['failed']    ?? ($r['pulled']['failed']    ?? 0),
            ]);
        }
        // TODO: AmazonSyncService / EbaySyncService

        $duration = (int) round((microtime(true) - $start) * 1000);
        $conn->execute(
            'UPDATE remquip_integrations SET last_sync_at = NOW(), updated_at = NOW() WHERE provider = :p',
            ['p' => $id]
        );
        integrations_log($conn, $integration['id'], $id, 'sync_' . $entity, 'success',
            "Sync completed for {$entity}", $result, $result['processed'] ?? null, $result['failed'] ?? null, $duration);

        ResponseHelper::sendSuccess($result, 'Sync triggered');
    } catch (Exception $e) {
        $integration = integrations_get($conn, $id);
        if ($integration) {
            integrations_log($conn, $integration['id'], $id, 'sync', 'error', $e->getMessage());
        }
        ResponseHelper::sendError('Sync failed: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// GET /integrations/quickbooks/accounts — chart of accounts (cached)
// Query: ?type=Income|Expense|Other%20Current%20Asset (optional filter)
// ---------------------------------------------------------------------
if ($method === 'GET' && $id === 'quickbooks' && $action === 'accounts') {
    try {
        $type  = isset($_GET['type']) ? (string)$_GET['type'] : null;
        $where = ['active = 1'];
        $params = [];
        if ($type) { $where[] = 'account_type = :t'; $params['t'] = $type; }
        $rows = $conn->fetchAll(
            'SELECT qbo_id, name, account_type, account_sub_type, classification, currency
             FROM remquip_qbo_accounts WHERE ' . implode(' AND ', $where) . '
             ORDER BY account_type, name',
            $params
        );
        ResponseHelper::sendSuccess($rows, 'Accounts');
    } catch (Exception $e) {
        ResponseHelper::sendError('Failed to load accounts: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// GET /integrations/quickbooks/customer/:localId — financial overview
// Returns mirrored invoices, estimates, payments + total spent for a
// given Remquip customer. Used by the customer detail page.
// ---------------------------------------------------------------------
if ($method === 'GET' && $id === 'quickbooks' && $action === 'customer' && !empty($extra)) {
    try {
        $localId = (string) $extra;
        $customer = $conn->fetch(
            'SELECT id, qbo_id, qbo_synced_at FROM remquip_customers WHERE id = :id',
            ['id' => $localId]
        );
        if (!$customer) ResponseHelper::sendError('Customer not found', 404);

        $invoices  = $conn->fetchAll(
            'SELECT id, qbo_id, qbo_doc_number, txn_date, due_date, currency, total_amt, balance, status
             FROM remquip_qbo_invoices WHERE local_customer_id = :id
             ORDER BY txn_date DESC LIMIT 200',
            ['id' => $localId]
        );
        $estimates = $conn->fetchAll(
            'SELECT id, qbo_id, qbo_doc_number, txn_date, expiration_date, currency, total_amt, status, accepted_date
             FROM remquip_qbo_estimates WHERE local_customer_id = :id
             ORDER BY txn_date DESC LIMIT 200',
            ['id' => $localId]
        );
        $payments  = $conn->fetchAll(
            'SELECT id, qbo_id, txn_date, currency, total_amt, payment_method, payment_ref_num, linked_invoice_ids
             FROM remquip_qbo_payments WHERE local_customer_id = :id
             ORDER BY txn_date DESC LIMIT 200',
            ['id' => $localId]
        );

        $totals = $conn->fetch(
            'SELECT
                COALESCE(SUM(total_amt), 0)                       AS total_invoiced,
                COALESCE(SUM(total_amt) - SUM(balance), 0)        AS total_paid,
                COALESCE(SUM(balance), 0)                         AS total_outstanding,
                COUNT(*)                                          AS invoice_count
             FROM remquip_qbo_invoices WHERE local_customer_id = :id',
            ['id' => $localId]
        );

        ResponseHelper::sendSuccess([
            'customer'  => $customer,
            'invoices'  => $invoices,
            'estimates' => $estimates,
            'payments'  => $payments,
            'totals'    => $totals,
        ], 'QBO customer overview');
    } catch (Exception $e) {
        ResponseHelper::sendError('Failed to load QBO customer data: ' . $e->getMessage(), 500);
    }
}

ResponseHelper::sendError('Integrations endpoint not found', 404);

// =====================================================================
// HELPERS
// =====================================================================

function integrations_get($conn, $provider) {
    return $conn->fetch('SELECT * FROM remquip_integrations WHERE provider = :p', ['p' => $provider]);
}

function integrations_creds($conn, $provider) {
    $row = $conn->fetch('SELECT credentials FROM remquip_integrations WHERE provider = :p', ['p' => $provider]);
    return $row && $row['credentials'] ? json_decode($row['credentials'], true) : [];
}

/**
 * APP-level credentials required to even attempt a connection.
 * (User-level OAuth tokens are obtained AFTER the OAuth flow and live in `credentials` too.)
 */
function integrations_minimum_app_fields($provider) {
    switch ($provider) {
        case 'quickbooks':
            // From your Intuit App → Keys & OAuth (the OAuth flow then captures realm_id + tokens)
            return ['client_id', 'client_secret'];
        case 'amazon':
            // From your SP-API LWA app + your seller account (refresh_token comes from seller authorize flow)
            return ['lwa_client_id', 'lwa_client_secret', 'seller_id', 'marketplace_id'];
        case 'ebay':
            // From your eBay developer keyset (refresh_token comes from user consent flow)
            return ['app_id', 'cert_id', 'dev_id'];
        default:
            return [];
    }
}

/**
 * Full credential set required to actually call the provider's API
 * (use this in the real `test`/`sync` actions, not in `connect`).
 */
function integrations_required_fields($provider) {
    switch ($provider) {
        case 'quickbooks':
            return ['client_id', 'client_secret', 'realm_id', 'access_token', 'refresh_token'];
        case 'amazon':
            return ['lwa_client_id', 'lwa_client_secret', 'refresh_token', 'seller_id', 'marketplace_id'];
        case 'ebay':
            return ['app_id', 'cert_id', 'dev_id', 'refresh_token'];
        default:
            return [];
    }
}

function integrations_mask_credentials($creds) {
    if (!is_array($creds)) return new stdClass();
    $masked = [];
    foreach ($creds as $k => $v) {
        if ($v === null || $v === '') {
            $masked[$k] = null;
            continue;
        }
        // Mask sensitive fields, expose IDs / public values
        $sensitive = ['client_secret','cert_id','access_token','refresh_token','lwa_client_secret','webhook_secret','aws_secret_key'];
        if (in_array($k, $sensitive, true)) {
            $s = (string)$v;
            $masked[$k] = strlen($s) > 8 ? substr($s, 0, 4) . str_repeat('•', max(4, strlen($s) - 8)) . substr($s, -4) : '••••';
            $masked[$k . '_set'] = true;
        } else {
            $masked[$k] = $v;
        }
    }
    return $masked;
}

function integrations_log($conn, $integrationId, $provider, $action, $status, $message, $payload = null, $processed = null, $failed = null, $durationMs = null) {
    try {
        $logId = $conn->fetch('SELECT UUID() AS u')['u'];
        $conn->execute(
            'INSERT INTO remquip_integration_logs
                (id, integration_id, provider, action, status, message, payload, items_processed, items_failed, duration_ms)
             VALUES (:id, :i, :p, :a, :s, :m, :pl, :proc, :fail, :dur)',
            [
                'id' => $logId,
                'i'  => $integrationId,
                'p'  => $provider,
                'a'  => $action,
                's'  => $status,
                'm'  => $message,
                'pl' => $payload ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
                'proc' => $processed,
                'fail' => $failed,
                'dur'  => $durationMs,
            ]
        );
    } catch (Exception $e) {
        Logger::error('Integration log insert failed', ['error' => $e->getMessage()]);
    }
}

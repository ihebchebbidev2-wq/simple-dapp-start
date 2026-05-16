<?php
/**
 * QuickBooks Online API Client
 *
 * Production-ready REST + OAuth 2.0 client for the QBO Accounting API.
 * Handles automatic token refresh, retry on 401, and JSON request/response.
 *
 * Docs:
 *   - OAuth 2.0:   https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
 *   - API ref:     https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account
 *
 * Usage:
 *   $client  = new QboClient($db);
 *   $client->refreshIfExpiring();
 *   $company = $client->getCompanyInfo();
 *   $invoice = $client->createInvoice([...]);
 */

class QboClient
{
    public const PROVIDER = 'quickbooks';

    private const BASE_PROD    = 'https://quickbooks.api.intuit.com';
    private const BASE_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com';
    private const TOKEN_URL    = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    private const MINOR_VERSION = 70;

    private $db;
    private array $integration;
    private array $credentials;
    private array $config;
    private string $environment;

    public function __construct($db)
    {
        $this->db = $db;
        $this->reload();
    }

    public function reload(): void
    {
        $row = $this->db->fetch(
            'SELECT * FROM remquip_integrations WHERE provider = :p',
            ['p' => self::PROVIDER]
        );
        if (!$row) {
            throw new RuntimeException('QuickBooks integration row not found. Run the integrations migration.');
        }
        $this->integration = $row;
        $this->credentials = $row['credentials'] ? (json_decode($row['credentials'], true) ?: []) : [];
        $this->config      = $row['config']      ? (json_decode($row['config'], true)      ?: []) : [];
        $this->environment = $row['environment'] ?: 'sandbox';
    }

    public function isConnected(): bool
    {
        return !empty($this->credentials['access_token'])
            && !empty($this->credentials['refresh_token'])
            && !empty($this->credentials['realm_id']);
    }

    public function realmId(): string
    {
        return (string) ($this->credentials['realm_id'] ?? '');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Connectivity
     * ───────────────────────────────────────────────────────────────── */

    /** Fetch CompanyInfo — the cheapest call to verify a connection works. */
    public function ping(): array
    {
        return $this->getCompanyInfo();
    }

    public function getCompanyInfo(): array
    {
        $realm = $this->realmId();
        return $this->request('GET', "/companyinfo/{$realm}");
    }

    /* ─────────────────────────────────────────────────────────────────
     *  OAuth — token refresh
     * ───────────────────────────────────────────────────────────────── */

    public function refreshIfExpiring(int $thresholdSeconds = 300): void
    {
        $expiresAt = $this->integration['token_expires_at'] ?? null;
        if (!$expiresAt) return;
        if (strtotime($expiresAt) - time() > $thresholdSeconds) return;
        $this->refreshAccessToken();
    }

    public function refreshAccessToken(): array
    {
        $clientId     = (string) ($this->credentials['client_id']     ?? (defined('QBO_CLIENT_ID')     ? QBO_CLIENT_ID     : ''));
        $clientSecret = (string) ($this->credentials['client_secret'] ?? (defined('QBO_CLIENT_SECRET') ? QBO_CLIENT_SECRET : ''));
        $refreshToken = (string) ($this->credentials['refresh_token'] ?? '');

        if (!$clientId || !$clientSecret || !$refreshToken) {
            throw new RuntimeException('QBO refresh failed: missing client_id/client_secret/refresh_token.');
        }

        $ch = curl_init(self::TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
                'Authorization: Basic ' . base64_encode($clientId . ':' . $clientSecret),
            ],
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type'    => 'refresh_token',
                'refresh_token' => $refreshToken,
            ]),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $resp     = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err      = curl_error($ch);
        curl_close($ch);

        if ($resp === false || $httpCode >= 400) {
            $msg = "QBO refresh failed [{$httpCode}]: " . ($resp ?: $err);
            $this->markError($msg);
            throw new RuntimeException($msg);
        }
        $tokens = json_decode($resp, true) ?: [];
        $access  = (string) ($tokens['access_token']  ?? '');
        $refresh = (string) ($tokens['refresh_token'] ?? $refreshToken);
        $expIn   = (int)    ($tokens['expires_in']    ?? 3600);
        if (!$access) {
            throw new RuntimeException('QBO refresh response missing access_token');
        }
        $this->persistTokens($access, $refresh, $expIn);
        return $tokens;
    }

    private function persistTokens(string $accessToken, string $refreshToken, int $expiresIn): void
    {
        $this->credentials['access_token']  = $accessToken;
        $this->credentials['refresh_token'] = $refreshToken;
        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn - 60);

        $this->db->execute(
            'UPDATE remquip_integrations
             SET credentials = :c, token_expires_at = :exp, status = \'connected\', last_error = NULL, updated_at = NOW()
             WHERE provider = :p',
            [
                'c'   => json_encode($this->credentials, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'exp' => $expiresAt,
                'p'   => self::PROVIDER,
            ]
        );
        $this->integration['token_expires_at'] = $expiresAt;
    }

    private function markError(string $msg): void
    {
        try {
            $this->db->execute(
                'UPDATE remquip_integrations SET last_error = :e, status = \'error\', updated_at = NOW() WHERE provider = :p',
                ['e' => substr($msg, 0, 1000), 'p' => self::PROVIDER]
            );
        } catch (Throwable $_) { /* swallow */ }
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Resources — Customers
     * ───────────────────────────────────────────────────────────────── */

    public function getCustomer(string $id): array
    {
        $r = $this->request('GET', '/customer/' . urlencode($id));
        return $r['Customer'] ?? $r;
    }

    public function listCustomers(int $startPosition = 1, int $maxResults = 100, ?string $whereClause = null): array
    {
        $sql = 'SELECT * FROM Customer';
        if ($whereClause) $sql .= ' WHERE ' . $whereClause;
        $sql .= " STARTPOSITION {$startPosition} MAXRESULTS {$maxResults}";
        $r = $this->query($sql);
        return $r['QueryResponse']['Customer'] ?? [];
    }

    public function createCustomer(array $payload): array
    {
        $r = $this->request('POST', '/customer', $payload);
        return $r['Customer'] ?? $r;
    }

    /** Sparse update — payload MUST include Id + SyncToken. */
    public function updateCustomer(array $payload): array
    {
        $payload['sparse'] = true;
        $r = $this->request('POST', '/customer', $payload);
        return $r['Customer'] ?? $r;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Resources — Items (products)
     * ───────────────────────────────────────────────────────────────── */

    public function getItem(string $id): array
    {
        $r = $this->request('GET', '/item/' . urlencode($id));
        return $r['Item'] ?? $r;
    }

    public function listItems(int $startPosition = 1, int $maxResults = 100, ?string $whereClause = null): array
    {
        $sql = 'SELECT * FROM Item';
        if ($whereClause) $sql .= ' WHERE ' . $whereClause;
        $sql .= " STARTPOSITION {$startPosition} MAXRESULTS {$maxResults}";
        $r = $this->query($sql);
        return $r['QueryResponse']['Item'] ?? [];
    }

    public function createItem(array $payload): array
    {
        $r = $this->request('POST', '/item', $payload);
        return $r['Item'] ?? $r;
    }

    public function updateItem(array $payload): array
    {
        $payload['sparse'] = true;
        $r = $this->request('POST', '/item', $payload);
        return $r['Item'] ?? $r;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Resources — Invoices / Estimates / Payments
     * ───────────────────────────────────────────────────────────────── */

    public function getInvoice(string $id): array
    {
        $r = $this->request('GET', '/invoice/' . urlencode($id));
        return $r['Invoice'] ?? $r;
    }

    public function listInvoices(int $startPosition = 1, int $maxResults = 100, ?string $whereClause = null): array
    {
        $sql = 'SELECT * FROM Invoice';
        if ($whereClause) $sql .= ' WHERE ' . $whereClause;
        $sql .= " STARTPOSITION {$startPosition} MAXRESULTS {$maxResults}";
        $r = $this->query($sql);
        return $r['QueryResponse']['Invoice'] ?? [];
    }

    public function createInvoice(array $payload): array
    {
        $r = $this->request('POST', '/invoice', $payload);
        return $r['Invoice'] ?? $r;
    }

    public function sendInvoicePdf(string $id, string $emailTo): array
    {
        return $this->request('POST', '/invoice/' . urlencode($id) . '/send', null, ['sendTo' => $emailTo]);
    }

    public function getEstimate(string $id): array
    {
        $r = $this->request('GET', '/estimate/' . urlencode($id));
        return $r['Estimate'] ?? $r;
    }

    public function listEstimates(int $startPosition = 1, int $maxResults = 100, ?string $whereClause = null): array
    {
        $sql = 'SELECT * FROM Estimate';
        if ($whereClause) $sql .= ' WHERE ' . $whereClause;
        $sql .= " STARTPOSITION {$startPosition} MAXRESULTS {$maxResults}";
        $r = $this->query($sql);
        return $r['QueryResponse']['Estimate'] ?? [];
    }

    public function getPayment(string $id): array
    {
        $r = $this->request('GET', '/payment/' . urlencode($id));
        return $r['Payment'] ?? $r;
    }

    public function listPayments(int $startPosition = 1, int $maxResults = 100, ?string $whereClause = null): array
    {
        $sql = 'SELECT * FROM Payment';
        if ($whereClause) $sql .= ' WHERE ' . $whereClause;
        $sql .= " STARTPOSITION {$startPosition} MAXRESULTS {$maxResults}";
        $r = $this->query($sql);
        return $r['QueryResponse']['Payment'] ?? [];
    }

    public function createPayment(array $payload): array
    {
        $r = $this->request('POST', '/payment', $payload);
        return $r['Payment'] ?? $r;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Resources — Accounts (chart of accounts) — needed for Item creation
     * ───────────────────────────────────────────────────────────────── */

    public function listAccounts(int $startPosition = 1, int $maxResults = 200, ?string $whereClause = null): array
    {
        $sql = 'SELECT * FROM Account';
        if ($whereClause) $sql .= ' WHERE ' . $whereClause;
        $sql .= " STARTPOSITION {$startPosition} MAXRESULTS {$maxResults}";
        $r = $this->query($sql);
        return $r['QueryResponse']['Account'] ?? [];
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Generic — Query API
     * ───────────────────────────────────────────────────────────────── */

    public function query(string $sql): array
    {
        return $this->request('GET', '/query', null, ['query' => $sql]);
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Webhooks — signature verification
     * ───────────────────────────────────────────────────────────────── */

    public static function verifyWebhookSignature(string $payload, string $signatureHeader, string $verifierToken): bool
    {
        if ($signatureHeader === '' || $verifierToken === '') return false;
        $expected = base64_encode(hash_hmac('sha256', $payload, $verifierToken, true));
        return hash_equals($expected, $signatureHeader);
    }

    /* ─────────────────────────────────────────────────────────────────
     *  HTTP — internal
     * ───────────────────────────────────────────────────────────────── */

    private function baseUrl(): string
    {
        return $this->environment === 'production' ? self::BASE_PROD : self::BASE_SANDBOX;
    }

    /**
     * Authenticated REST call. Auto-refreshes on 401 and retries once.
     */
    private function request(string $method, string $path, ?array $body = null, array $query = [], bool $isRetry = false): array
    {
        if (!$this->isConnected()) {
            throw new RuntimeException('QuickBooks is not connected — run the OAuth flow first.');
        }
        // Pre-emptive refresh if expiring soon (cheap)
        if (!$isRetry) $this->refreshIfExpiring();

        $realm = $this->realmId();
        $query['minorversion'] = self::MINOR_VERSION;
        $url   = $this->baseUrl() . '/v3/company/' . urlencode($realm) . $path;
        if ($query) $url .= '?' . http_build_query($query);

        $headers = [
            'Authorization: Bearer ' . $this->credentials['access_token'],
            'Accept: application/json',
        ];
        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => strtoupper($method),
            CURLOPT_TIMEOUT        => 30,
        ];
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $headers[] = 'Content-Type: application/json';
        }
        $opts[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $opts);

        $resp     = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        // Auto-refresh on 401 then retry exactly once
        if ($httpCode === 401 && !$isRetry) {
            $this->refreshAccessToken();
            return $this->request($method, $path, $body, $query, true);
        }

        if ($resp === false) {
            $msg = 'QBO HTTP error: ' . $curlErr;
            $this->markError($msg);
            throw new RuntimeException($msg);
        }

        $decoded = json_decode($resp, true);
        if ($httpCode >= 400) {
            $msg = "QBO API {$method} {$path} failed [{$httpCode}]: " . substr($resp, 0, 500);
            $this->markError($msg);
            throw new RuntimeException($msg);
        }
        return is_array($decoded) ? $decoded : [];
    }
}

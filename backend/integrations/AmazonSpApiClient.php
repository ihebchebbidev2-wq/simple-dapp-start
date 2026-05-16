<?php
/**
 * Amazon Selling Partner API (SP-API) Client (skeleton)
 *
 * Wraps LWA token exchange and REST calls to SP-API endpoints.
 * All methods that hit the network are STUBBED — fill them in once the
 * Amazon Developer credentials and seller authorization are available.
 *
 * Docs:
 *   - Welcome:           https://developer-docs.amazon.com/sp-api/docs/welcome
 *   - Authorization:     https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications
 *   - Marketplace IDs:   https://developer-docs.amazon.com/sp-api/docs/marketplace-ids
 *   - Rate limits:       https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits-in-the-sp-api
 *
 * Usage:
 *   $client = new AmazonSpApiClient($db);
 *   $client->refreshIfExpiring();
 *   $orders = $client->getOrders(['CreatedAfter' => '2024-01-01T00:00:00Z']);
 */

class AmazonSpApiClient
{
    public const PROVIDER = 'amazon';

    /** SP-API endpoints per region */
    private const ENDPOINTS = [
        'na' => 'https://sellingpartnerapi-na.amazon.com',
        'eu' => 'https://sellingpartnerapi-eu.amazon.com',
        'fe' => 'https://sellingpartnerapi-fe.amazon.com',
    ];
    private const SANDBOX_ENDPOINTS = [
        'na' => 'https://sandbox.sellingpartnerapi-na.amazon.com',
        'eu' => 'https://sandbox.sellingpartnerapi-eu.amazon.com',
        'fe' => 'https://sandbox.sellingpartnerapi-fe.amazon.com',
    ];
    private const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

    private $db;
    private array $integration;
    private array $credentials;
    private array $config;
    private string $environment;
    private string $region; // 'na' | 'eu' | 'fe'

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
            throw new RuntimeException('Amazon integration row not found. Run the integrations migration.');
        }
        $this->integration = $row;
        $this->credentials = $row['credentials'] ? json_decode($row['credentials'], true) : [];
        $this->config      = $row['config']      ? json_decode($row['config'], true)      : [];
        $this->environment = $row['environment'] ?: 'sandbox';
        $this->region      = $this->config['region'] ?? 'na';
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Connectivity
     * ───────────────────────────────────────────────────────────────── */

    public function isConnected(): bool
    {
        return !empty($this->credentials['lwa_client_id'])
            && !empty($this->credentials['lwa_client_secret'])
            && !empty($this->credentials['refresh_token'])
            && !empty($this->credentials['seller_id'])
            && !empty($this->credentials['marketplace_id']);
    }

    /** Ping = getMarketplaceParticipations. */
    public function ping(): bool
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::ping() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  LWA — token refresh
     * ───────────────────────────────────────────────────────────────── */

    public function refreshIfExpiring(int $thresholdSeconds = 300): void
    {
        $expiresAt = $this->integration['token_expires_at'] ?? null;
        if (!$expiresAt) { $this->refreshAccessToken(); return; }
        if (strtotime($expiresAt) - time() > $thresholdSeconds) return;
        $this->refreshAccessToken();
    }

    public function refreshAccessToken(): array
    {
        // TODO: POST to self::LWA_TOKEN_URL with:
        //   grant_type=refresh_token
        //   refresh_token=<credentials.refresh_token>
        //   client_id=<credentials.lwa_client_id>
        //   client_secret=<credentials.lwa_client_secret>
        // Persist access_token + expires_in via persistAccessToken().
        throw new RuntimeException('AmazonSpApiClient::refreshAccessToken() not implemented yet');
    }

    private function persistAccessToken(string $accessToken, int $expiresIn): void
    {
        $this->credentials['access_token'] = $accessToken;
        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn - 60);

        $this->db->execute(
            'UPDATE remquip_integrations
             SET credentials = :c, token_expires_at = :exp, updated_at = NOW()
             WHERE provider = :p',
            [
                'c'   => json_encode($this->credentials, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'exp' => $expiresAt,
                'p'   => self::PROVIDER,
            ]
        );
        $this->integration['token_expires_at'] = $expiresAt;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Orders API v0
     * ───────────────────────────────────────────────────────────────── */

    /** GET /orders/v0/orders */
    public function getOrders(array $filters = []): array
    {
        // TODO: include MarketplaceIds=<marketplace_id> always
        throw new RuntimeException('AmazonSpApiClient::getOrders() not implemented yet');
    }

    /** GET /orders/v0/orders/{orderId} */
    public function getOrder(string $orderId): array
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::getOrder() not implemented yet');
    }

    /** GET /orders/v0/orders/{orderId}/orderItems */
    public function getOrderItems(string $orderId): array
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::getOrderItems() not implemented yet');
    }

    /** GET /orders/v0/orders/{orderId}/buyerInfo (restricted PII) */
    public function getOrderBuyerInfo(string $orderId): array
    {
        // TODO: requires Restricted Data Token (RDT) — see Tokens API
        throw new RuntimeException('AmazonSpApiClient::getOrderBuyerInfo() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Listings Items API v2021-08-01
     * ───────────────────────────────────────────────────────────────── */

    public function getListing(string $sku): array
    {
        // TODO: GET /listings/2021-08-01/items/{sellerId}/{sku}
        throw new RuntimeException('AmazonSpApiClient::getListing() not implemented yet');
    }

    public function putListing(string $sku, array $payload): array
    {
        // TODO: PUT /listings/2021-08-01/items/{sellerId}/{sku}
        throw new RuntimeException('AmazonSpApiClient::putListing() not implemented yet');
    }

    public function deleteListing(string $sku): array
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::deleteListing() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  FBA Inventory API v1
     * ───────────────────────────────────────────────────────────────── */

    public function getInventorySummaries(array $filters = []): array
    {
        // TODO: GET /fba/inventory/v1/summaries
        throw new RuntimeException('AmazonSpApiClient::getInventorySummaries() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Catalog Items API v2022-04-01
     * ───────────────────────────────────────────────────────────────── */

    public function getCatalogItem(string $asin): array
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::getCatalogItem() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Sellers API
     * ───────────────────────────────────────────────────────────────── */

    public function getMarketplaceParticipations(): array
    {
        // TODO: GET /sellers/v1/marketplaceParticipations
        throw new RuntimeException('AmazonSpApiClient::getMarketplaceParticipations() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Reports API v2021-06-30
     * ───────────────────────────────────────────────────────────────── */

    public function createReport(string $reportType, array $options = []): array
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::createReport() not implemented yet');
    }

    public function getReport(string $reportId): array
    {
        // TODO
        throw new RuntimeException('AmazonSpApiClient::getReport() not implemented yet');
    }

    public function downloadReportDocument(string $reportDocumentId): string
    {
        // TODO: returns the (decompressed) report body
        throw new RuntimeException('AmazonSpApiClient::downloadReportDocument() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Notifications (SQS) — webhook bridge
     * ───────────────────────────────────────────────────────────────── */

    /** Verify SNS subscription confirmation/notification signatures. */
    public static function verifySnsMessage(array $message): bool
    {
        // TODO: verify SigningCertURL host (sns.*.amazonaws.com), build canonical string,
        //       openssl_verify against the SHA1WithRSA Signature.
        throw new RuntimeException('AmazonSpApiClient::verifySnsMessage() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  HTTP — internal
     * ───────────────────────────────────────────────────────────────── */

    private function endpoint(): string
    {
        $map = $this->environment === 'production' ? self::ENDPOINTS : self::SANDBOX_ENDPOINTS;
        return $map[$this->region] ?? $map['na'];
    }

    /**
     * @param string     $method  GET|POST|PUT|DELETE
     * @param string     $path    e.g. '/orders/v0/orders'
     * @param array      $query
     * @param array|null $body
     * @param string|null $restrictedDataToken Optional RDT for PII calls
     */
    private function request(string $method, string $path, array $query = [], ?array $body = null, ?string $restrictedDataToken = null): array
    {
        // TODO: headers:
        //   x-amz-access-token: <RDT or access_token>
        //   Accept: application/json
        // Honour x-amzn-RateLimit-Limit by sleeping when needed.
        throw new RuntimeException('AmazonSpApiClient::request() not implemented yet');
    }
}

<?php
/**
 * eBay API Client (skeleton)
 *
 * Wraps eBay OAuth user-token refresh and REST calls to the Sell APIs.
 * All methods that hit the network are STUBBED — fill them in once the
 * eBay Developer keyset and user consent are available.
 *
 * Docs:
 *   - OAuth tokens:           https://developer.ebay.com/api-docs/static/oauth-tokens.html
 *   - Sell APIs overview:     https://developer.ebay.com/api-docs/sell/static/overview.html
 *   - Inventory API:          https://developer.ebay.com/api-docs/sell/inventory/overview.html
 *   - Fulfillment API:        https://developer.ebay.com/api-docs/sell/fulfillment/overview.html
 *   - Account deletion:       https://developer.ebay.com/marketplace-account-deletion
 *
 * Usage:
 *   $client = new EbayClient($db);
 *   $client->refreshIfExpiring();
 *   $orders = $client->getOrders(['filter' => 'creationdate:[2024-01-01..]']);
 */

class EbayClient
{
    public const PROVIDER = 'ebay';

    private const BASE_PROD     = 'https://api.ebay.com';
    private const BASE_SANDBOX  = 'https://api.sandbox.ebay.com';
    private const TOKEN_URL_PROD    = 'https://api.ebay.com/identity/v1/oauth2/token';
    private const TOKEN_URL_SANDBOX = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

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
            throw new RuntimeException('eBay integration row not found. Run the integrations migration.');
        }
        $this->integration = $row;
        $this->credentials = $row['credentials'] ? json_decode($row['credentials'], true) : [];
        $this->config      = $row['config']      ? json_decode($row['config'], true)      : [];
        $this->environment = $row['environment'] ?: 'sandbox';
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Connectivity
     * ───────────────────────────────────────────────────────────────── */

    public function isConnected(): bool
    {
        return !empty($this->credentials['app_id'])
            && !empty($this->credentials['cert_id'])
            && !empty($this->credentials['refresh_token']);
    }

    /** Ping = getPrivileges. */
    public function ping(): bool
    {
        // TODO
        throw new RuntimeException('EbayClient::ping() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  OAuth — token refresh
     * ───────────────────────────────────────────────────────────────── */

    /** Build the consent URL (Auth'n'Auth → user redirected to grant scopes). */
    public function buildAuthorizeUrl(string $state, array $scopes): string
    {
        // TODO: GET https://auth.ebay.com/oauth2/authorize?...
        // sandbox: https://auth.sandbox.ebay.com/oauth2/authorize?...
        throw new RuntimeException('EbayClient::buildAuthorizeUrl() not implemented yet');
    }

    /** Exchange the auth code for refresh + access tokens. */
    public function exchangeCodeForTokens(string $code, string $redirectUri): array
    {
        // TODO: POST tokenUrl() with grant_type=authorization_code, code, redirect_uri
        // Auth: Basic base64(app_id:cert_id)
        throw new RuntimeException('EbayClient::exchangeCodeForTokens() not implemented yet');
    }

    public function refreshIfExpiring(int $thresholdSeconds = 300): void
    {
        $expiresAt = $this->integration['token_expires_at'] ?? null;
        if (!$expiresAt) { $this->refreshAccessToken(); return; }
        if (strtotime($expiresAt) - time() > $thresholdSeconds) return;
        $this->refreshAccessToken();
    }

    public function refreshAccessToken(): array
    {
        // TODO: POST tokenUrl() with grant_type=refresh_token, refresh_token, scope
        throw new RuntimeException('EbayClient::refreshAccessToken() not implemented yet');
    }

    private function persistAccessToken(string $accessToken, int $expiresIn, ?string $newRefreshToken = null): void
    {
        $this->credentials['access_token'] = $accessToken;
        if ($newRefreshToken) $this->credentials['refresh_token'] = $newRefreshToken;
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
     *  Inventory API  (/sell/inventory/v1)
     * ───────────────────────────────────────────────────────────────── */

    public function getInventoryItem(string $sku): array
    {
        // TODO: GET /sell/inventory/v1/inventory_item/{sku}
        throw new RuntimeException('EbayClient::getInventoryItem() not implemented yet');
    }

    public function putInventoryItem(string $sku, array $payload): array
    {
        // TODO: PUT /sell/inventory/v1/inventory_item/{sku}
        throw new RuntimeException('EbayClient::putInventoryItem() not implemented yet');
    }

    public function deleteInventoryItem(string $sku): array
    {
        // TODO: DELETE /sell/inventory/v1/inventory_item/{sku}
        throw new RuntimeException('EbayClient::deleteInventoryItem() not implemented yet');
    }

    public function bulkUpdatePriceQuantity(array $requests): array
    {
        // TODO: POST /sell/inventory/v1/bulk_update_price_quantity
        throw new RuntimeException('EbayClient::bulkUpdatePriceQuantity() not implemented yet');
    }

    public function publishOffer(string $offerId): array
    {
        // TODO: POST /sell/inventory/v1/offer/{offerId}/publish
        throw new RuntimeException('EbayClient::publishOffer() not implemented yet');
    }

    public function createOffer(array $payload): array
    {
        // TODO: POST /sell/inventory/v1/offer
        throw new RuntimeException('EbayClient::createOffer() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Fulfillment API (/sell/fulfillment/v1)
     * ───────────────────────────────────────────────────────────────── */

    public function getOrders(array $query = []): array
    {
        // TODO: GET /sell/fulfillment/v1/order
        throw new RuntimeException('EbayClient::getOrders() not implemented yet');
    }

    public function getOrder(string $orderId): array
    {
        // TODO: GET /sell/fulfillment/v1/order/{orderId}
        throw new RuntimeException('EbayClient::getOrder() not implemented yet');
    }

    public function shipOrder(string $orderId, array $payload): array
    {
        // TODO: POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment
        throw new RuntimeException('EbayClient::shipOrder() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Account API (/sell/account/v1)
     * ───────────────────────────────────────────────────────────────── */

    public function getPrivileges(): array
    {
        // TODO: GET /sell/account/v1/privilege
        throw new RuntimeException('EbayClient::getPrivileges() not implemented yet');
    }

    /* ─────────────────────────────────────────────────────────────────
     *  Marketplace Account Deletion notifications (mandatory)
     * ───────────────────────────────────────────────────────────────── */

    /**
     * Verify the eBay account deletion notification signature.
     * Docs: https://developer.ebay.com/marketplace-account-deletion
     */
    public static function verifyAccountDeletionSignature(string $payload, string $signatureHeader, string $verificationToken, string $endpointUrl): bool
    {
        // TODO: SHA-256 hash of (payload + verificationToken + endpointUrl), base64-compare with header.
        throw new RuntimeException('EbayClient::verifyAccountDeletionSignature() not implemented yet');
    }

    /**
     * Respond to eBay's GET challenge with the SHA-256 hash they expect
     * (challengeCode + verificationToken + endpoint).
     */
    public static function buildChallengeResponse(string $challengeCode, string $verificationToken, string $endpointUrl): string
    {
        return hash('sha256', $challengeCode . $verificationToken . $endpointUrl);
    }

    /* ─────────────────────────────────────────────────────────────────
     *  HTTP — internal
     * ───────────────────────────────────────────────────────────────── */

    private function baseUrl(): string
    {
        return $this->environment === 'production' ? self::BASE_PROD : self::BASE_SANDBOX;
    }

    private function tokenUrl(): string
    {
        return $this->environment === 'production' ? self::TOKEN_URL_PROD : self::TOKEN_URL_SANDBOX;
    }

    /**
     * @param string      $method GET|POST|PUT|DELETE
     * @param string      $path   e.g. '/sell/inventory/v1/inventory_item/ABC'
     * @param array       $query
     * @param array|null  $body
     */
    private function request(string $method, string $path, array $query = [], ?array $body = null): array
    {
        // TODO: headers:
        //   Authorization: Bearer <access_token>
        //   Content-Type: application/json
        //   Content-Language: en-US (some endpoints require it)
        //   Accept-Language: en-US
        // On 401 → refreshAccessToken() and retry once.
        throw new RuntimeException('EbayClient::request() not implemented yet');
    }
}

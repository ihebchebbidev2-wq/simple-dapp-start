<?php
/**
 * Path parsing + dispatch into routes/*.php (same logic for pretty URLs and api.php?path=).
 */

function remquip_known_resources(): array
{
    return [
        'auth', 'users', 'products', 'categories', 'inventory', 'customers',
        'orders', 'offers', 'invoices', 'discounts', 'uploads', 'analytics', 'cms', 'health',
        'dashboard', 'audit', 'user', 'admin', 'admin-contacts', 'settings', 'contact-map', 'landing-theme',
        'chat', 'carts', 'stripe', 'account-applications', 'tax-rates', 'seo',
        'integrations',
    ];
}

/**
 * Strip deploy prefixes so the first segment can be a known resource name.
 */
function remquip_trim_to_segments(string $path): array
{
    $path = preg_replace('#/backend#i', '', $path);
    $path = preg_replace('#/(?:index|api)\.php#i', '', $path);
    $path = trim($path, '/');

    return array_values(array_filter(explode('/', $path), 'strlen'));
}

function remquip_shift_to_resource(array $segments): array
{
    $knownResources = remquip_known_resources();
    while (!empty($segments) && !in_array($segments[0], $knownResources, true)) {
        array_shift($segments);
    }
    if (($segments[0] ?? '') === 'api') {
        array_shift($segments);
    }

    return $segments;
}

/**
 * Parse logical API path (e.g. auth/login, cms/pages/home) into route segments.
 */
function remquip_parse_path_to_segments(string $path): array
{
    $path = trim(str_replace('\\', '/', $path), '/');
    if ($path === '') {
        return [];
    }
    $segments = remquip_trim_to_segments($path);

    return remquip_shift_to_resource($segments);
}

/**
 * Parse REQUEST_URI (Apache rewrite / direct index.php) into route segments.
 */
function remquip_parse_request_uri(): array
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = (string) $path;
    $segments = remquip_trim_to_segments($path);

    return remquip_shift_to_resource($segments);
}

/**
 * Dispatch to routes/{resource}.php with $method, $conn, $id, $action, $routeSegments set for includes.
 *
 * @param array<int, string> $segments
 */
function remquip_dispatch(array $segments): void
{
    list(, $conn) = remquip_require_db();

    $method = $_SERVER['REQUEST_METHOD'];
    $resource = $segments[0] ?? '';
    $routeSegments = array_slice($segments, 1);
    $id = $routeSegments[0] ?? null;
    $action = $routeSegments[1] ?? null;
    $path = implode('/', array_filter($segments, 'strlen'));

    Logger::logRequest($resource, [
        'method' => $method,
        'path' => $path,
        'id' => $id,
        'action' => $action,
        'routeSegments' => $routeSegments,
    ]);

    /**
     * Dispatch helper: ensures any uncaught PHP `Throwable` returns JSON.
     * Without this, some fatal errors can produce HTTP 500 with an empty body,
     * which makes debugging impossible from the frontend.
     */
    $safeRequire = function (string $file) use ($resource, &$conn, &$method, &$routeSegments, &$id, &$action) {
        try {
            require_once $file;
        } catch (Throwable $e) {
            try {
                Logger::error('API dispatch fatal error', [
                    'resource' => $resource,
                    'file' => $file,
                    'error' => $e->getMessage(),
                ]);
            } catch (Throwable $_) {
                // ignore logger failures
            }
            ResponseHelper::sendError('API dispatch failed', 500, [
                'resource' => $resource,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    };

    switch ($resource) {
        case 'auth':
            $safeRequire(__DIR__ . '/routes/auth.php');
            break;
        case 'users':
            $safeRequire(__DIR__ . '/routes/users.php');
            break;
        case 'products':
            $safeRequire(__DIR__ . '/routes/products.php');
            break;
        case 'categories':
            $safeRequire(__DIR__ . '/routes/categories.php');
            break;
        case 'inventory':
            $safeRequire(__DIR__ . '/routes/inventory.php');
            break;
        case 'customers':
            $safeRequire(__DIR__ . '/routes/customers.php');
            break;
        case 'orders':
            $safeRequire(__DIR__ . '/routes/orders.php');
            break;
        case 'discounts':
            $safeRequire(__DIR__ . '/routes/discounts.php');
            break;
        case 'uploads':
            $safeRequire(__DIR__ . '/routes/uploads.php');
            break;
        case 'analytics':
            $safeRequire(__DIR__ . '/routes/analytics.php');
            break;
        case 'cms':
            $safeRequire(__DIR__ . '/routes/cms.php');
            break;
        case 'health':
            ResponseHelper::sendSuccess(['status' => 'ok', 'timestamp' => date('Y-m-d H:i:s')], 'API is running');
            break;
        case 'dashboard':
            $safeRequire(__DIR__ . '/routes/dashboard.php');
            break;
        case 'audit':
            $safeRequire(__DIR__ . '/routes/audit.php');
            break;
        case 'user':
            $safeRequire(__DIR__ . '/routes/user.php');
            break;
        case 'admin':
            $safeRequire(__DIR__ . '/routes/admin.php');
            break;
        case 'admin-contacts':
            $safeRequire(__DIR__ . '/routes/admin-contacts.php');
            break;
        case 'settings':
            $safeRequire(__DIR__ . '/routes/settings.php');
            break;
        case 'contact-map':
            $safeRequire(__DIR__ . '/routes/contact-map.php');
            break;
        case 'landing-theme':
            $safeRequire(__DIR__ . '/routes/landing-theme.php');
            break;
        case 'chat':
            $safeRequire(__DIR__ . '/routes/chat.php');
            break;
        case 'carts':
            $safeRequire(__DIR__ . '/routes/carts.php');
            break;
        case 'stripe':
            $safeRequire(__DIR__ . '/routes/stripe.php');
            break;
        case 'account-applications':
            $safeRequire(__DIR__ . '/routes/account-applications.php');
            break;
        case 'offers':
            $safeRequire(__DIR__ . '/routes/offers.php');
            break;
        case 'invoices':
            $safeRequire(__DIR__ . '/routes/invoices.php');
            break;
        case 'tax-rates':
            $safeRequire(__DIR__ . '/routes/tax-rates.php');
            break;
        case 'seo':
            $safeRequire(__DIR__ . '/routes/seo.php');
            break;
        case 'integrations':
            $safeRequire(__DIR__ . '/routes/integrations.php');
            break;
        case 'lead-statuses':
            $safeRequire(__DIR__ . '/routes/lead-statuses.php');
            break;
        case 'tasks':
            $safeRequire(__DIR__ . '/routes/tasks.php');
            break;
        default:
            ResponseHelper::sendError('Resource not found', 404);
    }
}

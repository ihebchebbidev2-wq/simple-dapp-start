<?php
/**
 * REMQUIP API ENTRYPOINT (alias of `api.php`)
 * Some hosts block or mishandle `/api.php` paths; this file provides the
 * same behavior under a different filename so the frontend can avoid `api.php`
 * URLs entirely.
 *
 * Call:
 *   GET/POST https://your-domain/remquip/backend/remquip-api.php?path=products
 * Extra query params (?page=1&limit=50) are preserved for list endpoints.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/router.php';

remquip_api_bootstrap();

$pathRaw = isset($_GET['path']) ? (string) $_GET['path'] : '';
unset($_GET['path']);

$segments = remquip_parse_path_to_segments($pathRaw);
if (empty($segments)) {
    ResponseHelper::sendError(
        'Missing or invalid path. Use remquip-api.php?path=auth/login',
        400
    );
}

remquip_dispatch($segments);


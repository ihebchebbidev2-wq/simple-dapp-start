<?php
/**
 * REMQUIP API — works on any host (IIS / Azure / OVH) without URL rewriting.
 * Call: POST/GET https://your-domain/remquip/backend/api.php?path=auth/login
 * The `path` query holds the same logical route as before (e.g. cms/pages/home, products/xyz).
 * Extra query params (?page=1&limit=20) are preserved for list endpoints.
 */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/router.php';

remquip_api_bootstrap();

$pathRaw = isset($_GET['path']) ? (string) $_GET['path'] : '';
unset($_GET['path']);

$segments = remquip_parse_path_to_segments($pathRaw);
if (empty($segments)) {
    ResponseHelper::sendError('Missing or invalid path. Use api.php?path=auth/login (path is the API route without leading slash).', 400);
}

remquip_dispatch($segments);

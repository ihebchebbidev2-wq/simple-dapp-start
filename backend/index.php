<?php
/**
 * REMQUIP API — front controller when mod_rewrite routes here (optional).
 * Primary entry for hosts without rewrite: api.php?path=auth/login (see api.php).
 */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/router.php';

remquip_api_bootstrap();

$segments = remquip_parse_request_uri();
if (empty($segments)) {
    ResponseHelper::sendError('Resource not found', 404);
}

remquip_dispatch($segments);

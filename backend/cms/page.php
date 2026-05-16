<?php
/**
 * GET single page — ?slug=home&locale=en (same as api.php?path=cms/pages/home)
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';

remquip_api_bootstrap();

$slug = trim((string) ($_GET['slug'] ?? $_GET['id'] ?? ''));
if ($slug === '') {
    ResponseHelper::sendError('Query parameter slug (or id) is required', 400);
}

remquip_dispatch(['cms', 'pages', $slug]);

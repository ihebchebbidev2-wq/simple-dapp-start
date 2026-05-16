<?php
/**
 * GET one section — ?slug=home&section=hero
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';

remquip_api_bootstrap();

$slug = trim((string) ($_GET['slug'] ?? $_GET['page'] ?? ''));
$section = trim((string) ($_GET['section'] ?? $_GET['sectionKey'] ?? ''));
if ($slug === '' || $section === '') {
    ResponseHelper::sendError('Query parameters slug and section are required', 400);
}

remquip_dispatch(['cms', 'pages', $slug, 'sections', $section]);

<?php
/**
 * Public CMS page sections — same routing as:
 *   GET api.php?path=cms/pages/{slug}/content&locale=en
 *
 * Does not include api.php (avoids nested entry + host-specific include issues).
 * Query: slug (or page | pageName), optional locale (read by routes/cms.php).
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';

remquip_api_bootstrap();

$slug = trim((string) ($_GET['slug'] ?? $_GET['page'] ?? $_GET['pageName'] ?? ''));
if ($slug === '' || !preg_match('/^[a-zA-Z0-9_-]+$/', $slug)) {
    ResponseHelper::sendError(
        $slug === '' ? 'Query parameter slug (or page / pageName) is required' : 'Invalid slug',
        400
    );
}

$segments = remquip_parse_path_to_segments('cms/pages/' . $slug . '/content');
if (empty($segments)) {
    ResponseHelper::sendError('Invalid path', 400);
}

try {
    remquip_dispatch($segments);
} catch (Throwable $e) {
    Logger::error('cms/page-content', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    ResponseHelper::sendError('Failed to load page content', 500);
}

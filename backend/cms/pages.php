<?php
/**
 * GET list / POST create — same as api.php?path=cms/pages
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';

remquip_api_bootstrap();
remquip_dispatch(['cms', 'pages']);

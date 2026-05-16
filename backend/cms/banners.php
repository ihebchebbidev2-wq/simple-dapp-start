<?php
/**
 * GET active banners — ?locale=en optional (handled in routes/cms.php)
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';

remquip_api_bootstrap();
remquip_dispatch(['cms', 'banners']);

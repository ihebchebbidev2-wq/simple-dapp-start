<?php
/**
 * POST multipart image — same as api.php?path=cms/images/upload
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';

remquip_api_bootstrap();
remquip_dispatch(['cms', 'images', 'upload']);

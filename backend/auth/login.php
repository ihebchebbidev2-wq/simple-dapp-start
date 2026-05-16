<?php
/** POST — same as api.php?path=auth/login */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/router.php';
remquip_api_bootstrap();
remquip_dispatch(['auth', 'login']);

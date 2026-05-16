<?php
/** GET — liveness; same as api.php?path=health */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/router.php';
remquip_api_bootstrap();
remquip_dispatch(['health']);

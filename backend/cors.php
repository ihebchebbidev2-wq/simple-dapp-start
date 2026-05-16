<?php
/**
 * CORS — allow any browser origin to call this API (localhost, Vercel, staging, etc.).
 *
 * Uses Access-Control-Allow-Origin: * — do not combine with Access-Control-Allow-Credentials: true
 * (invalid per Fetch/CORS and browsers will reject). The SPA uses Bearer tokens in Authorization,
 * not cross-site cookies, so * is correct.
 *
 * Preflight: echo Access-Control-Request-Headers when present so custom headers always pass.
 * Include this first in index.php, apis.php, apis-remquip.php.
 */
if (!function_exists('remquip_apply_cors_headers')) {
    function remquip_apply_cors_headers(): void
    {
        header('Access-Control-Allow-Origin: *', true);

        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD', true);

        $req = isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])
            ? trim((string) $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])
            : '';
        if ($req !== '') {
            header('Access-Control-Allow-Headers: ' . $req, true);
        } else {
            header(
                'Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-CSRF-Token, X-Request-ID',
                true
            );
        }

        header('Access-Control-Max-Age: 86400', true);
        header('Access-Control-Expose-Headers: X-Request-ID, Content-Length', true);
    }
}

remquip_apply_cors_headers();

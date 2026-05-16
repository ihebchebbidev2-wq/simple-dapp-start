<?php
/**
 * Landing page theme — `remquip_landing_theme` (singleton JSON row)
 * GET /landing-theme — public
 * PUT /landing-theme — admin
 */

$method = $_SERVER['REQUEST_METHOD'];
$rs = $routeSegments ?? [];

function landing_theme_defaults(): array
{
    return [
        'css_variables' => [],
        'font_heading_stack' => '',
        'font_body_stack' => '',
        'google_fonts_url' => null,
        'font_sizes' => [],
        'custom_css' => null,
    ];
}

function landing_theme_normalize_out(array $theme): array
{
    $d = landing_theme_defaults();
    $d['css_variables'] = isset($theme['css_variables']) && is_array($theme['css_variables']) ? $theme['css_variables'] : [];
    $d['font_heading_stack'] = isset($theme['font_heading_stack']) ? (string) $theme['font_heading_stack'] : '';
    $d['font_body_stack'] = isset($theme['font_body_stack']) ? (string) $theme['font_body_stack'] : '';
    $d['google_fonts_url'] = isset($theme['google_fonts_url']) && $theme['google_fonts_url'] !== ''
        ? (string) $theme['google_fonts_url']
        : null;
    $d['font_sizes'] = isset($theme['font_sizes']) && is_array($theme['font_sizes']) ? $theme['font_sizes'] : [];
    $d['custom_css'] = isset($theme['custom_css']) && $theme['custom_css'] !== '' && $theme['custom_css'] !== null
        ? (string) $theme['custom_css']
        : null;

    return $d;
}

function landing_theme_sanitize(array $in): array
{
    $base = landing_theme_normalize_out($in);
    $out = landing_theme_defaults();

    foreach ($base['css_variables'] as $k => $v) {
        $key = (string) $k;
        if (!preg_match('/^--[a-zA-Z0-9_-]{1,80}$/', $key)) {
            continue;
        }
        $val = is_scalar($v) ? trim((string) $v) : '';
        if ($val === '') {
            continue;
        }
        if (strlen($val) > 512) {
            $val = substr($val, 0, 512);
        }
        if (stripos($val, '<script') !== false || stripos($val, 'javascript:') !== false) {
            continue;
        }
        $out['css_variables'][$key] = $val;
    }

    foreach (['font_heading_stack', 'font_body_stack'] as $f) {
        $s = trim((string) $base[$f]);
        if (strlen($s) > 500) {
            $s = substr($s, 0, 500);
        }
        $out[$f] = $s;
    }

    if ($base['google_fonts_url'] === null || $base['google_fonts_url'] === '') {
        $out['google_fonts_url'] = null;
    } else {
        $u = trim((string) $base['google_fonts_url']);
        if ($u === '') {
            $out['google_fonts_url'] = null;
        } elseif (strlen($u) <= 2000 && preg_match('#^https://#i', $u)) {
            $out['google_fonts_url'] = $u;
        } else {
            $out['google_fonts_url'] = null;
        }
    }

    foreach ($base['font_sizes'] as $k => $v) {
        $key = (string) $k;
        if (!preg_match('/^[a-z][a-z0-9_]{0,40}$/', $key)) {
            continue;
        }
        $val = is_scalar($v) ? trim((string) $v) : '';
        if ($val === '' || strlen($val) > 512) {
            continue;
        }
        if (stripos($val, '<') !== false) {
            continue;
        }
        $out['font_sizes'][$key] = $val;
    }

    if ($base['custom_css'] === null || $base['custom_css'] === '') {
        $out['custom_css'] = null;
    } else {
        $css = (string) $base['custom_css'];
        if (strlen($css) > 65535) {
            $css = substr($css, 0, 65535);
        }
        $css = preg_replace('/<\s*script\b[^>]*>.*?<\s*\/\s*script\s*>/is', '', $css);
        $out['custom_css'] = $css === '' ? null : $css;
    }

    return $out;
}

// GET /landing-theme — public
if ($method === 'GET' && empty($rs)) {
    try {
        $row = $conn->fetch('SELECT id, theme, updated_at FROM remquip_landing_theme ORDER BY updated_at DESC LIMIT 1');
        if (!$row) {
            ResponseHelper::sendSuccess(array_merge(landing_theme_defaults(), ['id' => null, 'updated_at' => null]), 'Landing theme (defaults)');
        } else {
            $t = is_string($row['theme']) ? json_decode($row['theme'], true) : $row['theme'];
            if (!is_array($t)) {
                $t = [];
            }
            $out = landing_theme_normalize_out($t);
            $out['id'] = $row['id'];
            $out['updated_at'] = $row['updated_at'];
            ResponseHelper::sendSuccess($out, 'Landing theme');
        }
    } catch (Exception $e) {
        Logger::error('Landing theme GET', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to load landing theme', 500);
    }
}

Auth::requireAuth('admin');

// PUT /landing-theme — merge into existing theme (validated)
if (($method === 'PUT' || $method === 'PATCH') && empty($rs)) {
    try {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $prevRow = $conn->fetch('SELECT theme FROM remquip_landing_theme LIMIT 1');
        $prev = $prevRow
            ? landing_theme_normalize_out(json_decode((string) $prevRow['theme'], true) ?: [])
            : landing_theme_defaults();

        $merged = $prev;
        if (array_key_exists('css_variables', $body) && is_array($body['css_variables'])) {
            $merged['css_variables'] = $body['css_variables'];
        }
        if (array_key_exists('font_sizes', $body) && is_array($body['font_sizes'])) {
            $merged['font_sizes'] = $body['font_sizes'];
        }
        foreach (['font_heading_stack', 'font_body_stack'] as $f) {
            if (array_key_exists($f, $body)) {
                $merged[$f] = $body[$f];
            }
        }
        if (array_key_exists('google_fonts_url', $body)) {
            $merged['google_fonts_url'] = $body['google_fonts_url'];
        }
        if (array_key_exists('custom_css', $body)) {
            $merged['custom_css'] = $body['custom_css'];
        }

        $san = landing_theme_sanitize($merged);
        $encoded = json_encode($san, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $existing = $conn->fetch('SELECT id FROM remquip_landing_theme LIMIT 1');
        if ($existing) {
            $conn->execute(
                'UPDATE remquip_landing_theme SET theme = :t, updated_at = NOW() WHERE id = :id',
                ['t' => $encoded, 'id' => $existing['id']]
            );
            $id = $existing['id'];
        } else {
            $id = $conn->fetch('SELECT UUID() AS u')['u'];
            $conn->execute(
                'INSERT INTO remquip_landing_theme (id, theme) VALUES (:id, :t)',
                ['id' => $id, 't' => $encoded]
            );
        }
        $row = $conn->fetch('SELECT id, theme, updated_at FROM remquip_landing_theme WHERE id = :id', ['id' => $id]);
        $t = is_string($row['theme']) ? json_decode($row['theme'], true) : $row['theme'];
        $out = landing_theme_normalize_out(is_array($t) ? $t : []);
        $out['id'] = $row['id'];
        $out['updated_at'] = $row['updated_at'];
        ResponseHelper::sendSuccess($out, 'Landing theme saved');
    } catch (Exception $e) {
        Logger::error('Landing theme PUT', ['error' => $e->getMessage()]);
        ResponseHelper::sendError('Failed to save landing theme', 500);
    }
}

ResponseHelper::sendError('Landing theme endpoint not found', 404);

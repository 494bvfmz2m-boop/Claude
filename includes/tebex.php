<?php
/**
 * Tebex Headless API client (https://docs.tebex.io/developers/headless-api).
 *
 * Every call here is server-side and uses HTTP Basic auth with the store's
 * Public Token (username) + Private Key (password) — the private key must
 * NEVER be sent to the browser or logged. Real credentials live in
 * includes/tebex_config.php (gitignored); see tebex_config.example.php.
 *
 * If that file is missing (fresh checkout before the store owner has
 * uploaded it), we fall back to empty credentials rather than fatal-erroring
 * the whole site — store pages just show a "not configured yet" message.
 */

if (file_exists(__DIR__ . '/tebex_config.php')) {
    require_once __DIR__ . '/tebex_config.php';
}
if (!defined('TEBEX_PUBLIC_TOKEN')) define('TEBEX_PUBLIC_TOKEN', '');
if (!defined('TEBEX_PRIVATE_KEY')) define('TEBEX_PRIVATE_KEY', '');
if (!defined('TEBEX_WEBHOOK_SECRET')) define('TEBEX_WEBHOOK_SECRET', '');

const TEBEX_API_BASE = 'https://headless.tebex.io/api';

function tebex_configured() {
    return TEBEX_PUBLIC_TOKEN !== '' && TEBEX_PRIVATE_KEY !== '';
}

/**
 * Low-level request helper. $path is relative to TEBEX_API_BASE (e.g.
 * "/accounts/{token}/baskets"). Returns ['ok' => bool, 'status' => int,
 * 'data' => array|null, 'error' => string|null].
 */
function tebex_request($method, $path, $body = null) {
    if (!tebex_configured()) {
        return ['ok' => false, 'status' => 0, 'data' => null, 'error' => 'Store is not configured yet.'];
    }

    $ch = curl_init(TEBEX_API_BASE . $path);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_USERPWD => TEBEX_PUBLIC_TOKEN . ':' . TEBEX_PRIVATE_KEY,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($body);
    }
    curl_setopt_array($ch, $opts);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['ok' => false, 'status' => 0, 'data' => null, 'error' => $curlError ?: 'Could not reach the store.'];
    }

    $data = json_decode($response, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($data) ? ($data['detail'] ?? $data['error'] ?? $data['message'] ?? 'Store request failed.') : 'Store request failed.';
        return ['ok' => false, 'status' => $status, 'data' => $data, 'error' => $message];
    }
    return ['ok' => true, 'status' => $status, 'data' => $data['data'] ?? $data, 'error' => null];
}

/** All categories, each with its packages nested (via includePackages=1). */
function tebex_get_categories() {
    $result = tebex_request('GET', '/accounts/' . rawurlencode(TEBEX_PUBLIC_TOKEN) . '/categories?includePackages=1');
    if (!$result['ok'] || !is_array($result['data'])) return [];
    return $result['data'];
}

function tebex_get_basket($basketIdent) {
    $result = tebex_request('GET', '/accounts/' . rawurlencode(TEBEX_PUBLIC_TOKEN) . '/baskets/' . rawurlencode($basketIdent));
    return $result['ok'] ? $result['data'] : null;
}

/**
 * Creates a new basket. $username (if given) is the Minecraft username the
 * purchase should be attributed to — required by most offline-mode servers
 * at checkout time. Returns the basket array, or null on failure.
 */
function tebex_create_basket($completeUrl, $cancelUrl, $username = null) {
    $body = [
        'complete_url' => $completeUrl,
        'cancel_url' => $cancelUrl,
        'complete_auto_redirect' => true,
        'ip_address' => client_ip(),
    ];
    if (!empty($username)) $body['username'] = $username;

    $result = tebex_request('POST', '/accounts/' . rawurlencode(TEBEX_PUBLIC_TOKEN) . '/baskets', $body);
    return $result['ok'] ? $result['data'] : null;
}

function tebex_add_package_to_basket($basketIdent, $packageId, $quantity = 1) {
    $result = tebex_request('POST', '/baskets/' . rawurlencode($basketIdent) . '/packages', [
        'package_id' => (int)$packageId,
        'quantity' => max(1, (int)$quantity),
    ]);
    return $result;
}

/** Tebex has no DELETE for basket packages — a PUT with quantity 0 removes the line item instead. */
function tebex_remove_package_from_basket($basketIdent, $packageId) {
    return tebex_request('PUT', '/baskets/' . rawurlencode($basketIdent) . '/packages/' . (int)$packageId, [
        'quantity' => 0,
    ]);
}

/**
 * Splits a Tebex package description into a short intro line + a bullet
 * feature list, so a plain block of admin-typed text renders as a tidy
 * checklist instead of one dense paragraph. Convention: the first line is
 * the intro/summary, every line after that becomes one checklist item
 * (any leading -, *, •, ✓ the admin already typed is stripped so it isn't
 * doubled up with our own checkmark icon). A single-line description has
 * no feature list, just the intro.
 */
function store_parse_description($raw) {
    $lines = preg_split('/\r\n|\r|\n/', trim((string)$raw));
    $lines = array_values(array_filter(array_map('trim', $lines), fn($l) => $l !== ''));
    if (empty($lines)) return ['intro' => '', 'features' => []];

    $intro = array_shift($lines);
    $features = array_map(fn($l) => ltrim($l, "-*•✓ \t"), $lines);
    return ['intro' => $intro, 'features' => $features];
}

/** e.g. "$4.99 USD" */
function tebex_format_price($amount, $currency = 'USD') {
    if ($amount === null) return '';
    $symbols = ['USD' => '$', 'GBP' => '£', 'EUR' => '€', 'AUD' => 'A$', 'CAD' => 'C$'];
    $symbol = $symbols[$currency] ?? '';
    return $symbol . number_format((float)$amount, 2) . ($symbol === '' ? ' ' . $currency : '');
}

/** The basket ident stored in this visitor's cookie, or null if they don't have one yet. */
function current_basket_ident() {
    $ident = $_COOKIE['sloth_basket'] ?? null;
    return $ident ? trim($ident) : null;
}

function store_basket_ident_cookie($ident) {
    setcookie('sloth_basket', $ident, [
        'expires' => time() + 30 * 24 * 60 * 60,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_basket_ident_cookie() {
    setcookie('sloth_basket', '', ['expires' => time() - 3600, 'path' => '/']);
}

/**
 * Gets the visitor's current basket if their cookie points to one that's
 * still valid on Tebex's side (not completed/expired), otherwise null.
 */
function get_active_basket() {
    $ident = current_basket_ident();
    if (!$ident) return null;
    $basket = tebex_get_basket($ident);
    if (!$basket || !empty($basket['complete'])) return null;
    return $basket;
}

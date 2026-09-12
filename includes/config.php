<?php
/**
 * SlothSMP — core configuration.
 * Edit SITE_URL and SUPER_OP_EMAILS to match your setup before uploading.
 * Database credentials live in includes/db_config.php (gitignored — see
 * db_config.example.php), not here. See README.md for the full walkthrough.
 */

// ---- Basic site config ----
define('SITE_NAME', 'SlothSMP');
define('SITE_URL', 'https://slothsmp.com'); // <-- change to your real domain, no trailing slash
define('SITE_EMAIL', 'Management@slothsmp.com'); // "From" address for outgoing mail

// ---- Paths ----
define('ROOT_PATH', __DIR__ . '/..');
define('DATA_PATH', ROOT_PATH . '/data');

// ---- Database (accounts, roles, posts, tickets, store orders) ----
if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}
// Fallback placeholders so a fresh checkout without db_config.php uploaded
// yet fails with a clear "can't connect" message instead of a fatal error.
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'CHANGE_ME');
if (!defined('DB_USER')) define('DB_USER', 'CHANGE_ME');
if (!defined('DB_PASS')) define('DB_PASS', 'CHANGE_ME');

// Bump this whenever CSS/JS/images change, so browsers/hosts don't serve a stale cached copy.
define('ASSET_VERSION', '20260912a');

// Accounts that always have every permission and always outrank every role,
// no matter what roles (if any) are assigned to them in the database. Not a
// role — a hard-coded owner override, checked by email.
define('SUPER_OP_EMAILS', ['spontanedonder@hotmail.com']);

// ---- Security ----
// Pre-generated random value, not currently required by any code path but
// kept on hand in case a future feature needs a signing secret. Replace
// before relying on it for anything.
define('APP_SECRET', 'CHANGE_ME_generate_a_long_random_value');

// ---- Sessions ----
define('SESSION_LIFETIME_SECONDS', 31 * 24 * 60 * 60); // 31 days, refreshed on every visit

// Detect HTTPS reliably even behind a reverse proxy/CDN (Cloudflare, etc.) —
// getting this wrong marks the session cookie "secure" on a plain-HTTP
// request, which makes browsers silently drop it and breaks every login.
$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
if (!$isHttps && !empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
    $isHttps = strtolower(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_PROTO'])[0])) === 'https';
}
if (!$isHttps && !empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
    $isHttps = true;
}

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.gc_maxlifetime', (string)SESSION_LIFETIME_SECONDS);
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME_SECONDS,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
    // Refresh the cookie's expiry on every request (31 days since last visit,
    // not since first login). Uses session_id() rather than $_COOKIE since
    // strict_mode may have rejected an invalid incoming ID.
    setcookie(session_name(), session_id(), [
        'expires' => time() + SESSION_LIFETIME_SECONDS,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

error_reporting(E_ALL);
ini_set('display_errors', '0'); // never leak PHP errors to visitors in production

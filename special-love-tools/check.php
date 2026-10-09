<?php
/**
 * Special Love 3D - site check.
 * Open https://yoursite.com/check.php to see why the site shows an error.
 * DELETE THIS FILE when you're done: it shows technical details.
 */
declare(strict_types=1);
ini_set('display_errors', '1');
error_reporting(E_ALL);
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');

$rows = [];
$reported = false;
function row(string $what, bool $ok, string $detail = ''): void {
    global $rows;
    $rows[] = [$what, $ok, $detail];
}

// 1. PHP
row('PHP version 8.0 or newer', PHP_VERSION_ID >= 80000, 'This server runs PHP ' . PHP_VERSION);
foreach (['pdo_mysql' => 'database', 'curl' => 'Stripe payments', 'mbstring' => 'text handling', 'gd' => 'photo checks (optional)'] as $ext => $why) {
    row("PHP extension $ext ($why)", extension_loaded($ext), extension_loaded($ext) ? 'installed' : 'MISSING - turn it on under "Select PHP Version" in cPanel');
}

// 2. Files
$expected = [
    '.htaccess',
    'assets/app.js',
    'assets/hero.jpg',
    'assets/logo.png',
    'assets/owners.webp',
    'assets/style.css',
    'assets/workshop.webp',
    'inc/auth.php',
    'inc/db.php',
    'inc/extras.php',
    'inc/helpers.php',
    'inc/layout.php',
    'inc/stripe.php',
    'inc/totp.php',
    'index.php',
    'pages/404.php',
    'pages/_product_card.php',
    'pages/_review.php',
    'pages/_review_form.php',
    'pages/account.php',
    'pages/admin_orders.php',
    'pages/admin_payments.php',
    'pages/admin_products.php',
    'pages/admin_requests.php',
    'pages/admin_reviews.php',
    'pages/admin_settings.php',
    'pages/admin_team.php',
    'pages/cart.php',
    'pages/checkout.php',
    'pages/custom.php',
    'pages/home.php',
    'pages/login.php',
    'pages/logout.php',
    'pages/order.php',
    'pages/product.php',
    'pages/receipt.php',
    'pages/register.php',
    'pages/request.php',
    'pages/security.php',
    'pages/shop.php',
    'pages/support.php',
    'pages/twofa.php',
    'uploads/.htaccess',
    'webhook.php',
];
$missing = array_values(array_filter($expected, fn($f) => !is_file(__DIR__ . '/' . $f)));
row('All website files are uploaded', !$missing, $missing ? 'Missing: ' . implode(', ', $missing) : count($expected) . ' files found');
row('config.php exists (made by the installer)', is_file(__DIR__ . '/config.php'));
$nested = array_values(array_filter(glob(__DIR__ . '/*/index.php') ?: [], fn($p) => basename(dirname($p)) !== 'pages'));
row('No copy of the site sitting in a sub-folder', !$nested, $nested ? 'Found: ' . implode(', ', array_map(fn($p) => basename(dirname($p)) . '/index.php', $nested)) . ' - the zip may have been extracted into a folder instead of next to index.php' : '');
foreach (['uploads', 'uploads/products', 'uploads/models'] as $d) {
    row("Folder $d is writable", is_dir(__DIR__ . "/$d") && is_writable(__DIR__ . "/$d"));
}

// 3. Database
$dbOk = false;
$pdo = null;
if (is_file(__DIR__ . '/config.php') && extension_loaded('pdo_mysql')) {
    try {
        $cfg = require __DIR__ . '/config.php';
        $pdo = new PDO('mysql:host=' . $cfg['db_host'] . ';port=' . ($cfg['db_port'] ?? 3306) . ';dbname=' . $cfg['db_name'] . ';charset=utf8mb4',
            $cfg['db_user'], $cfg['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $dbOk = true;
        row('Database connection', true, 'MySQL/MariaDB ' . $pdo->query('SELECT VERSION()')->fetchColumn());
        $v = $pdo->query("SELECT svalue FROM settings WHERE skey = 'schema_version'")->fetchColumn();
        row('Database update before this check', true, 'version ' . ($v ?: 'none yet (it runs on the first page visit)'));
    } catch (Throwable $e) {
        row('Database connection', false, $e->getMessage());
    }
}

// 4. Load the homepage and catch the real error
$pageError = null;
$pageOutput = '';
if ($dbOk && !$missing) {
    $page = preg_replace('/[^a-z_]/', '', (string)($_GET['p'] ?? 'home'));
    register_shutdown_function(function () use ($page) {
        global $reported;
        $err = error_get_last();
        if ($reported) return;
        $out = '';
        while (ob_get_level()) $out = ob_get_clean() . $out;
        $code = http_response_code();
        header_remove('Location');
        header_remove('Retry-After');
        http_response_code(200);
        if (!$err && $code >= 500) {
            $text = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags(str_replace(['<br>', '</p>'], ' ', $out)))));
            row("The '$page' page loads", false, 'Error ' . $code . ': ' . mb_substr($text, 0, 600));
        } elseif ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            row("The '$page' page loads", false, 'CRASH: ' . $err['message'] . ' (in ' . str_replace(__DIR__, '', $err['file']) . ' line ' . $err['line'] . ')');
        } else {
            row("The '$page' page loads", true, 'the page finished by redirecting (normal for pages that need you to sign in)');
        }
        report();
    });
    ob_start();
    try {
        $_GET['p'] = $page;
        (function () { require __DIR__ . '/index.php'; })();
        $pageOutput = (string)ob_get_clean();
        row("The '$page' page loads", true, strlen($pageOutput) . ' bytes of page made without errors');
    } catch (Throwable $e) {
        ob_end_clean();
        $pageError = $e;
        row("The '$page' page loads", false, get_class($e) . ': ' . $e->getMessage() . ' (in ' . str_replace(__DIR__, '', $e->getFile()) . ' line ' . $e->getLine() . ')');
    }
}
if ($dbOk) {
    try {
        $have = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        $lack = array_diff(['product_media', 'reviews', 'request_messages'], $have);
        $v = $pdo->query("SELECT svalue FROM settings WHERE skey = 'schema_version'")->fetchColumn();
        row('New tables (photos, reviews, chat) exist', !$lack, $lack ? 'Missing: ' . implode(', ', $lack) : 'database version ' . $v);
    } catch (Throwable $e) {
        row('New tables check', false, $e->getMessage());
    }
}
report();

function report(): void {
    global $rows, $reported;
    $reported = true;
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site check</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:30px auto;padding:0 16px;color:#111;background:#fff}td{padding:8px;border-bottom:1px solid #ddd;vertical-align:top}.ok{color:#15803d;font-weight:700}.bad{color:#b91c1c;font-weight:700}code{background:#f3f4f6;padding:1px 5px;border-radius:4px}.warn{background:#fef3c7;padding:12px;border-radius:8px}</style></head>
<body>
<h1>Special Love 3D - site check</h1>
<p class="warn"><b>Delete <code>check.php</code> from your server when you're done.</b> Copy everything in red and send it over.</p>
<table>
<?php foreach ($rows as [$what, $ok, $detail]): ?>
<tr><td class="<?= $ok ? 'ok' : 'bad' ?>"><?= $ok ? 'OK' : 'PROBLEM' ?></td><td><?= htmlspecialchars($what) ?><?php if ($detail !== ''): ?><br><small><?= htmlspecialchars($detail) ?></small><?php endif; ?></td></tr>
<?php endforeach; ?>
</table>
<p><small>Checking a different page? Add <code>?p=shop</code>, <code>?p=cart</code>, <code>?p=admin_orders</code> etc. to the address.</small></p>
</body></html>
<?php }

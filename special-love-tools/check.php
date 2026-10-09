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
    '.htaccess' => 'd127a983f25cb2618b68e1dfbfcc7918',
    'assets/app.js' => 'd0bf60fa765de14502039cd9109bd3b2',
    'assets/hero.jpg' => '0f98bb1ca8430973f8f7ee54dbd1eba6',
    'assets/logo.png' => 'f23a8fd591caf16b6b3f042cf29622f5',
    'assets/owners.webp' => '80404378c2bd35dc6ac1ba3365911208',
    'assets/style.css' => '14ee043504ef2b9691bbfe907e3ab692',
    'assets/workshop.webp' => '467864852d86d734a584bd0f8287949f',
    'inc/auth.php' => 'e63c5d09de8091ac937c5f5def640d34',
    'inc/db.php' => '86fa0cf9ed83d2a5dafb58a24290dedb',
    'inc/extras.php' => '09b833c56c3fb71956e1cd45a138a37e',
    'inc/helpers.php' => 'a385ab6b2ccdfaa78bd50ceaea34a388',
    'inc/layout.php' => '2380d64b63e96f570b8e279e0b48440d',
    'inc/stripe.php' => '01368c866f75052ce93c426c32e72943',
    'inc/totp.php' => 'be5885c8e4455189ddbca72b8391b003',
    'index.php' => '12e8190af08e341c444db7476d875f27',
    'pages/404.php' => '029655ba0c89c31ad26222fa44f33ef9',
    'pages/_product_card.php' => 'f75a2c70ac6db65bbd620a02b0dac260',
    'pages/_review.php' => '3e03abd4a0582e1d9e383670345a6845',
    'pages/_review_form.php' => '52fe7635aebed88f7fd61a686deb5f56',
    'pages/account.php' => '46ec8113483f60380d72cd899ef29b99',
    'pages/admin_orders.php' => 'e284f57451f4e2ef0765ec4a00e2299f',
    'pages/admin_payments.php' => '474e23e8b8faa056609fa06aa546c260',
    'pages/admin_products.php' => 'aedad870bf05cad24707dac3d4e9e9f4',
    'pages/admin_requests.php' => '2de390c7635c39fbcebf17b14966377c',
    'pages/admin_reviews.php' => 'e49197d78fd2eb0ee42487f841191305',
    'pages/admin_settings.php' => '3500b2fce660bb61d3c4f3528aea90d1',
    'pages/admin_team.php' => 'b9e4dce0362f78271a6735f7f75a4ced',
    'pages/cart.php' => '5301b13414b5ba307ff41697077a29f7',
    'pages/checkout.php' => '6544a14aadc9ca227129e405bfcf7e04',
    'pages/custom.php' => '021d69c435e19f2f082489be3cc87934',
    'pages/home.php' => 'e358d20a29d5898ed677aeb16725921c',
    'pages/login.php' => 'b7f98e24c03c02a11fc4d426df196908',
    'pages/logout.php' => '07005c966b132056f21c9fa06e1c3574',
    'pages/order.php' => '74106558b17e42ef131e9dccee0b66a7',
    'pages/product.php' => 'f0f75cb22dd67e3edd445183fddd3af6',
    'pages/receipt.php' => '488315f4e786881cffdd0a87ec977af4',
    'pages/register.php' => '309b1a14239271240861072287840abb',
    'pages/request.php' => '13878cc9a2d6fd039c05ad1731ed49a8',
    'pages/security.php' => 'd811b7708628b302cd2887472ff40131',
    'pages/shop.php' => '43e82a7f0413f52c1f79e1b9f7515fc1',
    'pages/support.php' => 'adc83bef077454b694e81f0cad5e0f5c',
    'pages/twofa.php' => '71585ccce785728e2e085c31be5c4791',
    'uploads/.htaccess' => 'f79599f52cc4ef956e5a3a2c5f97d93c',
    'webhook.php' => '74bb2b6444247e50413f6f668d9d48a3',
];
$missing = array_values(array_filter(array_keys($expected), fn($f) => !is_file(__DIR__ . '/' . $f)));
row('All website files are uploaded', !$missing, $missing ? 'Missing: ' . implode(', ', $missing) : count($expected) . ' files found');
// Files that exist but are an older (or different) version than this update.
$old = array_values(array_filter(array_keys($expected), fn($f) => is_file(__DIR__ . '/' . $f) && md5_file(__DIR__ . '/' . $f) !== $expected[$f]
    && md5(str_replace("\r", "", (string)file_get_contents(__DIR__ . '/' . $f))) !== $expected[$f]));
row('All files are the latest version', !$old, $old ? 'Out of date: ' . implode(', ', $old) : 'every file matches the latest update');
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

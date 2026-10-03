<?php
/**
 * Ederveen3D - front controller
 */
declare(strict_types=1);

if (!file_exists(__DIR__ . '/config.php')) {
    header('Location: install.php');
    exit;
}

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();

require __DIR__ . '/inc/helpers.php';
require __DIR__ . '/inc/db.php';
require __DIR__ . '/inc/auth.php';
require __DIR__ . '/inc/totp.php';
require __DIR__ . '/inc/stripe.php';
ensure_storefront_schema();

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

$routes = [
    'home'      => 'home.php',
    'shop'      => 'shop.php',
    'product'   => 'product.php',
    'cart'      => 'cart.php',
    'checkout'  => 'checkout.php',
    'order'     => 'order.php',
    'custom'    => 'custom.php',
    'support'   => 'support.php',
    'login'     => 'login.php',
    'register'  => 'register.php',
    'twofa'     => 'twofa.php',
    'logout'    => 'logout.php',
    'account'   => 'account.php',
    'security'  => 'security.php',
    'admin'     => 'admin_orders.php',
    'admin_products' => 'admin_products.php',
    'admin_orders'   => 'admin_orders.php',
    'admin_requests' => 'admin_requests.php',
    'admin_settings' => 'admin_settings.php',
    'admin_payments' => 'admin_payments.php',
    'admin_team'     => 'admin_team.php',
];

$page = $_GET['p'] ?? 'home';

// Portfolio mode: no cart, checkout or customer accounts.
if (showcase_mode()) {
    $routes['admin'] = 'admin_products.php';
    if (in_array($page, ['cart', 'checkout', 'register'], true)) {
        flash('Bestellen gaat via de productpagina: kies daar Marktplaats, Tikkie of kaart.', 'warn');
        redirect('?p=shop');
    }
}

$file = $routes[$page] ?? null;

if ($file === null) {
    http_response_code(404);
    $file = '404.php';
}

require __DIR__ . '/inc/layout.php';
render_page(__DIR__ . '/pages/' . $file);

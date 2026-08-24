<?php
require_once __DIR__ . '/includes/functions.php';

$user = XyphrosAuth::currentUser();
if (!$user) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/store'));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !xs_csrf_verify($_POST['csrf_token'] ?? null)) {
    header('Location: /store?error=' . rawurlencode('That took a bit too long — please try again.'));
    exit;
}

if (empty(TEBEX_PUBLIC_TOKEN) || empty(TEBEX_PRIVATE_KEY)) {
    header('Location: /store?error=' . rawurlencode('The store is still being set up — checkout isn\'t connected yet.'));
    exit;
}

$packageId = (int) ($_POST['package_id'] ?? 0);
if (!$packageId) {
    header('Location: /store?error=' . rawurlencode('Something went wrong finding that item.'));
    exit;
}

$package = Tebex::getPackage($packageId);
if (!$package) {
    header('Location: /store?error=' . rawurlencode("That item couldn't be found — it may have been removed."));
    exit;
}

$customerIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

[$ok, $basket, $err] = Tebex::createBasket(
    SITE_URL . '/store-checkout?complete=1',
    SITE_URL . '/store',
    $customerIp,
    ['xyphros_user_id' => $user['id']]
);

if (!$ok || empty($basket['ident'])) {
    error_log('Tebex basket creation failed: ' . ($err ?? 'unknown error'));
    header('Location: /store?error=' . rawurlencode("Couldn't start checkout — please try again in a moment."));
    exit;
}

$ident = $basket['ident'];

// Some packages require the customer to authenticate with a provider
// (e.g. Discord) before they can be added to a basket — Tebex declares
// this on the package itself via "options". If any are required, send
// the customer through Tebex's auth flow first instead of adding the
// package directly.
$requiredOptions = array_filter($package['options'] ?? [], fn($opt) => !empty($opt['required']));

if ($requiredOptions) {
    $returnUrl = SITE_URL . '/store-auth-return?ident=' . rawurlencode($ident) . '&package_id=' . $packageId;
    $authOptions = Tebex::getBasketAuthOptions($ident, $returnUrl);

    // Each entry looks like {"name": "Discord", "url": "..."}. Take the
    // first usable one — in practice a basket only has one provider it's
    // waiting on at a time.
    $authUrl = null;
    foreach ($authOptions as $opt) {
        if (!empty($opt['url'])) {
            $authUrl = $opt['url'];
            break;
        }
    }

    if (!$authUrl) {
        error_log('Tebex basket auth required but no usable auth option returned for basket ' . $ident);
        header('Location: /store?error=' . rawurlencode("Couldn't start login for this item — please try again in a moment."));
        exit;
    }

    header('Location: ' . $authUrl);
    exit;
}

xs_store_finalize_purchase($ident, $packageId, $user);

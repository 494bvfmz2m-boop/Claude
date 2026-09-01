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

// Every purchasable role/perk in this store is delivered through Discord,
// so a linked Discord account is required before checkout can start —
// see includes/Discord.php for why this replaced Tebex's own per-purchase
// Discord login step.
if (empty($user['discord_id'])) {
    header('Location: /store?error=' . rawurlencode('Link your Discord account before checking out — see the box above.'));
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

// custom.discord_id / custom.discord_username ride along on the basket
// itself (visible in the Tebex dashboard for support purposes), but the
// authoritative copy the webhook actually acts on is the snapshot taken
// on the shop_orders row in xs_store_finalize_purchase().
[$ok, $basket, $err] = Tebex::createBasket(
    SITE_URL . '/store-checkout?complete=1',
    SITE_URL . '/store',
    $customerIp,
    [
        'xyphros_user_id' => $user['id'],
        'discord_id' => $user['discord_id'],
        'discord_username' => $user['discord_username'] ?? '',
    ]
);

if (!$ok || empty($basket['ident'])) {
    error_log('Tebex basket creation failed: ' . ($err ?? 'unknown error'));
    header('Location: /store?error=' . rawurlencode("Couldn't start checkout — please try again in a moment."));
    exit;
}

xs_store_finalize_purchase($basket['ident'], $packageId, $user);

<?php
require_once __DIR__ . '/includes/functions.php';

$user = XyphrosAuth::currentUser();
if (!$user) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/store'));
    exit;
}

$ident = $_GET['ident'] ?? '';
$packageId = (int) ($_GET['package_id'] ?? 0);

if (!$ident || !$packageId) {
    header('Location: /store?error=' . rawurlencode('Something went wrong finishing that login — please try again.'));
    exit;
}

// Confirm this basket actually belongs to the Xyphros account making this
// request, so a captured/guessed ident + package_id combo from someone
// else's link can't be used to add a package to your own login session.
$basket = Tebex::getBasket($ident);
$basketOwnerId = $basket['custom']['xyphros_user_id'] ?? null;
if (!$basket || (string) $basketOwnerId !== (string) $user['id']) {
    header('Location: /store?error=' . rawurlencode("That checkout link isn't valid for this account."));
    exit;
}

xs_store_finalize_purchase($ident, $packageId, $user);

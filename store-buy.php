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

// Whether this basket needs the customer to authorize an identity
// (e.g. Discord) before checkout is a property of the STORE, not of the
// package — Tebex's own docs: "for most stores, authorizing the user
// against the basket is required before checkout ... by directing the
// user to the link provided by the /baskets/auth endpoint." There's no
// reliable way to predict this from the package itself, so just always
// ask; a store that doesn't need it simply returns an empty list here
// and this falls straight through to checkout.
//
// (This used to be gated on the package's own "options" array having a
// required:true entry — but that field is the package's customer-facing
// variables, e.g. a dropdown or text field, and has nothing to do with
// identity auth. That mismatch was causing "Couldn't start login for
// this item" on packages that simply had an unrelated required option.)
$returnUrl = SITE_URL . '/store-auth-return?ident=' . rawurlencode($ident) . '&package_id=' . $packageId;
$authOptions = Tebex::getBasketAuthOptions($ident, $returnUrl);

if ($authOptions) {
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
        // Confirmed (not a guess) via a support ticket with Tebex: this
        // account's Discord integration, role hierarchy, and package
        // config are all correctly set up on the dashboard side, yet
        // this call keeps returning ok=1 with an entry that has no
        // name/url on it — a Tebex-side issue still being chased down.
        //
        // Blocking the sale entirely until Tebex responds isn't worth
        // it — proceed with the purchase anyway (skip the login
        // redirect) so the item can actually be sold, but flag the
        // order clearly so staff know the Discord role for it needs to
        // be granted by hand until this is resolved.
        error_log('MANUAL DISCORD ROLE NEEDED: basket auth required but returned no usable provider for basket ' . $ident . ' (package ' . $packageId . ', user ' . $user['id'] . '): ' . json_encode($authOptions));
        xs_store_finalize_purchase($ident, $packageId, $user, true); // always exits
        exit;
    }

    header('Location: ' . $authUrl);
    exit;
}

xs_store_finalize_purchase($ident, $packageId, $user);

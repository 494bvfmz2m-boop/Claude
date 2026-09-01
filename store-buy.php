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

// Only packages that actually declare Tebex's built-in "discord_id"
// option need the basket-auth/login dance below at all. This used to
// run unconditionally for every purchase — but Tebex's auth check
// looks to be evaluated per-STORE rather than per-package (it's asked
// before the basket even has anything in it), so its current broken
// response was blocking every package's checkout, including ones that
// never required Discord in the first place. Scoping this to packages
// that actually need it fixes that: everything else skips straight to
// checkout, same as before Discord packages existed on this store.
$needsDiscordId = false;
foreach ($package['options'] ?? [] as $opt) {
    if (($opt['type'] ?? '') === 'discord_id') {
        $needsDiscordId = true;
        break;
    }
}

if ($needsDiscordId) {
    // Confirmed working: supplying the customer's already-linked Discord
    // ID directly as the package's "discord_id" option lets Tebex accept
    // the purchase and grant the role via their Discord Servers
    // integration, sidestepping Tebex's own basket-auth login endpoint
    // (which stays broken for this account — see the fallback below).
    if (!empty($user['discord_id'])) {
        [$addOk, , $addErr] = Tebex::addPackage($ident, $packageId, 1, ['discord_id' => $user['discord_id']]);
        if ($addOk) {
            xs_store_record_order($ident, $packageId, $user);
            exit;
        }
        error_log("Tebex rejected client-supplied discord_id for basket {$ident} (package {$packageId}, user {$user['id']}): " . ($addErr ?? 'unknown error') . ' — falling back to the (broken) auth-redirect flow.');
    } else {
        // Nothing to supply yet — send them to link Discord first rather
        // than falling through to Tebex's broken auth flow below, since
        // linking then retrying is the path that's actually known to work.
        header('Location: /discord-link?return_to=' . rawurlencode('/store'));
        exit;
    }

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

    if ($authUrl) {
        header('Location: ' . $authUrl);
        exit;
    }

    if ($authOptions) {
        // Confirmed via Tebex's own error response (not a guess): this
        // package has a required option of Tebex's built-in type
        // "discord_id", which only ever gets filled in by completing
        // the Discord login this auth endpoint is supposed to hand us a
        // URL for. Since it isn't giving us one, that option can never
        // be satisfied through Tebex's own login step while it's
        // broken (and — see above — a client-supplied discord_id
        // either wasn't available to try or was rejected). Block with
        // an honest message instead of trading this for a more
        // confusing failure two steps later.
        error_log('Tebex basket auth required but returned no usable provider for basket ' . $ident . ' (package ' . $packageId . ', user ' . $user['id'] . '): ' . json_encode($authOptions));
        header('Location: /store?error=' . rawurlencode("This item's Discord login isn't set up correctly yet — please contact us if you need it before it's fixed."));
        exit;
    }
    // $authOptions came back empty — no auth actually pending, fall
    // through to a normal checkout below.
}

xs_store_finalize_purchase($ident, $packageId, $user);

<?php
/**
 * Starts the Discord OAuth round trip so a signed-in Xyphros user can
 * link their Discord account (see includes/Discord.php for why). Bounces
 * straight back to wherever they came from — the store, account
 * connections tab, etc. — via ?return_to.
 */
require_once __DIR__ . '/includes/functions.php';

$user = XyphrosAuth::currentUser();
if (!$user) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/discord-link'));
    exit;
}

function xs_safe_local_path(?string $path): string
{
    if (!$path || $path[0] !== '/' || str_starts_with($path, '//')) return '/account?tab=connections';
    return $path;
}

$returnTo = xs_safe_local_path($_GET['return_to'] ?? null);

if (!Discord::configured()) {
    header('Location: ' . $returnTo . (str_contains($returnTo, '?') ? '&' : '?') . 'error=' . rawurlencode('Discord linking isn\'t configured on this site yet.'));
    exit;
}

$state = xs_discord_oauth_state();
// Carry return_to through the round trip inside the state cookie's
// sibling cookie rather than the state value itself, so state stays a
// plain opaque token Discord just echoes back.
setcookie('xs_discord_return', $returnTo, [
    'expires' => time() + 600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);

header('Location: ' . Discord::authorizeUrl($state));
exit;

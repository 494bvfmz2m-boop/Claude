<?php
/**
 * Discord OAuth2 redirect target — registered in the Discord developer
 * portal as DISCORD_OAUTH_REDIRECT_URI. Exchanges the one-time code for
 * an access token just long enough to read the account's id/username,
 * then discards the token — we never need to act as that Discord user
 * again, only know who they are.
 */
require_once __DIR__ . '/includes/functions.php';

function xs_safe_local_path2(?string $path): string
{
    if (!$path || $path[0] !== '/' || str_starts_with($path, '//')) return '/account?tab=connections';
    return $path;
}

$returnTo = xs_safe_local_path2($_COOKIE['xs_discord_return'] ?? null);
$bounce = function (string $message, bool $ok = false) use ($returnTo) {
    $sep = str_contains($returnTo, '?') ? '&' : '?';
    header('Location: ' . $returnTo . $sep . ($ok ? 'discord_linked=1' : 'error=' . rawurlencode($message)));
    exit;
};

$user = XyphrosAuth::currentUser();
if (!$user) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/discord-link'));
    exit;
}

if (!empty($_GET['error'])) {
    $bounce('Discord sign-in was cancelled.');
}

$state = $_GET['state'] ?? null;
if (!xs_discord_oauth_state_verify($state)) {
    $bounce('That Discord link expired — please try again.');
}

$code = $_GET['code'] ?? '';
if ($code === '') {
    $bounce('Something went wrong linking Discord — please try again.');
}

[$tokenOk, $accessToken, $tokenErr] = Discord::exchangeCode($code);
if (!$tokenOk || !$accessToken) {
    error_log('Discord OAuth token exchange failed: ' . ($tokenErr ?? 'unknown error'));
    $bounce('Discord didn\'t confirm that sign-in — please try again.');
}

$identity = Discord::fetchIdentity($accessToken);
if (!$identity) {
    $bounce('Couldn\'t read your Discord profile — please try again.');
}

// One Discord account can only be linked to one Xyphros account —
// keeps "which Discord account is this" unambiguous.
$existingOwner = XyphrosAuth::findByDiscordId($identity['id']);
if ($existingOwner && $existingOwner['id'] !== $user['id']) {
    $bounce('That Discord account is already linked to a different Xyphros account.');
}

XyphrosAuth::updateUser($user['id'], [
    'discord_id' => $identity['id'],
    'discord_username' => $identity['username'],
    'discord_avatar' => Discord::avatarUrl($identity['id'], $identity['avatar']),
    'discord_linked_at' => date('Y-m-d H:i:s'),
]);

setcookie('xs_discord_return', '', ['expires' => time() - 3600, 'path' => '/']);
$bounce('', true);

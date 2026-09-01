<?php
require_once __DIR__ . '/includes/functions.php';

$uid = $_GET['uid'] ?? '';
$token = $_GET['token'] ?? '';

$user = $uid ? XyphrosAuth::findById($uid) : null;
$valid = $user && $token && XyphrosAuth::verifyCode($uid, 'magic_login', $token) !== false;

if ($valid && !empty($user['locked']) && empty($user['is_super_admin'])) {
    $valid = false; // a lock takes precedence even over a just-clicked valid link
}

if ($valid) {
    complete_login($user, SITE_URL . '/account');
    // complete_login() always exits — nothing below this runs on success.
}

$currentPage = 'magic-login';
$pageTitle = 'Sign-in link';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Xyphros account</span>
        <h1>That link isn't valid</h1>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:420px;text-align:center;">
        <p class="lede" style="margin-bottom:24px;">
            This link has already been used, expired, or the account is locked.
        </p>
        <a href="/login" class="btn btn--primary">Back to sign in</a>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

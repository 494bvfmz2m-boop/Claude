<?php
require_once __DIR__ . '/includes/functions.php';

$user = XyphrosAuth::currentUser();
if (!$user) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/set-new-password.php'));
    exit;
}

$returnTo = $_GET['return_to'] ?? SITE_URL . '/account';
if (!str_starts_with($returnTo, SITE_URL) && !preg_match('#^https://[a-z0-9.-]+\.xyphros\.net(/|$)#i', $returnTo)) {
    $returnTo = SITE_URL . '/account'; // never redirect somewhere outside the ecosystem
}

// If they don't actually need to do this (navigated here directly),
// just send them on their way instead of showing a pointless form.
if (empty($user['must_change_password'])) {
    header('Location: ' . $returnTo);
    exit;
}

$currentPage = 'set-new-password';
$pageTitle = 'Set a new password';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!XyphrosAuth::csrfVerify($_POST['csrf_token'] ?? null)) {
        $error = 'That took a bit too long — please try again.';
    } else {
        $pw = $_POST['password'] ?? '';
        $pw2 = $_POST['confirm'] ?? '';
        if (strlen($pw) < 8) {
            $error = 'Password must be at least 8 characters.';
        } elseif ($pw !== $pw2) {
            $error = "Passwords don't match.";
        } else {
            XyphrosAuth::updateUser($user['id'], [
                'password_hash' => XyphrosAuth::hashPassword($pw),
                'must_change_password' => 0,
            ]);
            header('Location: ' . $returnTo);
            exit;
        }
    }
}

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Almost there</span>
        <h1>Set a new password</h1>
        <p class="lede lede--center">Before you continue, choose a password only you know.</p>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:420px;">
        <?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>
        <form method="post" novalidate>
            <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
            <div class="field"><label for="password">New password</label><input type="password" id="password" name="password" required autofocus autocomplete="new-password"></div>
            <div class="field"><label for="confirm">Confirm password</label><input type="password" id="confirm" name="confirm" required autocomplete="new-password"></div>
            <button type="submit" class="btn btn--primary btn--block">Set password &amp; continue</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

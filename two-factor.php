<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (is_logged_in()) redirect(SITE_URL);

if (empty($_SESSION['2fa_pending_uid'])) {
    redirect(SITE_URL . '/login');
}
$pendingUser = find_user_by_id($_SESSION['2fa_pending_uid']);
if (!$pendingUser || empty($pendingUser['two_factor_method'])) {
    redirect(SITE_URL . '/login');
}

$error = null;
$rateLimitId = 'uid:' . $pendingUser['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    if (isset($_POST['resend']) && $pendingUser['two_factor_method'] === 'email') {
        if (rate_limit_exceeded('2fa_resend', $rateLimitId, 3, 600)) {
            $error = 'Too many code requests. Please wait a bit before requesting another.';
        } else {
            rate_limit_record('2fa_resend', $rateLimitId);
            send_two_factor_email_code($pendingUser);
            $resent = true;
        }
    } elseif (rate_limit_exceeded('2fa_verify', $rateLimitId, 8, 600)) {
        $error = 'Too many incorrect codes. Please wait a few minutes and try again.';
    } else {
        $result = verify_two_factor_login($_POST['code'] ?? '');
        if ($result['ok']) {
            redirect(SITE_URL);
        }
        rate_limit_record('2fa_verify', $rateLimitId);
        $error = $result['error'];
    }
}

$pageTitle = 'Verify it\'s you';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card">
    <h1>Verify it's you</h1>
    <?php if ($pendingUser['two_factor_method'] === 'totp'): ?>
      <p class="sub">Enter the 6-digit code from your authenticator app.</p>
    <?php else: ?>
      <p class="sub">We sent a 6-digit code to <?= e($pendingUser['email']) ?>.</p>
    <?php endif; ?>

    <?php if (!empty($resent)): ?><div class="alert alert-success">New code sent.</div><?php endif; ?>
    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

    <form method="post" novalidate>
      <?= csrf_field() ?>
      <div class="field">
        <label for="code">Code</label>
        <input type="text" id="code" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" autofocus style="letter-spacing: 0.3em; text-align: center; font-size: 1.3rem;">
      </div>
      <button type="submit" class="btn btn-primary btn-block">Verify</button>
    </form>

    <?php if ($pendingUser['two_factor_method'] === 'email'): ?>
      <form method="post" style="margin-top:10px;">
        <?= csrf_field() ?>
        <input type="hidden" name="resend" value="1">
        <button type="submit" class="btn btn-outline btn-block">Send a new code</button>
      </form>
    <?php endif; ?>

    <div class="form-foot"><a href="<?= SITE_URL ?>/login">Back to log in</a></div>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

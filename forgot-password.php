<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (is_logged_in()) redirect(SITE_URL);

$submitted = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $ip = client_ip();
    if (!rate_limit_exceeded('password_reset', $ip, 8, 3600)) {
        rate_limit_record('password_reset', $ip);
        request_password_reset($_POST['email'] ?? ''); // always the same UI response either way
    }
    // Same response either way — whether the email existed, or we're quietly
    // throttling — so this page never reveals which happened.
    $submitted = true;
}

$pageTitle = 'Reset password';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card">
    <h1>Reset your password</h1>
    <p class="sub">We'll email you a link to set a new one.</p>

    <?php if ($submitted): ?>
      <div class="alert alert-success">If that email has an account, a reset link is on its way. Check your inbox (and spam folder).</div>
      <div class="form-foot"><a href="<?= SITE_URL ?>/login">Back to log in</a></div>
    <?php else: ?>
      <form method="post" novalidate>
        <?= csrf_field() ?>
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required autofocus>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Send reset link</button>
      </form>
      <div class="form-foot">Remembered it? <a href="<?= SITE_URL ?>/login">Log in</a></div>
    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

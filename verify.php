<?php
require_once __DIR__ . '/includes/bootstrap.php';

$token = $_GET['token'] ?? '';
$ok = verify_email_token($token);

$pageTitle = 'Verify email';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card" style="text-align:center;">
    <?php if ($ok): ?>
      <h1>Email verified 🦥</h1>
      <p class="sub">Your account is active. You can log in now.</p>
      <a href="<?= SITE_URL ?>/login" class="btn btn-primary">Log in</a>
    <?php else: ?>
      <h1>Link invalid or expired</h1>
      <p class="sub">This verification link doesn't work anymore. If you already verified, just log in.</p>
      <a href="<?= SITE_URL ?>/login" class="btn btn-outline">Log in</a>
    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

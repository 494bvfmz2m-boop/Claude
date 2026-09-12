<?php
require_once __DIR__ . '/includes/bootstrap.php';

$token = $_GET['token'] ?? '';
$user = find_user_by_reset_token($token);
$error = null;
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $result = reset_password_with_token($_POST['token'] ?? '', $_POST['password'] ?? '', $_POST['password_confirm'] ?? '');
    if ($result['ok']) {
        $success = true;
    } else {
        $error = $result['error'];
    }
}

$pageTitle = 'Set a new password';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card">
    <h1>Set a new password</h1>

    <?php if ($success): ?>
      <div class="alert alert-success">Your password has been updated. You can log in now.</div>
      <div class="form-foot"><a href="<?= SITE_URL ?>/login" class="btn btn-primary btn-block">Log in</a></div>
    <?php elseif (!$user): ?>
      <div class="alert alert-error">This reset link is invalid or has expired.</div>
      <div class="form-foot"><a href="<?= SITE_URL ?>/forgot-password">Request a new link</a></div>
    <?php else: ?>
      <p class="sub">Choose a new password for <?= e($user['username']) ?>.</p>
      <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
      <form method="post" novalidate>
        <?= csrf_field() ?>
        <input type="hidden" name="token" value="<?= e($token) ?>">
        <div class="field">
          <label for="password">New password</label>
          <input type="password" id="password" name="password" required minlength="8" autofocus autocomplete="new-password">
        </div>
        <div class="field">
          <label for="password_confirm">Confirm new password</label>
          <input type="password" id="password_confirm" name="password_confirm" required minlength="8" autocomplete="new-password">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Update password</button>
      </form>
    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

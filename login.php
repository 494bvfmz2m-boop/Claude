<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (is_logged_in()) redirect(SITE_URL);

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $ip = client_ip();
    if (rate_limit_exceeded('login', $ip, 15, 900)) {
        $error = 'Too many login attempts from your network. Please wait a few minutes and try again.';
    } else {
        $result = login_user($_POST['email'] ?? '', $_POST['password'] ?? '');
        if ($result['ok']) {
            redirect($result['needs_2fa'] ? SITE_URL . '/two-factor' : SITE_URL);
        }
        rate_limit_record('login', $ip);
        $error = $result['error'];
    }
}

$pageTitle = 'Log in';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card">
    <h1>Welcome back</h1>
    <p class="sub">Log in to your account.</p>
    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
    <form method="post" novalidate>
      <?= csrf_field() ?>
      <div class="field">
        <label for="email">Email or username</label>
        <input type="text" id="email" name="email" required value="<?= e($_POST['email'] ?? '') ?>" autocomplete="username">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password">
        <div class="hint"><a href="<?= SITE_URL ?>/forgot-password">Forgot password?</a></div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Log in</button>
    </form>
    <div class="form-foot">Need an account? <a href="<?= SITE_URL ?>/register">Join</a></div>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

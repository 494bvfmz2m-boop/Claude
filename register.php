<?php
require_once __DIR__ . '/includes/bootstrap.php';

if (is_logged_in()) redirect(SITE_URL);

$error = null;
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $ip = client_ip();
    if (!empty($_POST['website'])) {
        // Honeypot field — invisible to real visitors, but bots fill in every field.
        // Pretend it worked so bots don't learn to leave it blank.
        $success = true;
    } elseif (rate_limit_exceeded('register', $ip, 8, 3600)) {
        $error = 'Too many accounts created from your network recently. Please try again later.';
    } else {
        rate_limit_record('register', $ip);
        $result = register_user(
            $_POST['email'] ?? '',
            $_POST['username'] ?? '',
            $_POST['password'] ?? '',
            $_POST['password_confirm'] ?? ''
        );
        if ($result['ok']) {
            $success = true;
        } else {
            $error = $result['error'];
        }
    }
}

$pageTitle = 'Join';
$pageDescription = 'Create an account to join ' . SITE_NAME . ' and get a role.';
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card">
    <h1>Join <?= e($settings['site_name'] ?? SITE_NAME) ?></h1>
    <p class="sub">Create an account to comment on announcements and get a role.</p>

    <?php if ($success): ?>
      <div class="alert alert-success">Almost there! We've sent a verification link to your email — click it to activate your account.</div>
      <div class="form-foot"><a href="<?= SITE_URL ?>/login">Back to log in</a></div>
    <?php else: ?>
      <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
      <form method="post" novalidate>
        <?= csrf_field() ?>
        <div class="hp-field" aria-hidden="true"><label for="website">Leave this field blank</label><input type="text" id="website" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required value="<?= e($_POST['email'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" required value="<?= e($_POST['username'] ?? '') ?>">
          <div class="hint">3-24 characters: letters, numbers, underscores.</div>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
        </div>
        <div class="field">
          <label for="password_confirm">Confirm password</label>
          <input type="password" id="password_confirm" name="password_confirm" required minlength="8" autocomplete="new-password">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Create account</button>
      </form>
      <div class="form-foot">Already have an account? <a href="<?= SITE_URL ?>/login">Log in</a></div>
    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

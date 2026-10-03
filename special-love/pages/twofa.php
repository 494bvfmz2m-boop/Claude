<?php
$GLOBALS['page_title'] = 'Two-step verification';
$GLOBALS['page_desc'] = 'Enter the 6-digit code from your authenticator app.';

$uid = $_SESSION['pending_2fa_uid'] ?? null;
if (!$uid) redirect('?p=login');
$user = one('SELECT * FROM users WHERE id = ?', [$uid]);
if (!$user) { unset($_SESSION['pending_2fa_uid']); redirect('?p=login'); }

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!throttle('2fa', 10)) {
        $error = 'Too many attempts. Please wait and try again.';
    } elseif (totp_verify((string)$user['totp_secret'], (string)($_POST['code'] ?? ''))) {
        clear_throttle('2fa');
        login_user($user);
        flash('Signed in.');
        redirect(is_staff() ? '?p=admin' : '?p=account');
    } else {
        $error = 'That code is not right. Codes change every 30 seconds.';
    }
}
?>
<div class="card anim-pop" style="max-width:400px;margin:24px auto;text-align:center">
  <div class="anim-float" style="font-size:2.4rem">&#128274;</div>
  <h1>Two-step verification</h1>
  <p class="muted small">Enter the 6-digit code from your authenticator app.</p>
  <?php if ($error): ?><div class="note err anim-pop"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required autofocus
      style="text-align:center;font-size:1.6rem;letter-spacing:.4em"></label>
    <button class="btn hover-sheen" type="submit" style="width:100%">Verify</button>
  </form>
  <p class="small muted" style="margin-top:12px"><a href="<?= e(url('?p=logout')) ?>">Cancel</a></p>
</div>

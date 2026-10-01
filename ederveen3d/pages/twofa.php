<?php
$GLOBALS['page_title'] = 'Tweestapsverificatie';
$GLOBALS['page_desc'] = 'Vul de 6-cijferige code uit je authenticator-app in.';

$uid = $_SESSION['pending_2fa_uid'] ?? null;
if (!$uid) redirect('?p=login');
$user = one('SELECT * FROM users WHERE id = ?', [$uid]);
if (!$user) { unset($_SESSION['pending_2fa_uid']); redirect('?p=login'); }

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!throttle('2fa', 10)) {
        $error = 'Te veel pogingen. Wacht even en probeer het opnieuw.';
    } elseif (totp_verify((string)$user['totp_secret'], (string)($_POST['code'] ?? ''))) {
        clear_throttle('2fa');
        login_user($user);
        flash('Ingelogd.');
        redirect(is_staff() ? '?p=admin' : '?p=account');
    } else {
        $error = 'Deze code klopt niet. De code verandert elke 30 seconden.';
    }
}
?>
<div class="card anim-pop" style="max-width:400px;margin:24px auto;text-align:center">
  <div class="anim-float" style="font-size:2.4rem">&#128274;</div>
  <h1>Tweestapsverificatie</h1>
  <p class="muted small">Vul de 6-cijferige code uit je authenticator-app in.</p>
  <?php if ($error): ?><div class="note err anim-pop"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required autofocus
      style="text-align:center;font-size:1.6rem;letter-spacing:.4em"></label>
    <button class="btn hover-sheen" type="submit" style="width:100%">Controleren</button>
  </form>
  <p class="small muted" style="margin-top:12px"><a href="<?= e(url('?p=logout')) ?>">Annuleren</a></p>
</div>

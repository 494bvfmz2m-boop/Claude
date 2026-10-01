<?php
require_login();
$GLOBALS['page_title'] = 'Security - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Change your password and manage two-step verification.';
$u = current_user();
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    if ($action === 'password') {
        $cur = (string)($_POST['current'] ?? '');
        $new = (string)($_POST['new'] ?? '');
        $rep = (string)($_POST['repeat'] ?? '');
        if (!password_verify($cur, $u['password_hash'])) $errors[] = 'Your current password is not right.';
        if (strlen($new) < 10) $errors[] = 'New password must be at least 10 characters.';
        if ($new !== $rep) $errors[] = 'The new passwords do not match.';
        if (!$errors) {
            q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
            flash('Password changed.');
            redirect('?p=security');
        }
    } elseif ($action === 'start2fa') {
        $_SESSION['totp_setup'] = totp_secret();
        redirect('?p=security#twofa');
    } elseif ($action === 'confirm2fa') {
        $secret = $_SESSION['totp_setup'] ?? '';
        if ($secret && totp_verify($secret, (string)($_POST['code'] ?? ''))) {
            q('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?', [$secret, $u['id']]);
            unset($_SESSION['totp_setup']);
            flash('Two-step verification is on.');
            redirect('?p=security');
        }
        $errors[] = 'That code did not match. Try the next code from your app.';
    } elseif ($action === 'off2fa') {
        if (!password_verify((string)($_POST['current'] ?? ''), $u['password_hash'])) {
            $errors[] = 'Enter your password to switch two-step verification off.';
        } else {
            q('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?', [$u['id']]);
            flash('Two-step verification is off.', 'warn');
            redirect('?p=security');
        }
    }
}

$setupSecret = $_SESSION['totp_setup'] ?? null;
$enabled = (int)$u['totp_enabled'] === 1;
?>
<h1>Security</h1>
<div class="tabs">
  <a class="tab" href="<?= e(url('?p=account')) ?>">Orders &amp; requests</a>
  <a class="tab active" href="<?= e(url('?p=security')) ?>">Security</a>
</div>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <div class="card">
    <h2>Change password</h2>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="password">
      <label>Current password <input type="password" name="current" required></label>
      <label>New password <input type="password" name="new" required></label>
      <label>Repeat new password <input type="password" name="repeat" required></label>
      <button class="btn" type="submit">Save password</button>
    </form>
  </div>

  <div class="card" id="twofa">
    <h2>Two-step verification</h2>
    <?php if ($enabled): ?>
      <p class="note ok">Two-step verification is switched on.</p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="off2fa">
        <label>Password <input type="password" name="current" required></label>
        <button class="btn danger" type="submit">Switch off</button>
      </form>
    <?php elseif ($setupSecret): ?>
      <p class="muted small">Scan this with Google Authenticator, Authy or 1Password, then enter the code.</p>
      <img class="anim-pop" style="background:#fff;padding:8px;border-radius:10px"
           src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=<?= urlencode(totp_uri($setupSecret, $u['email'], setting('store_name', 'Special Love'))) ?>"
           alt="Setup QR code">
      <p class="small muted">Can't scan? Enter this key: <code><?= e($setupSecret) ?></code></p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="confirm2fa">
        <label>6-digit code <input name="code" maxlength="6" inputmode="numeric" required></label>
        <button class="btn" type="submit">Turn on</button>
      </form>
    <?php else: ?>
      <p class="muted">Add a second step at sign-in using an authenticator app. Strongly recommended for admin accounts.</p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="start2fa">
        <button class="btn hover-sheen" type="submit">Set up two-step verification</button>
      </form>
    <?php endif; ?>
  </div>
</div>

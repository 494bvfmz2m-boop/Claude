<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_login();
$me = current_user();

$error = null;
$success = null;
$totpError = null;
$passwordError = null;
$mcError = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? 'rename';

    if ($action === 'rename') {
        $result = rename_user($me['id'], $_POST['username'] ?? '');
        if ($result['ok']) {
            $success = 'Username updated.';
            $me = find_user_by_id($me['id']);
        } else {
            $error = $result['error'];
        }
    }

    if ($action === 'change_password') {
        $result = change_password(
            $me['id'],
            $_POST['current_password'] ?? '',
            $_POST['new_password'] ?? '',
            $_POST['new_password_confirm'] ?? ''
        );
        if ($result['ok']) {
            $success = 'Password updated.';
            $me = find_user_by_id($me['id']);
        } else {
            $passwordError = $result['error'];
        }
    }

    if ($action === 'set_minecraft_username') {
        $result = set_account_minecraft_username($me['id'], $_POST['minecraft_username'] ?? '');
        if ($result['ok']) {
            $success = 'Minecraft username saved.';
            $me = find_user_by_id($me['id']);
        } else {
            $mcError = $result['error'];
        }
    }

    if ($action === 'start_totp') {
        begin_totp_setup($me['id']);
        redirect(SITE_URL . '/account?setup=totp');
    }

    if ($action === 'confirm_totp') {
        if (confirm_totp_setup($me['id'], $_POST['code'] ?? '')) {
            redirect(SITE_URL . '/account?tfa=on');
        }
        $totpError = 'That code didn\'t match. Make sure your app is showing the current code and try again.';
        $me = find_user_by_id($me['id']);
    }

    if ($action === 'enable_email_2fa') {
        enable_email_two_factor($me['id']);
        redirect(SITE_URL . '/account?tfa=on');
    }

    if ($action === 'disable_2fa') {
        if (!password_verify($_POST['current_password'] ?? '', $me['password_hash'])) {
            $error = 'Incorrect password.';
        } else {
            disable_two_factor($me['id']);
            redirect(SITE_URL . '/account?tfa=off');
        }
    }
}

if (isset($_GET['tfa']) && $_GET['tfa'] === 'on') $success = 'Two-factor authentication is on.';
if (isset($_GET['tfa']) && $_GET['tfa'] === 'off') $success = 'Two-factor authentication is off.';

$settingUpTotp = isset($_GET['setup']) && $_GET['setup'] === 'totp' && $me['two_factor_method'] !== 'totp' && !empty($me['totp_secret']);

$pageTitle = 'Your account';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="form-card">
    <h1>Your account</h1>
    <p class="sub">Manage your profile.</p>

    <?php if ($success): ?><div class="alert alert-success"><?= e($success) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

    <form method="post" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="rename">
      <div class="field">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required value="<?= e($me['username']) ?>">
        <div class="hint">3-24 characters: letters, numbers, underscores.</div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Save username</button>
    </form>

    <div class="field" style="margin-top:26px;">
      <label>Email</label>
      <input type="text" value="<?= e($me['email']) ?>" disabled>
      <div class="hint">Email can't be changed here yet — ask a Core team member if you need it updated.</div>
    </div>
  </div>

  <div class="form-card" style="margin-top:20px;">
    <h1 style="font-size:1.3rem;">Minecraft username</h1>
    <p class="sub">Saved here so it's pre-filled at store checkout — no need to retype it every purchase.</p>
    <?php if ($mcError): ?><div class="alert alert-error"><?= e($mcError) ?></div><?php endif; ?>
    <form method="post" style="display:flex; gap:8px; align-items:flex-end;">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="set_minecraft_username">
      <div class="field" style="margin-bottom:0; flex:1;">
        <input type="text" name="minecraft_username" value="<?= e($me['minecraft_username'] ?? '') ?>" placeholder="Your in-game username">
      </div>
      <button type="submit" class="btn btn-outline">Save</button>
    </form>
  </div>

  <div class="form-card" style="margin-top:20px;">
    <h1 style="font-size:1.3rem;">Change password</h1>
    <p class="sub">Update your password without leaving the site.</p>
    <?php if ($passwordError): ?><div class="alert alert-error"><?= e($passwordError) ?></div><?php endif; ?>
    <form method="post" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="change_password">
      <div class="field">
        <label for="current_password">Current password</label>
        <input type="password" id="current_password" name="current_password" required autocomplete="current-password">
      </div>
      <div class="field">
        <label for="new_password">New password</label>
        <input type="password" id="new_password" name="new_password" required minlength="8" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="new_password_confirm">Confirm new password</label>
        <input type="password" id="new_password_confirm" name="new_password_confirm" required minlength="8" autocomplete="new-password">
      </div>
      <button type="submit" class="btn btn-primary">Update password</button>
    </form>
  </div>

  <div class="form-card" style="margin-top:20px;">
    <h1 style="font-size:1.3rem;">Two-factor authentication</h1>

    <?php if ($me['two_factor_method'] === 'totp'): ?>
      <p class="sub">Currently on, using an <strong>authenticator app</strong>.</p>
    <?php elseif ($me['two_factor_method'] === 'email'): ?>
      <p class="sub">Currently on, using <strong>email codes</strong>.</p>
    <?php else: ?>
      <p class="sub">Currently off. Turning this on means you'll need a code from your phone (or email) every time you log in, on top of your password.</p>
    <?php endif; ?>

    <?php if ($settingUpTotp): ?>
      <div class="card">
        <h2 style="margin-top:0; font-size:1.05rem;">Scan this with your authenticator app</h2>
        <?php if ($totpError): ?><div class="alert alert-error"><?= e($totpError) ?></div><?php endif; ?>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=<?= rawurlencode(totp_provisioning_uri($me['totp_secret'], $me['username'])) ?>" alt="QR code for authenticator app setup" style="border-radius:8px; display:block; margin:0 auto 16px;" width="220" height="220">
        <p class="hint" style="text-align:center;">Can't scan? Enter this code manually in your app:</p>
        <div class="ticket-guest-link" style="text-align:center; letter-spacing:0.15em;"><?= e(chunk_split($me['totp_secret'], 4, ' ')) ?></div>
        <p class="hint">The QR code is rendered by a third-party image service (api.qrserver.com) — your secret is sent to them as part of that image request. If that's not okay for your setup, use the manual code above and type it into your app directly instead of scanning.</p>

        <form method="post" style="margin-top:16px;">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="confirm_totp">
          <div class="field">
            <label for="code">Enter the 6-digit code from the app to confirm</label>
            <input type="text" id="code" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autofocus style="letter-spacing: 0.3em; text-align: center; font-size: 1.3rem;">
          </div>
          <button type="submit" class="btn btn-primary btn-block">Confirm and turn on</button>
        </form>
      </div>
    <?php elseif (empty($me['two_factor_method'])): ?>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="start_totp">
          <button type="submit" class="btn btn-primary">Set up authenticator app</button>
        </form>
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="enable_email_2fa">
          <button type="submit" class="btn btn-outline">Use email codes instead</button>
        </form>
      </div>
    <?php else: ?>
      <form method="post" style="margin-top:14px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="disable_2fa">
        <div class="field">
          <label for="disable_2fa_password">Enter your password to turn it off</label>
          <input type="password" id="disable_2fa_password" name="current_password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-danger">Turn off two-factor authentication</button>
      </form>
    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

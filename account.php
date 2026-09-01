<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/XyphrosAuth.php';
require_once __DIR__ . '/includes/mailer.php';

$currentPage = 'account';
$pageTitle = 'Your account';

$me = XyphrosAuth::currentUser();
if (!$me) {
    header('Location: /login?return_to=' . rawurlencode(SITE_URL . '/account'));
    exit;
}

$error = '';
$success = '';
$tab = $_GET['tab'] ?? 'profile';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!XyphrosAuth::csrfVerify($_POST['csrf_token'] ?? null)) {
        $error = 'That took a bit too long and your session moved on — please try again.';
    } else {
        $action = $_POST['action'] ?? '';

        if ($action === 'profile_save') {
            $name = trim($_POST['name'] ?? '');
            if ($name === '') {
                $error = 'Name can\'t be empty.'; $tab = 'profile';
            } else {
                XyphrosAuth::updateUser($me['id'], ['name' => $name]);
                $success = 'Profile updated.'; $tab = 'profile';
            }
        }

        if ($action === 'avatar_upload') {
            try {
                $url = handle_image_upload('avatar', UPLOADS_DIR . '/avatars', SITE_URL . UPLOADS_URL . '/avatars');
                if ($url) {
                    delete_uploaded_file(str_replace(SITE_URL, '', $me['avatar'] ?? ''));
                    XyphrosAuth::updateUser($me['id'], ['avatar' => $url]);
                    $success = 'Profile picture updated.';
                } else {
                    $error = 'Choose an image to upload.';
                }
            } catch (RuntimeException $e) {
                $error = $e->getMessage();
            }
            $tab = 'profile';
        }

        if ($action === 'avatar_remove') {
            delete_uploaded_file(str_replace(SITE_URL, '', $me['avatar'] ?? ''));
            XyphrosAuth::updateUser($me['id'], ['avatar' => null]);
            $success = 'Profile picture removed.'; $tab = 'profile';
        }

        if ($action === 'email_change_request') {
            $newEmail = trim(strtolower($_POST['new_email'] ?? ''));
            if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
                $error = 'That email address doesn\'t look right.'; $tab = 'profile';
            } elseif (XyphrosAuth::findByEmail($newEmail)) {
                $error = 'That email is already in use by another account.'; $tab = 'profile';
            } else {
                $code = XyphrosAuth::generateCode($me['id'], 'email_change', $newEmail, 900);
                send_smtp_mail(
                    $newEmail,
                    'Confirm your new Xyphros email',
                    "Your verification code is:\n\n    {$code}\n\nThis code expires in 15 minutes. If you didn't request this, you can safely ignore it.",
                    [],
                    render_code_email(
                        'Confirm your new email',
                        "Enter this code to confirm <strong>" . e($newEmail) . "</strong> as your new Xyphros account email. It expires in 15 minutes.",
                        $code
                    )
                );
                $success = "We sent a code to {$newEmail}. Enter it below to confirm the change.";
                $tab = 'verify_email';
            }
        }

        if ($action === 'email_change_verify') {
            $entered = preg_replace('/\D/', '', $_POST['code'] ?? '');
            $newEmail = XyphrosAuth::verifyCode($me['id'], 'email_change', $entered);
            if ($newEmail === false) {
                $error = 'Incorrect or expired code.'; $tab = 'verify_email';
            } else {
                XyphrosAuth::updateUser($me['id'], ['email' => $newEmail]);
                $success = 'Email updated to ' . $newEmail . '.'; $tab = 'profile';
            }
        }

        if ($action === 'password_change') {
            $current = $_POST['current_password'] ?? '';
            $new = $_POST['new_password'] ?? '';
            $confirm = $_POST['confirm_password'] ?? '';
            if (!XyphrosAuth::verifyPassword($current, $me['password_hash'])) {
                $error = 'Current password is incorrect.'; $tab = 'security';
            } elseif (strlen($new) < 8) {
                $error = 'New password must be at least 8 characters.'; $tab = 'security';
            } elseif ($new !== $confirm) {
                $error = 'New passwords don\'t match.'; $tab = 'security';
            } else {
                XyphrosAuth::updateUser($me['id'], ['password_hash' => XyphrosAuth::hashPassword($new)]);
                XyphrosAuth::destroyAllSessions($me['id'], $_COOKIE[COOKIE_NAME] ?? null);
                $success = 'Password changed. Every other device has been signed out.'; $tab = 'security';
            }
        }

        if ($action === 'enable_email_2fa') {
            XyphrosAuth::updateUser($me['id'], ['twofa_method' => 'email', 'totp_secret' => null, 'totp_confirmed' => 0]);
            $success = 'Email 2FA enabled — you\'ll get a code at every sign-in.'; $tab = 'security';
        }

        if ($action === 'disable_2fa') {
            XyphrosAuth::updateUser($me['id'], ['twofa_method' => 'none', 'totp_secret' => null, 'totp_confirmed' => 0]);
            $success = '2FA disabled.'; $tab = 'security';
        }

        if ($action === 'totp_start') {
            $secret = XyphrosAuth::generateTotpSecret();
            XyphrosAuth::updateUser($me['id'], ['totp_secret' => $secret, 'totp_confirmed' => 0]);
            $tab = 'security';
        }

        if ($action === 'totp_confirm') {
            $fresh = XyphrosAuth::findById($me['id']);
            $entered = $_POST['code'] ?? '';
            if (empty($fresh['totp_secret'])) {
                $error = 'Setup session expired — start again.'; $tab = 'security';
            } elseif (!XyphrosAuth::verifyTotp($fresh['totp_secret'], $entered)) {
                $error = 'That code didn\'t match. Check your phone\'s clock and try again.'; $tab = 'security';
            } else {
                XyphrosAuth::updateUser($me['id'], ['twofa_method' => 'totp', 'totp_confirmed' => 1]);
                $success = 'Authenticator app connected.'; $tab = 'security';
            }
        }

        if ($action === 'totp_cancel') {
            XyphrosAuth::updateUser($me['id'], ['totp_secret' => null, 'totp_confirmed' => 0]);
            $tab = 'security';
        }

        if ($action === 'session_revoke') {
            XyphrosAuth::revokeSession($me['id'], $_POST['session_id'] ?? '');
            $success = 'Device signed out.'; $tab = 'sessions';
        }

        if ($action === 'session_revoke_all') {
            XyphrosAuth::destroyAllSessions($me['id'], $_COOKIE[COOKIE_NAME] ?? null);
            $success = 'Every other device has been signed out.'; $tab = 'sessions';
        }

        if ($action === 'discord_unlink') {
            XyphrosAuth::updateUser($me['id'], [
                'discord_id' => null, 'discord_username' => null,
                'discord_avatar' => null, 'discord_linked_at' => null,
            ]);
            $success = 'Discord account unlinked.'; $tab = 'connections';
        }
    }
}

if (isset($_GET['discord_linked'])) { $success = 'Discord account linked.'; $tab = 'connections'; }
if (isset($_GET['error']) && $tab === 'connections') { $error = $_GET['error']; }

// Re-fetch fresh after any writes above.
$user = XyphrosAuth::findById($me['id']);
$isSuperAdmin = !empty($user['is_super_admin']);

require __DIR__ . '/includes/header.php';
?>
<style>
.acct-hero { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 36px 40px; display: flex; align-items: center; gap: 26px; flex-wrap: wrap; margin-bottom: 32px; position: relative; overflow: hidden; }
.acct-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(600px 200px at 0% 0%, rgba(86,0,249,.14), transparent 60%); pointer-events: none; }
.acct-hero__avatar { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-strong); flex-shrink: 0; position: relative; z-index: 1; }
.acct-hero__avatar--placeholder { display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 30px; color: #fff; background: var(--gradient); }
.acct-hero__body { position: relative; z-index: 1; min-width: 0; }
.acct-hero__name { font-family: var(--font-display); font-size: 26px; letter-spacing: .01em; margin: 0 0 4px; text-transform: none; }
.acct-hero__email { color: var(--text-muted); font-size: 14.5px; margin: 0 0 10px; }
.acct-hero__badges { display: flex; gap: 8px; flex-wrap: wrap; }
.acct-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 100px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
.acct-badge--admin { background: rgba(238,0,243,.12); color: #ff8dff; border: 1px solid rgba(238,0,243,.35); }
.acct-badge--verified { background: rgba(61,220,151,.12); color: var(--online); border: 1px solid rgba(61,220,151,.35); }
.acct-badge--muted { background: var(--bg-elevated); color: var(--text-faint); border: 1px solid var(--border); }

.acct-wrap { display: grid; grid-template-columns: 230px 1fr; gap: 40px; align-items: start; }
@media (max-width: 800px) { .acct-wrap { grid-template-columns: 1fr; } .acct-hero { padding: 28px 24px; } }

.acct-nav { display: flex; flex-direction: column; gap: 3px; position: sticky; top: 90px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; }
.acct-nav a { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--radius-sm); color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 600; transition: background .15s, color .15s; }
.acct-nav a svg { width: 17px; height: 17px; flex-shrink: 0; opacity: .75; }
.acct-nav a:hover { background: var(--bg-card-hover); color: var(--text); }
.acct-nav a.is-active { background: var(--gradient-soft); color: var(--text); }
.acct-nav a.is-active svg { opacity: 1; }

.acct-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 30px 32px; }
.acct-card + .acct-card { margin-top: 18px; }
.acct-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 4px; }
.acct-card__icon { width: 38px; height: 38px; border-radius: 11px; background: var(--gradient-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.acct-card__icon svg { width: 19px; height: 19px; color: var(--magenta); }
.acct-card h2 { font-size: 17px; margin: 0 0 3px; font-weight: 800; }
.acct-card p.hint { color: var(--text-muted); font-size: 13.8px; margin: 0 0 22px; line-height: 1.6; }
.acct-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }

.avatar-row { display: flex; align-items: center; gap: 20px; margin-bottom: 26px; }
.avatar-upload { position: relative; width: 76px; height: 76px; flex-shrink: 0; }
.avatar-preview { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; background: var(--gradient); border: 1px solid var(--border-strong); display: block; }
.avatar-preview--placeholder { display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 26px; color: #fff; }
.avatar-upload label.avatar-edit { position: absolute; bottom: -2px; right: -2px; width: 28px; height: 28px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border-strong); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
.avatar-upload label.avatar-edit:hover { background: var(--gradient); }
.avatar-upload label.avatar-edit svg { width: 13px; height: 13px; color: var(--text); }

.twofa-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 100px; font-size: 12.5px; font-weight: 700; }
.twofa-badge--on { background: rgba(61, 220, 151, 0.12); color: var(--online); border: 1px solid rgba(61, 220, 151, 0.35); }
.twofa-badge--off { background: var(--bg-elevated); color: var(--text-faint); border: 1px solid var(--border); }

.method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 4px; }
@media (max-width: 560px) { .method-grid { grid-template-columns: 1fr; } }
.method-card { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px; text-align: left; background: var(--bg-elevated); cursor: pointer; width: 100%; font-family: inherit; color: inherit; appearance: none; transition: border-color .15s, background .15s; }
.method-card:hover { border-color: var(--border-strong); }
.method-card--active { border-color: var(--magenta); background: var(--gradient-soft); }
.method-card__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.method-card__icon { width: 30px; height: 30px; border-radius: 9px; background: var(--bg-card); display: flex; align-items: center; justify-content: center; }
.method-card__icon svg { width: 16px; height: 16px; color: var(--text-muted); }
.method-card--active .method-card__icon { background: var(--gradient); }
.method-card--active .method-card__icon svg { color: #fff; }
.method-card__check { width: 20px; height: 20px; border-radius: 50%; background: var(--online); display: flex; align-items: center; justify-content: center; }
.method-card__check svg { width: 11px; height: 11px; color: #05130c; stroke-width: 3; }
.method-card__title { font-weight: 700; font-size: 14.5px; margin-bottom: 2px; }
.method-card__desc { font-size: 12.5px; color: var(--text-faint); line-height: 1.5; }

.session-row { display: flex; align-items: center; gap: 14px; padding: 15px 0; border-bottom: 1px solid var(--border); }
.session-row:last-child { border-bottom: none; }
.session-row--current { position: relative; }
.session-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.session-icon svg { width: 17px; height: 17px; color: var(--text-muted); }
.qr-box { text-align: center; background: #fff; padding: 16px; border-radius: var(--radius-md); display: inline-block; margin-bottom: 16px; }
.product-row { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--border); }
.product-row:last-child { border-bottom: none; }
.product-row__icon { width: 38px; height: 38px; border-radius: 11px; background: var(--gradient-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.product-row__icon svg { width: 18px; height: 18px; color: var(--magenta); }

.acct-card__icon--discord { background: rgba(88, 101, 242, 0.16); }
.acct-card__icon--discord svg { color: #5865F2; }
.connection-row { display: flex; align-items: center; gap: 16px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-elevated); flex-wrap: wrap; }
.connection-row--linked { border-color: rgba(88, 101, 242, 0.3); background: rgba(88, 101, 242, 0.06); }
.connection-row__avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.connection-row__avatar--placeholder { display: flex; align-items: center; justify-content: center; background: #5865F2; color: #fff; }
</style>

<section class="section" style="padding-top:48px;">
    <div class="container">
        <div class="acct-hero">
            <?php if (!empty($user['avatar'])): ?>
                <img src="<?php echo e($user['avatar']); ?>" class="acct-hero__avatar" alt="">
            <?php else: ?>
                <div class="acct-hero__avatar acct-hero__avatar--placeholder"><?php echo e(strtoupper(substr($user['name'] ?: $user['username'], 0, 1))); ?></div>
            <?php endif; ?>
            <div class="acct-hero__body">
                <h1 class="acct-hero__name"><?php echo e($user['name'] ?: $user['username']); ?></h1>
                <p class="acct-hero__email"><?php echo e($user['email']); ?> &middot; member since <?php echo e(date('F Y', strtotime($user['created_at'] ?? 'now'))); ?></p>
                <div class="acct-hero__badges">
                    <?php if ($isSuperAdmin): ?><span class="acct-badge acct-badge--admin"><?php echo xs_icon('shield'); ?> Founder</span><?php endif; ?>
                    <?php if (!empty($user['is_xyphros_staff']) && !$isSuperAdmin): ?><span class="acct-badge acct-badge--muted">Xyphros staff</span><?php endif; ?>
                    <?php if (!empty($user['is_portal_staff']) && !$isSuperAdmin): ?><span class="acct-badge acct-badge--muted">Portal staff</span><?php endif; ?>
                    <?php if (!empty($user['email_verified'])): ?><span class="acct-badge acct-badge--verified"><?php echo xs_icon('check'); ?> Verified</span><?php endif; ?>
                    <span class="acct-badge acct-badge--muted"><?php echo ($user['twofa_method'] ?? 'none') !== 'none' ? '2FA on' : '2FA off'; ?></span>
                </div>
            </div>
        </div>

        <?php if ($error): ?><div class="alert alert--error" style="margin-bottom:24px;"><?php echo e($error); ?></div><?php endif; ?>
        <?php if ($success): ?><div class="alert alert--success" style="margin-bottom:24px;"><?php echo e($success); ?></div><?php endif; ?>

        <div class="acct-wrap">
            <nav class="acct-nav">
                <a href="/account?tab=profile" class="<?php echo $tab === 'profile' || $tab === 'verify_email' ? 'is-active' : ''; ?>"><?php echo xs_icon('user'); ?> Profile</a>
                <a href="/account?tab=security" class="<?php echo $tab === 'security' ? 'is-active' : ''; ?>"><?php echo xs_icon('shield'); ?> Password &amp; 2FA</a>
                <a href="/account?tab=connections" class="<?php echo $tab === 'connections' ? 'is-active' : ''; ?>"><?php echo xs_icon('external'); ?> Connections</a>
                <a href="/account?tab=sessions" class="<?php echo $tab === 'sessions' ? 'is-active' : ''; ?>"><?php echo xs_icon('monitor'); ?> Devices</a>
                <a href="/account?tab=orders" class="<?php echo $tab === 'orders' ? 'is-active' : ''; ?>"><?php echo xs_icon('box'); ?> Orders</a>
                <?php if ($isSuperAdmin): ?>
                <a href="/account?tab=products" class="<?php echo $tab === 'products' ? 'is-active' : ''; ?>"><?php echo xs_icon('grid'); ?> Products</a>
                <?php endif; ?>
            </nav>

            <div>
            <?php if ($tab === 'verify_email'): ?>
                <div class="acct-card" style="max-width:420px;">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('mail'); ?></div></div>
                    <h2>Confirm your new email</h2>
                    <p class="hint">Enter the 6-digit code we just sent.</p>
                    <form method="post">
                        <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                        <input type="hidden" name="action" value="email_change_verify">
                        <div class="field">
                            <input type="text" name="code" inputmode="numeric" maxlength="6" required autofocus
                                style="text-align:center;font-size:26px;font-weight:700;letter-spacing:.4em;font-family:var(--font-mono);">
                        </div>
                        <button type="submit" class="btn btn--primary btn--block">Confirm</button>
                    </form>
                </div>

            <?php elseif ($tab === 'security'): ?>
                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('key'); ?></div></div>
                    <h2>Password</h2>
                    <p class="hint">Changing your password signs out every other device.</p>
                    <form method="post">
                        <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                        <input type="hidden" name="action" value="password_change">
                        <div class="field"><label>Current password</label><input type="password" name="current_password" required autocomplete="current-password"></div>
                        <div class="field"><label>New password</label><input type="password" name="new_password" required autocomplete="new-password"></div>
                        <div class="field"><label>Confirm new password</label><input type="password" name="confirm_password" required autocomplete="new-password"></div>
                        <button type="submit" class="btn btn--primary">Change password</button>
                    </form>
                </div>

                <div class="acct-card">
                    <?php $method = $user['twofa_method'] ?? 'none'; ?>
                    <div class="acct-card__head">
                        <div class="acct-card__icon"><?php echo xs_icon('shield'); ?></div>
                        <span class="twofa-badge <?php echo $method !== 'none' ? 'twofa-badge--on' : 'twofa-badge--off'; ?>">
                            <?php echo $method === 'totp' ? 'Authenticator app' : ($method === 'email' ? 'Email codes' : 'Off'); ?>
                        </span>
                    </div>
                    <h2>Two-factor authentication</h2>
                    <p class="hint">This is the only place to manage 2FA for your Xyphros account.</p>

                    <?php if (!empty($user['totp_secret']) && empty($user['totp_confirmed'])): ?>
                        <?php $qrData = XyphrosAuth::totpProvisioningUri($user['totp_secret'], $user['email'], 'Xyphros'); ?>
                        <p style="margin-bottom:14px;">Scan this with Google Authenticator, 1Password, Authy, or any TOTP app:</p>
                        <div class="qr-box">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=<?php echo urlencode($qrData); ?>" width="200" height="200" alt="QR code">
                        </div>
                        <p class="hint">Can't scan it? Enter this key manually: <code style="color:var(--text);"><?php echo e($user['totp_secret']); ?></code></p>
                        <form method="post" style="max-width:280px;">
                            <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                            <input type="hidden" name="action" value="totp_confirm">
                            <div class="field">
                                <label>Enter the 6-digit code</label>
                                <input type="text" name="code" inputmode="numeric" maxlength="6" required autofocus
                                    style="text-align:center;font-size:24px;font-weight:700;letter-spacing:.3em;font-family:var(--font-mono);">
                            </div>
                            <button type="submit" class="btn btn--primary btn--block">Confirm and enable</button>
                        </form>
                        <form method="post" style="margin-top:10px;">
                            <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                            <input type="hidden" name="action" value="totp_cancel">
                            <button type="submit" style="background:none;border:none;cursor:pointer;color:var(--text-faint);font-size:13px;">Cancel setup</button>
                        </form>
                    <?php elseif (in_array($method, ['totp', 'email'], true)): ?>
                        <div class="method-grid">
                            <div class="method-card <?php echo $method === 'totp' ? 'method-card--active' : ''; ?>">
                                <div class="method-card__top">
                                    <div class="method-card__icon"><?php echo xs_icon('phone'); ?></div>
                                    <?php if ($method === 'totp'): ?><div class="method-card__check"><?php echo xs_icon('check'); ?></div><?php endif; ?>
                                </div>
                                <div class="method-card__title">Authenticator app</div>
                                <div class="method-card__desc">6-digit code from an app like Google Authenticator or 1Password.</div>
                            </div>
                            <div class="method-card <?php echo $method === 'email' ? 'method-card--active' : ''; ?>">
                                <div class="method-card__top">
                                    <div class="method-card__icon"><?php echo xs_icon('mail'); ?></div>
                                    <?php if ($method === 'email'): ?><div class="method-card__check"><?php echo xs_icon('check'); ?></div><?php endif; ?>
                                </div>
                                <div class="method-card__title">Email code</div>
                                <div class="method-card__desc">6-digit code sent to <?php echo e($user['email']); ?>.</div>
                            </div>
                        </div>
                        <div class="btn-row" style="margin-top:18px;">
                            <?php if ($method === 'email'): ?>
                            <form method="post"><input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>"><input type="hidden" name="action" value="totp_start">
                                <button type="submit" class="btn btn--ghost btn--sm">Switch to authenticator app</button></form>
                            <?php else: ?>
                            <form method="post"><input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>"><input type="hidden" name="action" value="enable_email_2fa">
                                <button type="submit" class="btn btn--ghost btn--sm">Switch to email codes</button></form>
                            <?php endif; ?>
                            <form method="post"><input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>"><input type="hidden" name="action" value="disable_2fa">
                                <button type="submit" class="btn btn--danger btn--sm">Disable 2FA</button></form>
                        </div>
                    <?php else: ?>
                        <p style="margin-bottom:18px;">2FA is off. Pick a method to turn it on.</p>
                        <div class="method-grid">
                            <form method="post"><input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>"><input type="hidden" name="action" value="totp_start">
                                <button type="submit" class="method-card" style="text-align:left;">
                                    <div class="method-card__top"><div class="method-card__icon"><?php echo xs_icon('phone'); ?></div></div>
                                    <div class="method-card__title">Authenticator app</div>
                                    <div class="method-card__desc">6-digit code from an app like Google Authenticator or 1Password.</div>
                                </button>
                            </form>
                            <form method="post"><input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>"><input type="hidden" name="action" value="enable_email_2fa">
                                <button type="submit" class="method-card" style="text-align:left;">
                                    <div class="method-card__top"><div class="method-card__icon"><?php echo xs_icon('mail'); ?></div></div>
                                    <div class="method-card__title">Email code</div>
                                    <div class="method-card__desc">6-digit code sent to <?php echo e($user['email']); ?>.</div>
                                </button>
                            </form>
                        </div>
                    <?php endif; ?>
                </div>

            <?php elseif ($tab === 'connections'): ?>
                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon acct-card__icon--discord"><?php echo xs_icon_discord(); ?></div></div>
                    <h2>Discord</h2>
                    <p class="hint">Link your Discord account so the <a href="/store" style="color:var(--magenta);">store</a> can grant your roles automatically the moment a purchase completes &mdash; no separate login at checkout.</p>

                    <?php if (!empty($user['discord_id'])): ?>
                        <div class="connection-row connection-row--linked">
                            <?php if (!empty($user['discord_avatar'])): ?>
                                <img src="<?php echo e($user['discord_avatar']); ?>" class="connection-row__avatar" alt="">
                            <?php else: ?>
                                <div class="connection-row__avatar connection-row__avatar--placeholder"><?php echo xs_icon_discord(20); ?></div>
                            <?php endif; ?>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:700;font-size:14.5px;"><?php echo e($user['discord_username']); ?></div>
                                <div class="hint" style="margin:2px 0 0;font-size:12.5px;">Linked <?php echo e(date('M j, Y', strtotime($user['discord_linked_at'] ?? 'now'))); ?></div>
                            </div>
                            <span class="twofa-badge twofa-badge--on"><?php echo xs_icon('check'); ?> Connected</span>
                            <form method="post" onsubmit="return confirm('Unlink Discord? You\'ll need to relink before buying anything in the store.');">
                                <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                                <input type="hidden" name="action" value="discord_unlink">
                                <button type="submit" class="btn btn--ghost btn--sm">Unlink</button>
                            </form>
                        </div>
                    <?php else: ?>
                        <div class="connection-row">
                            <div class="connection-row__avatar connection-row__avatar--placeholder"><?php echo xs_icon_discord(20); ?></div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:700;font-size:14.5px;">Not linked</div>
                                <div class="hint" style="margin:2px 0 0;font-size:12.5px;">Required before checking out in the store.</div>
                            </div>
                            <a href="/discord-link?return_to=<?php echo rawurlencode('/account?tab=connections'); ?>" class="btn btn--discord btn--sm">
                                <?php echo xs_icon_discord(16); ?> <span>Link Discord</span>
                            </a>
                        </div>
                    <?php endif; ?>
                </div>

            <?php elseif ($tab === 'sessions'): ?>
                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('monitor'); ?></div></div>
                    <h2>Devices signed in</h2>
                    <p class="hint">If you don't recognize one, sign it out.</p>
                    <?php foreach (XyphrosAuth::sessions($user['id']) as $s): ?>
                        <div class="session-row">
                            <div class="session-icon"><?php echo xs_icon(stripos($s['user_agent'] ?? '', 'Mobile') !== false ? 'phone' : 'monitor'); ?></div>
                            <div style="flex:1;min-width:0;">
                                <strong><?php echo e($s['ip'] ?: 'Unknown location'); ?></strong>
                                <?php if ($s['current']): ?><span class="twofa-badge twofa-badge--on" style="margin-left:8px;">This device</span><?php endif; ?>
                                <div class="hint" style="margin:2px 0 0;font-size:12.5px;"><?php echo e(substr($s['user_agent'] ?? '', 0, 60)); ?> &middot; since <?php echo e(date('M j, Y', strtotime($s['created_at']))); ?></div>
                            </div>
                            <?php if (!$s['current']): ?>
                            <form method="post">
                                <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                                <input type="hidden" name="action" value="session_revoke">
                                <input type="hidden" name="session_id" value="<?php echo e($s['id']); ?>">
                                <button type="submit" class="btn btn--ghost btn--sm">Sign out</button>
                            </form>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                    <form method="post" style="margin-top:20px;">
                        <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                        <input type="hidden" name="action" value="session_revoke_all">
                        <button type="submit" class="btn btn--danger btn--sm">Sign out everywhere else</button>
                    </form>
                </div>

            <?php elseif ($tab === 'orders'): ?>
                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('grid'); ?></div></div>
                    <h2>Order history</h2>
                    <p class="hint">Purchases made through the <a href="/store" style="color:var(--magenta);">store</a>.</p>
                    <?php
                    $myOrders = array_filter(Content::all('shop_orders'), fn($o) => (string) ($o['xyphros_user_id'] ?? '') === (string) $user['id']);
                    usort($myOrders, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
                    ?>
                    <?php if (empty($myOrders)): ?>
                        <p style="color:var(--text-muted);font-size:14px;">No orders yet.</p>
                    <?php else: foreach ($myOrders as $order): ?>
                        <?php
                        $orderLicense = ($order['status'] ?? '') === 'completed'
                            ? License::findByBasketIdent($order['basket_ident'] ?? '')
                            : null;
                        ?>
                        <div class="session-row" style="flex-wrap:wrap;">
                            <div class="session-icon"><?php echo xs_icon('grid'); ?></div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:600;font-size:14px;"><?php echo e($order['package_name']); ?><?php if (!empty($order['order_number'])): ?> <span style="font-weight:400;color:var(--text-faint);font-size:12.5px;">#<?php echo (int) $order['order_number']; ?></span><?php endif; ?></div>
                                <div style="color:var(--text-faint);font-size:12.5px;">
                                    <?php echo e($order['currency']); ?> <?php echo number_format((float) ($order['price_paid'] ?? $order['price'] ?? 0), 2); ?>
                                    &middot; <?php echo e(date('M j, Y', strtotime($order['created_at'] ?? 'now'))); ?>
                                </div>
                            </div>
                            <?php
                            $statusMeta = [
                                'pending' => ['label' => 'Pending', 'class' => 'acct-badge--muted'],
                                'completed' => ['label' => 'Completed', 'class' => 'acct-badge--verified'],
                                'declined' => ['label' => 'Declined', 'class' => 'acct-badge--muted'],
                                'refunded' => ['label' => 'Refunded', 'class' => 'acct-badge--muted'],
                                'disputed' => ['label' => 'Disputed', 'class' => 'acct-badge--admin'],
                            ][$order['status'] ?? 'pending'] ?? ['label' => ucfirst($order['status'] ?? 'pending'), 'class' => 'acct-badge--muted'];
                            ?>
                            <span class="acct-badge <?php echo e($statusMeta['class']); ?>"><?php echo e($statusMeta['label']); ?></span>
                            <?php if ($orderLicense): ?>
                                <button type="button" class="btn btn--ghost btn--sm" style="margin-left:8px;" onclick="var b=this.nextElementSibling; b.style.display = b.style.display==='none' ? 'flex' : 'none'; this.style.display='none';">View key</button>
                                <div style="display:none;width:100%;margin-top:10px;align-items:center;gap:10px;flex-wrap:wrap;">
                                    <code style="font-family:var(--font-mono);font-size:13px;background:var(--bg-elevated);padding:8px 12px;border-radius:8px;border:1px solid var(--border);letter-spacing:.03em;"><?php echo e($orderLicense['key']); ?></code>
                                    <?php if (!empty($orderLicense['redeemed'])): ?>
                                        <span style="color:var(--text-faint);font-size:12px;">Already redeemed</span>
                                    <?php else: ?>
                                        <?php
                                        $olTier = License::tiers()[$orderLicense['tier'] ?? ''] ?? null;
                                        $olRedeemUrl = $olTier['redeem_url'] ?? 'https://portal.xyphros.net/redeem';
                                        $olRedeemProduct = $olTier['redeem_product'] ?? 'Portal';
                                        ?>
                                        <a href="<?php echo e($olRedeemUrl); ?>" target="_blank" rel="noopener" style="color:var(--magenta);font-size:12.5px;">Redeem in <?php echo e($olRedeemProduct); ?> &rarr;</a>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; endif; ?>
                </div>

            <?php elseif ($tab === 'products' && $isSuperAdmin): ?>
                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('grid'); ?></div></div>
                    <h2>Products</h2>
                    <p class="hint">Managing content, accounts, and staff access for every product now happens in one place.</p>
                    <a href="https://staff.xyphros.net" target="_blank" rel="noopener" class="btn btn--primary btn--sm" style="margin-bottom:20px;">Open Xyphros Staff <?php echo xs_icon('arrow'); ?></a>
                    <div class="product-row">
                        <div class="product-row__icon"><?php echo xs_icon('grid'); ?></div>
                        <div style="flex:1;min-width:0;"><strong>Xyphros</strong><div class="hint" style="margin:2px 0 0;">xyphros.net &mdash; blog, products, team, messages</div></div>
                        <a href="https://staff.xyphros.net/access.php?product=xyphros" class="btn btn--ghost btn--sm">Manage staff <?php echo xs_icon('arrow'); ?></a>
                    </div>
                    <div class="product-row">
                        <div class="product-row__icon"><?php echo xs_icon('grid'); ?></div>
                        <div style="flex:1;min-width:0;"><strong>XyphrosPortal</strong><div class="hint" style="margin:2px 0 0;">portal.xyphros.net &mdash; workspaces, tasks, notes</div></div>
                        <a href="https://staff.xyphros.net/access.php?product=portal" class="btn btn--ghost btn--sm">Manage staff <?php echo xs_icon('arrow'); ?></a>
                    </div>
                    <div class="product-row">
                        <div class="product-row__icon"><?php echo xs_icon('grid'); ?></div>
                        <div style="flex:1;min-width:0;"><strong>Plexer Pass Tracker</strong><div class="hint" style="margin:2px 0 0;">plexsmp.xyphros.net &mdash; private, invite-only</div></div>
                        <a href="https://staff.xyphros.net/access.php?product=subtracker" class="btn btn--ghost btn--sm">Manage staff <?php echo xs_icon('arrow'); ?></a>
                    </div>
                </div>

            <?php else: ?>
                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('user'); ?></div></div>
                    <h2>Profile</h2>
                    <p class="hint">Your name and photo, visible wherever you're credited across Xyphros products.</p>
                    <div class="avatar-row">
                        <div class="avatar-upload">
                            <?php if (!empty($user['avatar'])): ?>
                                <img src="<?php echo e($user['avatar']); ?>" class="avatar-preview" alt="">
                            <?php else: ?>
                                <div class="avatar-preview avatar-preview--placeholder"><?php echo e(strtoupper(substr($user['name'] ?: $user['username'], 0, 1))); ?></div>
                            <?php endif; ?>
                            <form method="post" enctype="multipart/form-data">
                                <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                                <input type="hidden" name="action" value="avatar_upload">
                                <label class="avatar-edit" title="Change photo">
                                    <?php echo xs_icon('camera'); ?>
                                    <input type="file" name="avatar" accept="image/*" onchange="this.form.submit()" style="display:none;">
                                </label>
                            </form>
                        </div>
                        <?php if (!empty($user['avatar'])): ?>
                        <form method="post">
                            <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                            <input type="hidden" name="action" value="avatar_remove">
                            <button type="submit" class="btn btn--ghost btn--sm">Remove photo</button>
                        </form>
                        <?php endif; ?>
                    </div>

                    <form method="post">
                        <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                        <input type="hidden" name="action" value="profile_save">
                        <div class="field"><label>Name</label><input type="text" name="name" value="<?php echo e($user['name'] ?? ''); ?>" required></div>
                        <button type="submit" class="btn btn--primary btn--sm">Save</button>
                    </form>
                </div>

                <div class="acct-card">
                    <div class="acct-card__head"><div class="acct-card__icon"><?php echo xs_icon('mail'); ?></div></div>
                    <h2>Email</h2>
                    <p class="hint">Current: <strong><?php echo e($user['email']); ?></strong></p>
                    <form method="post" style="max-width:360px;">
                        <input type="hidden" name="csrf_token" value="<?php echo e(XyphrosAuth::csrfToken()); ?>">
                        <input type="hidden" name="action" value="email_change_request">
                        <div class="field"><label>New email</label><input type="email" name="new_email" required></div>
                        <button type="submit" class="btn btn--ghost btn--sm">Send verification code</button>
                    </form>
                </div>
            <?php endif; ?>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

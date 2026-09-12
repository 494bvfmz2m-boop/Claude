<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_once __DIR__ . '/../includes/mailer.php';
require_permission('manage_accounts');

$navPage = 'accounts';
$pageTitle = 'Accounts';
$error = $success = '';
$newTempPassword = null;
if ($flash = get_flash()) {
    if ($flash['type'] === 'error') $error = $flash['message']; else $success = $flash['message'];
}

$q = trim($_GET['q'] ?? '');
$viewId = $_GET['view'] ?? ($_POST['target_id'] ?? null);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $action = $_POST['action'] ?? '';
        $targetId = $_POST['target_id'] ?? '';

        if ($targetId === $currentStaffUser['id'] && in_array($action, ['lock', 'generate_temp_password', 'send_reset_link'], true)) {
            $error = "You can't lock or reset your own account from here.";
        } else {
            $target = XyphrosAuth::findById($targetId);
            if (!$target) {
                $error = 'Account not found.';
            } elseif (!empty($target['is_super_admin']) && $target['id'] !== $currentStaffUser['id'] && in_array($action, ['lock', 'generate_temp_password', 'send_reset_link'], true)) {
                $error = 'Other Founder accounts are protected from this. Coordinate directly instead.';
            } elseif ($action === 'lock') {
                XyphrosAuth::updateUser($targetId, ['locked' => 1]);
                XyphrosAuth::destroyAllSessions($targetId);
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'account_locked', $targetId, $target['email'], 'Locked account and signed it out everywhere');
                send_smtp_mail($target['email'], 'Your Xyphros account has been locked', "Your Xyphros account was locked by a staff member.\n\nIf you believe this is a mistake, contact contact@xyphros.net.", [],
                    render_notice_email('Your account has been locked', 'A Xyphros staff member has locked your account. You have been signed out of everything.', null, null, "If you believe this is a mistake, contact contact@xyphros.net.")
                );
                redirect_with_flash('/staff/accounts?view=' . $targetId, 'success', ($target['name'] ?: $target['username']) . "'s account has been locked and signed out everywhere.");
            } elseif ($action === 'unlock') {
                XyphrosAuth::updateUser($targetId, ['locked' => 0]);
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'account_unlocked', $targetId, $target['email'], 'Unlocked account');
                redirect_with_flash('/staff/accounts?view=' . $targetId, 'success', ($target['name'] ?: $target['username']) . "'s account has been unlocked.");
            } elseif ($action === 'generate_temp_password') {
                // Deliberately no redirect here — see comment above.
                XyphrosAuth::destroyAllSessions($targetId);
                $newTempPassword = bin2hex(random_bytes(6));
                XyphrosAuth::updateUser($targetId, [
                    'password_hash' => XyphrosAuth::hashPassword($newTempPassword),
                    'must_change_password' => 1,
                ]);
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'password_reset', $targetId, $target['email'], 'Generated a temporary password (forced change on next login) and signed it out everywhere');
                send_smtp_mail($target['email'], 'Your Xyphros password was reset', "A staff member reset your Xyphros account password. You'll be asked to set a new one the moment you sign in with the temporary password they give you.", [],
                    render_notice_email('Your password was reset', 'A Xyphros staff member reset your account password and signed you out everywhere. You\'ll be asked to set your own new password the moment you sign in with the temporary one they give you.', null, null, "If you didn't expect this, contact contact@xyphros.net.")
                );
                $success = "Temporary password generated for " . ($target['name'] ?: $target['username']) . ". They'll be forced to set their own password the moment they sign in with it. Share it below through a secure channel, it won't be shown again.";
            } elseif ($action === 'send_reset_link') {
                // No password is touched here at all — this only sends a
                // link. Whether they get in via that link or (if they
                // still remember it) their existing password, either path
                // lands them on the same mandatory "set a new password"
                // step, because must_change_password is set immediately.
                XyphrosAuth::destroyAllSessions($targetId);
                XyphrosAuth::updateUser($targetId, ['must_change_password' => 1]);
                $token = generate_link_token($targetId, 'magic_login', 900);
                $link = 'https://xyphros.net/magic-login?uid=' . rawurlencode($targetId) . '&token=' . rawurlencode($token);
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'password_reset', $targetId, $target['email'], 'Sent a password reset link and signed it out everywhere');
                send_smtp_mail($target['email'], 'Reset your Xyphros password', "A staff member started a password reset for your Xyphros account.\n\nClick this link to sign in and set a new password:\n\n{$link}\n\nThis link expires in 15 minutes and can only be used once.\n\nIf you didn't expect this, contact contact@xyphros.net.", [],
                    render_notice_email('Reset your password', 'A Xyphros staff member started a password reset for your account. Click below to sign in and set a new password. This also works if you don\'t remember your current one.', 'Sign in & set new password', $link, "This link expires in 15 minutes and can only be used once. If you didn't expect this, contact contact@xyphros.net.")
                );
                $success = "A reset link has been emailed to " . ($target['name'] ?: $target['username']) . ". Clicking it signs them in directly and requires them to set a new password immediately.";
            } elseif ($action === 'revoke_session') {
                XyphrosAuth::revokeSession($targetId, $_POST['session_id'] ?? '');
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'session_revoked', $targetId, $target['email'], 'Signed out one device');
                redirect_with_flash('/staff/accounts?view=' . $targetId, 'success', 'Device signed out.');
            } elseif ($action === 'revoke_all_sessions') {
                XyphrosAuth::destroyAllSessions($targetId);
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'all_sessions_revoked', $targetId, $target['email'], 'Signed out every device');
                redirect_with_flash('/staff/accounts?view=' . $targetId, 'success', 'Every device has been signed out.');
            }
            $viewId = $targetId;
        }
    }
}

$results = [];
if ($q !== '') {
    $stmt = XyphrosAuth::db()->prepare(
        "SELECT * FROM users WHERE username LIKE ? OR email LIKE ? OR name LIKE ? ORDER BY username ASC LIMIT 25"
    );
    $like = '%' . $q . '%';
    $stmt->execute([$like, $like, $like]);
    $results = $stmt->fetchAll();
}

$viewAccount = $viewId ? XyphrosAuth::findById($viewId) : null;
$viewSessions = $viewAccount ? XyphrosAuth::sessions($viewAccount['id']) : [];

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Accounts</h1>
        <p>Search any Xyphros account. Lock it, reset its password, or manage its active sessions.</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>
<?php if ($success): ?><div class="alert alert--success"><?php echo e($success); ?></div><?php endif; ?>

<?php if ($newTempPassword): ?>
<div class="staff-card" style="border-color:rgba(61,220,151,.35);">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('key', 18); ?></div>
        <h3>New temporary password</h3>
    </div>
    <p style="color:var(--text-muted);font-size:13.5px;margin-bottom:14px;">This is shown once. They'll be forced to set their own password the moment they sign in with it.</p>
    <code style="font-size:20px;font-weight:700;letter-spacing:.05em;background:var(--bg-elevated);padding:10px 16px;border-radius:var(--radius-sm);display:inline-block;"><?php echo e($newTempPassword); ?></code>
</div>
<?php endif; ?>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('search', 18); ?></div>
        <h3>Find an account</h3>
    </div>
    <form method="get" class="search-box" style="max-width:420px;margin-bottom:0;">
        <?php echo xs_icon('search', 16); ?>
        <input type="text" name="q" placeholder="Search by name, username, or email&hellip;" value="<?php echo e($q); ?>" autofocus>
    </form>
</div>

<?php if ($q !== ''): ?>
    <div class="staff-card">
        <?php if (empty($results)): ?>
            <p style="color:var(--text-muted);margin:0;">No accounts matched "<?php echo e($q); ?>".</p>
        <?php else: foreach ($results as $acc): ?>
            <div class="acc-summary">
                <?php if (!empty($acc['avatar'])): ?>
                    <img src="<?php echo e($acc['avatar']); ?>" class="acc-avatar" alt="">
                <?php else: ?>
                    <span class="acc-avatar-fallback"><?php echo e(strtoupper(substr($acc['name'] ?: $acc['username'], 0, 1))); ?></span>
                <?php endif; ?>
                <div style="flex:1;min-width:0;">
                    <strong><?php echo e($acc['name'] ?: $acc['username']); ?></strong>
                    <div style="color:var(--text-muted);font-size:12.5px;"><?php echo e($acc['email']); ?></div>
                    <div class="acc-flags">
                        <?php if (!empty($acc['locked'])): ?><span class="acc-flag acc-flag--locked">Locked</span><?php endif; ?>
                        <?php if (!empty($acc['is_super_admin'])): ?><span class="acc-flag acc-flag--admin">Founder</span><?php endif; ?>
                        <?php if (!empty($acc['is_xyphros_staff'])): ?><span class="acc-flag acc-flag--staff">Xyphros staff</span><?php endif; ?>
                        <?php if (!empty($acc['is_portal_staff'])): ?><span class="acc-flag acc-flag--staff">Portal staff</span><?php endif; ?>
                        <?php if (!empty($acc['is_subtracker_staff'])): ?><span class="acc-flag acc-flag--staff">SubTracker staff</span><?php endif; ?>
                    </div>
                </div>
                <a href="/staff/accounts?view=<?php echo e($acc['id']); ?>" class="btn btn--ghost btn--sm">Manage &rarr;</a>
            </div>
        <?php endforeach; endif; ?>
    </div>
<?php endif; ?>

<?php if ($viewAccount): ?>
<div class="staff-card">
    <div class="acc-summary" style="border-bottom:none;padding-bottom:12px;">
        <?php if (!empty($viewAccount['avatar'])): ?>
            <img src="<?php echo e($viewAccount['avatar']); ?>" class="acc-avatar" style="width:48px;height:48px;" alt="">
        <?php else: ?>
            <span class="acc-avatar-fallback" style="width:48px;height:48px;font-size:19px;"><?php echo e(strtoupper(substr($viewAccount['name'] ?: $viewAccount['username'], 0, 1))); ?></span>
        <?php endif; ?>
        <div>
            <h3 style="margin-bottom:2px;"><?php echo e($viewAccount['name'] ?: $viewAccount['username']); ?></h3>
            <div style="color:var(--text-muted);font-size:13px;"><?php echo e($viewAccount['email']); ?> &middot; @<?php echo e($viewAccount['username']); ?></div>
            <div class="acc-flags">
                <?php if (!empty($viewAccount['locked'])): ?><span class="acc-flag acc-flag--locked">Locked</span><?php endif; ?>
                <?php if (!empty($viewAccount['is_super_admin'])): ?><span class="acc-flag acc-flag--admin">Founder</span><?php endif; ?>
                <span class="acc-flag <?php echo !empty($viewAccount['email_verified']) ? 'acc-flag--verified' : 'acc-flag--unverified'; ?>"><?php echo !empty($viewAccount['email_verified']) ? 'Verified' : 'Unverified'; ?></span>
                <span class="acc-flag acc-flag--unverified"><?php echo ($viewAccount['twofa_method'] ?? 'none') !== 'none' ? '2FA on' : '2FA off'; ?></span>
            </div>
        </div>
    </div>

    <?php if ($viewAccount['id'] === $currentStaffUser['id']): ?>
        <p style="color:var(--text-muted);font-size:13px;">This is your own account. Manage it from <a href="https://xyphros.net/account" style="color:var(--magenta);">xyphros.net/account</a> instead.</p>
    <?php elseif (!empty($viewAccount['is_super_admin'])): ?>
        <p style="color:var(--text-muted);font-size:13px;">Founder accounts are protected from being locked or reset here.</p>
    <?php else: ?>
        <div class="btn-row" style="margin-bottom:4px;">
            <?php if (!empty($viewAccount['locked'])): ?>
                <form method="post" onsubmit="return confirm('Unlock this account?');">
                    <?php csrf_field(); ?>
                    <input type="hidden" name="action" value="unlock">
                    <input type="hidden" name="target_id" value="<?php echo e($viewAccount['id']); ?>">
                    <button type="submit" class="btn btn--ghost btn--sm"><?php echo xs_icon('lock', 14); ?> Unlock account</button>
                </form>
            <?php else: ?>
                <form method="post" onsubmit="return confirm('Lock this account? They will be signed out everywhere and unable to log back in until unlocked.');">
                    <?php csrf_field(); ?>
                    <input type="hidden" name="action" value="lock">
                    <input type="hidden" name="target_id" value="<?php echo e($viewAccount['id']); ?>">
                    <button type="submit" class="btn btn--danger btn--sm"><?php echo xs_icon('lock', 14); ?> Lock account</button>
                </form>
            <?php endif; ?>
            <form method="post" onsubmit="return confirm('Generate a temporary password for this account? They\'ll be signed out everywhere and forced to set their own password the moment they sign in with it.');">
                <?php csrf_field(); ?>
                <input type="hidden" name="action" value="generate_temp_password">
                <input type="hidden" name="target_id" value="<?php echo e($viewAccount['id']); ?>">
                <button type="submit" class="btn btn--ghost btn--sm"><?php echo xs_icon('key', 14); ?> Generate Temporary Password</button>
            </form>
            <form method="post" onsubmit="return confirm('Email a reset link to this account? They\'ll be signed out everywhere. Clicking the link signs them in directly and requires them to set a new password immediately.');">
                <?php csrf_field(); ?>
                <input type="hidden" name="action" value="send_reset_link">
                <input type="hidden" name="target_id" value="<?php echo e($viewAccount['id']); ?>">
                <button type="submit" class="btn btn--ghost btn--sm"><?php echo xs_icon('send', 14); ?> Reset Password E-Mail</button>
            </form>
        </div>
    <?php endif; ?>
</div>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('monitor', 18); ?></div>
        <h3>Active devices</h3>
    </div>
    <?php if (empty($viewSessions)): ?>
        <p style="color:var(--text-muted);font-size:13px;margin:0;">No active sessions.</p>
    <?php else: ?>
        <?php foreach ($viewSessions as $s): ?>
            <div class="session-row">
                <div class="session-icon"><?php echo xs_icon('monitor', 15); ?></div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;"><?php echo e($s['ip'] ?: 'Unknown location'); ?></div>
                    <div style="color:var(--text-faint);font-size:11.5px;"><?php echo e(substr($s['user_agent'] ?? '', 0, 50)); ?> &middot; since <?php echo e(date('M j, Y', strtotime($s['created_at']))); ?></div>
                </div>
                <form method="post">
                    <?php csrf_field(); ?>
                    <input type="hidden" name="action" value="revoke_session">
                    <input type="hidden" name="target_id" value="<?php echo e($viewAccount['id']); ?>">
                    <input type="hidden" name="session_id" value="<?php echo e($s['id']); ?>">
                    <button type="submit" class="btn btn--ghost btn--sm">Sign out</button>
                </form>
            </div>
        <?php endforeach; ?>
        <form method="post" style="margin-top:14px;">
            <?php csrf_field(); ?>
            <input type="hidden" name="action" value="revoke_all_sessions">
            <input type="hidden" name="target_id" value="<?php echo e($viewAccount['id']); ?>">
            <button type="submit" class="btn btn--danger btn--sm">Sign out everywhere</button>
        </form>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

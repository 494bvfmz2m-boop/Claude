<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/XyphrosAuth.php';
require_once __DIR__ . '/includes/mailer.php';

$currentPage = 'forgot-password';
$pageTitle = 'Reset your password';

if (XyphrosAuth::currentUser()) {
    header('Location: /account');
    exit;
}

$error = '';
$step = 'form'; // form -> verify -> newpw
$resetUid = '';
$resEmail = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!xs_csrf_verify($_POST['csrf_token'] ?? null)) {
        $error = 'That took a bit too long — please try again.';
    } else {
        $action = $_POST['action'] ?? 'send_code';

        if ($action === 'send_code') {
            $email = trim(strtolower($_POST['email'] ?? ''));
            $u = XyphrosAuth::findByEmail($email);
            if ($u) {
                $code = XyphrosAuth::generateCode($u['id'], 'password_reset', null, 900);
                send_smtp_mail($email, 'Reset your Xyphros password',
                    "Your password reset code is:\n\n    {$code}\n\nThis code expires in 15 minutes. If you didn't request this, you can safely ignore it.",
                    [],
                    render_code_email(
                        'Reset your password',
                        'Enter this code to reset your Xyphros account password. It expires in 15 minutes.',
                        $code,
                        "If you didn't request this, you can safely ignore this email — your password hasn't changed."
                    )
                );
                $resetUid = $u['id'];
            }
            // Don't reveal whether the email exists either way — same step regardless.
            $resEmail = $email;
            $step = 'verify';
        }

        if ($action === 'verify_code') {
            $uid = $_POST['reset_uid'] ?? '';
            $entered = preg_replace('/\D/', '', $_POST['code'] ?? '');
            $resEmail = $_POST['reset_email'] ?? '';

            if (!$uid || !$entered) {
                $error = 'Invalid request.'; $step = 'form';
            } elseif (XyphrosAuth::verifyCode($uid, 'password_reset', $entered) === false) {
                $error = 'Incorrect or expired code.';
                $step = 'verify';
                $resetUid = $uid;
            } else {
                $step = 'newpw';
                $resetUid = $uid;
            }
        }

        if ($action === 'set_password') {
            $uid = $_POST['reset_uid'] ?? '';
            $pw = $_POST['password'] ?? '';
            $pw2 = $_POST['confirm'] ?? '';

            if (strlen($pw) < 8) { $error = 'Password must be at least 8 characters.'; $step = 'newpw'; $resetUid = $uid; }
            elseif ($pw !== $pw2) { $error = "Passwords don't match."; $step = 'newpw'; $resetUid = $uid; }
            elseif (!$uid) { $error = 'That link has expired — start again.'; $step = 'form'; }
            else {
                XyphrosAuth::updateUser($uid, ['password_hash' => XyphrosAuth::hashPassword($pw)]);
                XyphrosAuth::destroyAllSessions($uid); // a password reset should sign out every existing session
                XyphrosAuth::createSession($uid);
                header('Location: /account');
                exit;
            }
        }

        if ($action === 'restart') {
            $step = 'form';
        }
    }
}

// Must happen before any HTML output (header.php below) — setcookie()
// silently fails once output has started, which was the actual bug.
$csrfToken = xs_csrf_token();

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Xyphros account</span>
        <h1><?php echo $step === 'newpw' ? 'Set a new password' : ($step === 'verify' ? 'Check your email' : 'Forgot password?'); ?></h1>
        <p class="lede lede--center">One account works everywhere &mdash; xyphros.net and every product.</p>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:420px;">
        <?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>

        <?php if ($step === 'newpw'): ?>
            <p style="margin-bottom:20px;color:var(--text-muted);">Choose a strong new password.</p>
            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="set_password">
                <input type="hidden" name="reset_uid" value="<?php echo e($resetUid); ?>">
                <div class="field"><label for="password">New password</label><input type="password" id="password" name="password" required autofocus autocomplete="new-password"></div>
                <div class="field"><label for="confirm">Confirm password</label><input type="password" id="confirm" name="confirm" required autocomplete="new-password"></div>
                <button type="submit" class="btn btn--primary btn--block">Save new password</button>
            </form>

        <?php elseif ($step === 'verify'): ?>
            <p style="margin-bottom:20px;color:var(--text-muted);">If an account exists for <strong><?php echo e($resEmail); ?></strong>, we sent a 6-digit code. It expires in 15 minutes.</p>
            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="verify_code">
                <input type="hidden" name="reset_uid" value="<?php echo e($resetUid); ?>">
                <input type="hidden" name="reset_email" value="<?php echo e($resEmail); ?>">
                <div class="field">
                    <label for="code">6-digit code</label>
                    <input type="text" id="code" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6"
                        autocomplete="one-time-code" autofocus required
                        style="text-align:center;font-size:28px;font-weight:700;letter-spacing:0.4em;font-family:var(--font-mono);">
                </div>
                <button type="submit" class="btn btn--primary btn--block">Continue</button>
            </form>
            <form method="post" style="text-align:center;margin-top:14px;">
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="restart">
                <button type="submit" style="background:none;border:none;cursor:pointer;color:var(--text-muted);text-decoration:underline;font-size:13px;">Try a different email</button>
            </form>

        <?php else: ?>
            <p style="margin-bottom:20px;color:var(--text-muted);">Enter your email and we'll send a reset code.</p>
            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="send_code">
                <div class="field"><label for="email">Email</label><input type="email" id="email" name="email" required autofocus autocomplete="email"></div>
                <button type="submit" class="btn btn--primary btn--block">Send code</button>
            </form>
            <p style="text-align:center;margin-top:18px;font-size:14.5px;color:var(--text-muted);">
                <a href="/login">&larr; Back to sign in</a>
            </p>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

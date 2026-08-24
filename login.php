<?php
/**
 * The one login page for the whole company. XyphrosPortal's login.php
 * now just redirects here — see xyphros-portal/login.php.
 */
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/XyphrosAuth.php';
require_once __DIR__ . '/includes/mailer.php';

$currentPage = 'login';
$pageTitle = 'Sign in';
$pageDescription = 'Sign in to your Xyphros account.';

/**
 * return_to lets portal.xyphros.net (or any other *.xyphros.net site)
 * send people here to log in and bounce them back afterwards.
 */
function xs_safe_return_to(?string $url): string {
    if (!$url) return '/';
    $parts = parse_url($url);
    if (empty($parts['host'])) return '/';
    $host = strtolower($parts['host']);
    if ($host === 'xyphros.net' || str_ends_with($host, '.xyphros.net')) {
        return $url;
    }
    return '/';
}

$returnTo = xs_safe_return_to($_POST['return_to'] ?? $_GET['return_to'] ?? null);

// Already logged in? Skip straight through.
if (XyphrosAuth::currentUser()) {
    header('Location: ' . $returnTo);
    exit;
}

$error  = '';
$stage  = 'password'; // password -> twofa
$uid2fa = '';
$method = '';
$resent = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!xs_csrf_verify($_POST['csrf_token'] ?? null)) {
        $error = 'That took a bit too long — please try again.';
    } else {
        $action = $_POST['action'] ?? 'login';

        // ── Step 1: email + password ────────────────────────────────────
        if ($action === 'login') {
            $email = trim(strtolower($_POST['email'] ?? ''));
            $pw    = $_POST['password'] ?? '';
            $u     = XyphrosAuth::findByEmail($email);

            if (!$u || !XyphrosAuth::verifyPassword($pw, $u['password_hash'])) {
                $error = 'Incorrect email or password.';
            } elseif (empty($u['email_verified'])) {
                $error = 'Please verify your email before signing in.';
            } elseif (!empty($u['locked']) && empty($u['is_super_admin'])) {
                $error = 'This account has been locked. Contact contact@xyphros.net.';
            } elseif (($u['twofa_method'] ?? 'none') === 'totp') {
                $stage  = 'twofa';
                $uid2fa = $u['id'];
                $method = 'totp';
            } elseif (($u['twofa_method'] ?? 'none') === 'email') {
                $code = XyphrosAuth::generateCode($u['id'], '2fa_login');
                send_smtp_mail(
                    $u['email'],
                    'Your Xyphros sign-in code',
                    "Your Xyphros sign-in code is:\n\n    {$code}\n\n"
                        . "This code expires in 10 minutes. If you didn't request this, "
                        . "you can ignore this email — your account is still safe.",
                    [],
                    render_code_email(
                        'Sign-in code',
                        "Enter this code to finish signing in to your Xyphros account. It expires in 10 minutes.",
                        $code,
                        "If you didn't try to sign in, you can ignore this email — your account is still safe."
                    )
                );
                $stage  = 'twofa';
                $uid2fa = $u['id'];
                $method = 'email';
            } else {
                complete_login($u, $returnTo);
            }
        }

        // ── Step 2: verify 2FA code (TOTP or email) ─────────────────────
        if ($action === 'verify_2fa') {
            $uid2fa  = $_POST['uid2fa'] ?? '';
            $method  = $_POST['method'] ?? '';
            $entered = preg_replace('/\D/', '', $_POST['code'] ?? '');
            $u       = $uid2fa ? XyphrosAuth::findById($uid2fa) : null;

            if (!$u) {
                $error = 'Session lost. Please sign in again.';
            } elseif (!$entered || strlen($entered) !== 6) {
                $error = 'Please enter the 6-digit code.';
                $stage = 'twofa';
            } else {
                $ok = ($method === 'totp')
                    ? XyphrosAuth::verifyTotp($u['totp_secret'] ?? '', $entered)
                    : (XyphrosAuth::verifyCode($u['id'], '2fa_login', $entered) !== false);

                if ($ok) {
                    complete_login($u, $returnTo);
                }
                $error = 'Incorrect or expired code. Try again.';
                $stage = 'twofa';
            }
        }

        // ── Resend email code ────────────────────────────────────────────
        if ($action === 'resend_2fa') {
            $uid2fa = $_POST['uid2fa'] ?? '';
            $u      = $uid2fa ? XyphrosAuth::findById($uid2fa) : null;
            if ($u && ($u['twofa_method'] ?? '') === 'email') {
                $code = XyphrosAuth::generateCode($u['id'], '2fa_login');
                send_smtp_mail(
                    $u['email'],
                    'Your Xyphros sign-in code',
                    "Your Xyphros sign-in code is:\n\n    {$code}\n\nThis code expires in 10 minutes.",
                    [],
                    render_code_email(
                        'Sign-in code',
                        "Enter this code to finish signing in to your Xyphros account. It expires in 10 minutes.",
                        $code,
                        "If you didn't try to sign in, you can ignore this email — your account is still safe."
                    )
                );
                $resent = true;
                $stage  = 'twofa';
                $method = 'email';
            } else {
                $error = 'Session lost. Please sign in again.';
            }
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
        <h1><?php echo $stage === 'twofa' ? ($method === 'totp' ? 'Enter your code' : 'Check your email') : 'Sign in'; ?></h1>
        <p class="lede lede--center">One account works everywhere &mdash; xyphros.net and every product.</p>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:420px;">

        <?php if ($error): ?>
            <div class="alert alert--error"><?php echo e($error); ?></div>
        <?php elseif ($resent): ?>
            <div class="alert alert--success">A new code is on its way.</div>
        <?php endif; ?>

        <?php if ($stage === 'twofa'): ?>

            <p style="margin-bottom:20px;color:var(--text-muted);">
                <?php if ($method === 'totp'): ?>
                    Open your authenticator app and enter the current 6-digit code.
                <?php else: ?>
                    We sent a 6-digit code to your email. It expires in 10 minutes.
                <?php endif; ?>
            </p>

            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="verify_2fa">
                <input type="hidden" name="uid2fa" value="<?php echo e($uid2fa); ?>">
                <input type="hidden" name="method" value="<?php echo e($method); ?>">
                <input type="hidden" name="return_to" value="<?php echo e($returnTo); ?>">
                <div class="field">
                    <label for="code">6-digit code</label>
                    <input type="text" id="code" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6"
                        autocomplete="one-time-code" autofocus required
                        style="text-align:center;font-size:28px;font-weight:700;letter-spacing:0.4em;font-family:var(--font-mono);">
                </div>
                <button type="submit" class="btn btn--primary btn--block">Verify and sign in</button>
            </form>

            <?php if ($method !== 'totp'): ?>
            <form method="post" style="text-align:center;margin-top:16px;">
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="resend_2fa">
                <input type="hidden" name="uid2fa" value="<?php echo e($uid2fa); ?>">
                <button type="submit" style="background:none;border:none;cursor:pointer;color:var(--text-muted);text-decoration:underline;font-size:13px;">Resend code</button>
            </form>
            <?php endif; ?>

            <p style="text-align:center;margin-top:10px;"><a href="/login" style="font-size:13px;color:var(--text-faint);">&larr; Back</a></p>

        <?php else: ?>

            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="login">
                <input type="hidden" name="return_to" value="<?php echo e($returnTo); ?>">
                <div class="field">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autofocus autocomplete="email"
                        value="<?php echo e($_POST['email'] ?? ''); ?>">
                </div>
                <div class="field">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password">
                </div>
                <button type="submit" class="btn btn--primary btn--block">Sign in</button>
            </form>

            <p style="text-align:center;margin-top:18px;font-size:14.5px;color:var(--text-muted);">
                No account? <a href="<?php echo e('/register?return_to=' . urlencode($returnTo)); ?>">Create one</a>
                &nbsp;&middot;&nbsp;
                <a href="/forgot-password">Forgot password?</a>
            </p>

        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

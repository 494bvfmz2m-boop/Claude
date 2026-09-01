<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/XyphrosAuth.php';
require_once __DIR__ . '/includes/mailer.php';

$currentPage = 'register';
$pageTitle = 'Create your account';

function xs_safe_return_to_reg(?string $url): string {
    if (!$url) return '/';
    $parts = parse_url($url);
    if (empty($parts['host'])) return '/';
    $host = strtolower($parts['host']);
    return ($host === 'xyphros.net' || str_ends_with($host, '.xyphros.net')) ? $url : '/';
}
$returnTo = xs_safe_return_to_reg($_POST['return_to'] ?? $_GET['return_to'] ?? null);

if (XyphrosAuth::currentUser()) {
    header('Location: ' . $returnTo);
    exit;
}

$error = '';
$step = 'form'; // form -> verify
$regUid = '';
$regEmail = '';
$resent = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!xs_csrf_verify($_POST['csrf_token'] ?? null)) {
        $error = 'That took a bit too long — please try again.';
    } else {
        $action = $_POST['action'] ?? 'register';

        if ($action === 'register') {
            $name  = trim($_POST['name'] ?? '');
            $email = trim(strtolower($_POST['email'] ?? ''));
            $pw    = $_POST['password'] ?? '';

            if ($name === '' || $email === '' || strlen($pw) < 8) {
                $error = 'Please fill in every field — password needs to be at least 8 characters.';
            } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $error = 'That email address doesn\'t look right.';
            } elseif (XyphrosAuth::findByEmail($email)) {
                $error = 'An account with that email already exists. Try signing in instead.';
            } else {
                $base = strtolower(preg_replace('/[^a-z0-9]/i', '', explode('@', $email)[0])) ?: 'user';
                $username = $base;
                $n = 1;
                while (XyphrosAuth::findByUsername($username)) { $username = $base . $n; $n++; }

                $uid = XyphrosAuth::createUser($username, $email, $pw, [
                    'name' => $name,
                    'email_verified' => 0,
                    'signup_ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                ]);
                notify_discord_signup($name, $email, $_SERVER['REMOTE_ADDR'] ?? '');
                $code = XyphrosAuth::generateCode($uid, 'register_verify', null, 900);
                send_smtp_mail(
                    $email,
                    'Verify your Xyphros account',
                    "Hi {$name},\n\nYour verification code is:\n\n    {$code}\n\nThis code expires in 15 minutes.",
                    [],
                    render_code_email(
                        "Hi {$name}, welcome to Xyphros",
                        "Enter this code to verify your email and finish creating your account. It expires in 15 minutes.",
                        $code
                    )
                );
                $step = 'verify';
                $regUid = $uid;
                $regEmail = $email;
            }
        }

        if ($action === 'verify_code') {
            $uid     = $_POST['reg_uid'] ?? '';
            $entered = preg_replace('/\D/', '', $_POST['code'] ?? '');
            $u       = $uid ? XyphrosAuth::findById($uid) : null;

            if (!$u) {
                $error = 'Session lost. Please register again.';
            } elseif (XyphrosAuth::verifyCode($uid, 'register_verify', $entered) === false) {
                $error = 'Incorrect or expired code.';
                $step = 'verify';
                $regUid = $uid;
                $regEmail = $u['email'];
            } else {
                XyphrosAuth::updateUser($uid, ['email_verified' => 1]);
                XyphrosAuth::createSession($uid);
                header('Location: ' . $returnTo);
                exit;
            }
        }

        if ($action === 'resend') {
            $uid = $_POST['reg_uid'] ?? '';
            $u = $uid ? XyphrosAuth::findById($uid) : null;
            if ($u && empty($u['email_verified'])) {
                $code = XyphrosAuth::generateCode($uid, 'register_verify', null, 900);
                send_smtp_mail(
                    $u['email'],
                    'Verify your Xyphros account',
                    "Your verification code is:\n\n    {$code}\n\nThis code expires in 15 minutes.",
                    [],
                    render_code_email(
                        'Verify your email',
                        'Enter this code to verify your email and finish creating your account. It expires in 15 minutes.',
                        $code
                    )
                );
                $resent = true;
                $step = 'verify';
                $regUid = $uid;
                $regEmail = $u['email'];
            } else {
                $step = 'form';
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
        <h1><?php echo $step === 'verify' ? 'Check your email' : 'Create your account'; ?></h1>
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

        <?php if ($step === 'verify'): ?>
            <p style="margin-bottom:20px;color:var(--text-muted);">We sent a 6-digit code to <strong><?php echo e($regEmail); ?></strong>. It expires in 15 minutes.</p>
            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="verify_code">
                <input type="hidden" name="reg_uid" value="<?php echo e($regUid); ?>">
                <input type="hidden" name="return_to" value="<?php echo e($returnTo); ?>">
                <div class="field">
                    <label for="code">6-digit code</label>
                    <input type="text" id="code" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6"
                        autocomplete="one-time-code" autofocus required
                        style="text-align:center;font-size:28px;font-weight:700;letter-spacing:0.4em;font-family:var(--font-mono);">
                </div>
                <button type="submit" class="btn btn--primary btn--block">Verify and continue</button>
            </form>
            <form method="post" style="text-align:center;margin-top:16px;">
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="resend">
                <input type="hidden" name="reg_uid" value="<?php echo e($regUid); ?>">
                <button type="submit" style="background:none;border:none;cursor:pointer;color:var(--text-muted);text-decoration:underline;font-size:13px;">Resend code</button>
            </form>
        <?php else: ?>
            <form method="post" novalidate>
                <?php xs_csrf_field(); ?>
                <input type="hidden" name="action" value="register">
                <input type="hidden" name="return_to" value="<?php echo e($returnTo); ?>">
                <div class="field">
                    <label for="name">Name</label>
                    <input type="text" id="name" name="name" required autofocus autocomplete="name"
                        value="<?php echo e($_POST['name'] ?? ''); ?>">
                </div>
                <div class="field">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autocomplete="email"
                        value="<?php echo e($_POST['email'] ?? ''); ?>">
                </div>
                <div class="field">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required autocomplete="new-password">
                    <p class="field--hint">At least 8 characters.</p>
                </div>
                <button type="submit" class="btn btn--primary btn--block">Create account</button>
            </form>
            <p style="text-align:center;margin-top:18px;font-size:14.5px;color:var(--text-muted);">
                Already have an account? <a href="<?php echo e('/login?return_to=' . urlencode($returnTo)); ?>">Sign in</a>
            </p>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

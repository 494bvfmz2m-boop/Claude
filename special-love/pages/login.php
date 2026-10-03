<?php
$GLOBALS['page_title'] = 'Sign in - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Sign in to your account to track orders and custom print requests.';

if (is_logged_in()) redirect('?p=account');
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = trim((string)($_POST['email'] ?? ''));
    $pass  = (string)($_POST['password'] ?? '');

    if (!throttle('login')) {
        $error = 'Too many attempts. Please wait 15 minutes and try again.';
    } else {
        $user = one('SELECT * FROM users WHERE email = ?', [$email]);
        if ($user && password_verify($pass, $user['password_hash'])) {
            clear_throttle('login');
            if ((int)$user['totp_enabled'] === 1) {
                $_SESSION['pending_2fa_uid'] = (int)$user['id'];
                redirect('?p=twofa');
            }
            login_user($user);
            $next = $_SESSION['after_login'] ?? null;
            unset($_SESSION['after_login']);
            flash('Welcome back!');
            $isStaff = in_array($user['role'] ?? 'customer', ['staff', 'owner'], true);
            redirect($next ?: ($isStaff ? '?p=admin_orders' : '?p=account'));
        }
        $error = 'That email and password do not match.';
    }
}
?>
<div class="card anim-pop" style="max-width:440px;margin:24px auto">
  <div style="text-align:center">
    <img class="anim-float" src="<?= e(url('assets/logo.png')) ?>" alt="" style="width:78px;border-radius:50%;box-shadow:0 0 0 2px var(--pink)">
    <h1>Welcome back</h1>
    <p class="muted small">Sign in to track orders and print requests.</p>
  </div>
  <?php if ($error): ?><div class="note err anim-pop"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label>Email <input type="email" name="email" required autofocus value="<?= e($_POST['email'] ?? '') ?>"></label>
    <label>Password <input type="password" name="password" required></label>
    <button class="btn hover-sheen" type="submit" style="width:100%">Sign in</button>
  </form>
  <p class="small muted" style="text-align:center;margin-top:14px">
    New here? <a href="<?= e(url('?p=register')) ?>">Create an account</a>
  </p>
</div>

<?php
$GLOBALS['page_title'] = 'Inloggen - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Log in op je account.';

if (is_logged_in()) redirect('?p=account');
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = trim((string)($_POST['email'] ?? ''));
    $pass  = (string)($_POST['password'] ?? '');

    if (!throttle('login')) {
        $error = 'Te veel pogingen. Wacht 15 minuten en probeer het opnieuw.';
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
            flash('Welkom terug!');
            $isStaff = in_array($user['role'] ?? 'customer', ['staff', 'owner'], true);
            redirect($next ?: ($isStaff ? '?p=admin' : '?p=account'));
        }
        $error = 'Dit e-mailadres en wachtwoord horen niet bij elkaar.';
    }
}
?>
<div class="card anim-pop" style="max-width:440px;margin:24px auto">
  <div style="text-align:center">
    <img class="anim-float" src="<?= e(url('assets/logo.svg')) ?>" alt="" style="width:78px;border-radius:50%;box-shadow:0 0 0 2px var(--pink)">
    <h1>Welkom terug</h1>
    <p class="muted small">Log in op je account.</p>
  </div>
  <?php if ($error): ?><div class="note err anim-pop"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label>E-mail <input type="email" name="email" required autofocus value="<?= e($_POST['email'] ?? '') ?>"></label>
    <label>Wachtwoord <input type="password" name="password" required></label>
    <button class="btn hover-sheen" type="submit" style="width:100%">Inloggen</button>
  </form>
  <?php if (!showcase_mode()): ?>
  <p class="small muted" style="text-align:center;margin-top:14px">
    Nieuw hier? <a href="<?= e(url('?p=register')) ?>">Maak een account aan</a>
  </p>
  <?php endif; ?>
</div>

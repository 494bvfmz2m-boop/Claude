<?php
$GLOBALS['page_title'] = 'Account aanmaken - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Maak een account aan om je bestellingen te volgen.';

if (is_logged_in()) redirect('?p=account');
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $name  = trim((string)($_POST['full_name'] ?? ''));
    $email = trim((string)($_POST['email'] ?? ''));
    $pass  = (string)($_POST['password'] ?? '');
    $pass2 = (string)($_POST['password2'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Vul een geldig e-mailadres in.';
    if (strlen($pass) < 10) $errors[] = 'Je wachtwoord moet minstens 10 tekens zijn.';
    if ($pass !== $pass2) $errors[] = 'De twee wachtwoorden zijn niet gelijk.';
    if (!$errors && one('SELECT id FROM users WHERE email = ?', [$email])) $errors[] = 'Er bestaat al een account met dit e-mailadres.';

    if (!$errors) {
        q('INSERT INTO users (email, password_hash, full_name, role) VALUES (?,?,?,"customer")',
          [$email, password_hash($pass, PASSWORD_DEFAULT), $name]);
        $user = one('SELECT * FROM users WHERE email = ?', [$email]);
        login_user($user);
        flash('Account aangemaakt. Welkom!');
        $next = $_SESSION['after_login'] ?? null;
        unset($_SESSION['after_login']);
        redirect($next ?: '?p=chat');
    }
}
?>
<div class="card anim-pop" style="max-width:460px;margin:24px auto">
  <h1>Account aanmaken</h1>
  <p class="muted small">Met een account kun je via de website met me chatten en je printverzoeken volgen.</p>
  <?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label>Naam <input name="full_name" value="<?= e($_POST['full_name'] ?? '') ?>"></label>
    <label>E-mail <input type="email" name="email" required value="<?= e($_POST['email'] ?? '') ?>"></label>
    <label>Wachtwoord (minstens 10 tekens) <input type="password" name="password" required></label>
    <label>Herhaal wachtwoord <input type="password" name="password2" required></label>
    <button class="btn hover-sheen" type="submit" style="width:100%">Account aanmaken</button>
  </form>
  <p class="small muted" style="text-align:center;margin-top:14px">
    Heb je al een account? <a href="<?= e(url('?p=login')) ?>">Inloggen</a>
  </p>
</div>

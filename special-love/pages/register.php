<?php
$GLOBALS['page_title'] = 'Create an account - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Create an account to follow your 3D print orders and quotes.';

if (is_logged_in()) redirect('?p=account');
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $name  = trim((string)($_POST['full_name'] ?? ''));
    $email = trim((string)($_POST['email'] ?? ''));
    $pass  = (string)($_POST['password'] ?? '');
    $pass2 = (string)($_POST['password2'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
    if (strlen($pass) < 10) $errors[] = 'Passwords must be at least 10 characters.';
    if ($pass !== $pass2) $errors[] = 'The two passwords do not match.';
    if (!$errors && one('SELECT id FROM users WHERE email = ?', [$email])) $errors[] = 'An account with that email already exists.';

    if (!$errors) {
        q('INSERT INTO users (email, password_hash, full_name, role) VALUES (?,?,?,"customer")',
          [$email, password_hash($pass, PASSWORD_DEFAULT), $name]);
        $user = one('SELECT * FROM users WHERE email = ?', [$email]);
        login_user($user);
        flash('Account created. Welcome!');
        redirect('?p=account');
    }
}
?>
<div class="card anim-pop" style="max-width:460px;margin:24px auto">
  <h1>Create your account</h1>
  <?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label>Name <input name="full_name" value="<?= e($_POST['full_name'] ?? '') ?>"></label>
    <label>Email <input type="email" name="email" required value="<?= e($_POST['email'] ?? '') ?>"></label>
    <label>Password (min 10 characters) <input type="password" name="password" required></label>
    <label>Repeat password <input type="password" name="password2" required></label>
    <button class="btn hover-sheen" type="submit" style="width:100%">Create account</button>
  </form>
  <p class="small muted" style="text-align:center;margin-top:14px">
    Already have one? <a href="<?= e(url('?p=login')) ?>">Sign in</a>
  </p>
</div>

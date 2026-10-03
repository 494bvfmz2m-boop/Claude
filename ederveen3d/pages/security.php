<?php
require_login();
$GLOBALS['page_title'] = 'Beveiliging - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Wijzig je wachtwoord en beheer tweestapsverificatie.';
$u = current_user();
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    if ($action === 'password') {
        $cur = (string)($_POST['current'] ?? '');
        $new = (string)($_POST['new'] ?? '');
        $rep = (string)($_POST['repeat'] ?? '');
        if (!password_verify($cur, $u['password_hash'])) $errors[] = 'Je huidige wachtwoord klopt niet.';
        if (strlen($new) < 10) $errors[] = 'Je nieuwe wachtwoord moet minstens 10 tekens zijn.';
        if ($new !== $rep) $errors[] = 'De nieuwe wachtwoorden zijn niet gelijk.';
        if (!$errors) {
            q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
            flash('Wachtwoord gewijzigd.');
            redirect('?p=security');
        }
    } elseif ($action === 'start2fa') {
        $_SESSION['totp_setup'] = totp_secret();
        redirect('?p=security#twofa');
    } elseif ($action === 'confirm2fa') {
        $secret = $_SESSION['totp_setup'] ?? '';
        if ($secret && totp_verify($secret, (string)($_POST['code'] ?? ''))) {
            q('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?', [$secret, $u['id']]);
            unset($_SESSION['totp_setup']);
            flash('Tweestapsverificatie staat aan.');
            redirect('?p=security');
        }
        $errors[] = 'Deze code klopt niet. Probeer de volgende code uit je app.';
    } elseif ($action === 'off2fa') {
        if (!password_verify((string)($_POST['current'] ?? ''), $u['password_hash'])) {
            $errors[] = 'Vul je wachtwoord in om tweestapsverificatie uit te zetten.';
        } else {
            q('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?', [$u['id']]);
            flash('Tweestapsverificatie staat uit.', 'warn');
            redirect('?p=security');
        }
    }
}

$setupSecret = $_SESSION['totp_setup'] ?? null;
$enabled = (int)$u['totp_enabled'] === 1;
?>
<h1>Beveiliging</h1>
<div class="tabs">
  <a class="tab" href="<?= e(url('?p=account')) ?>"><?= showcase_mode() ? 'Printverzoeken' : 'Bestellingen &amp; verzoeken' ?></a>
  <a class="tab" href="<?= e(url('?p=chat')) ?>">Chat</a>
  <a class="tab active" href="<?= e(url('?p=security')) ?>">Beveiliging</a>
</div>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <div class="card">
    <h2>Wachtwoord wijzigen</h2>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="password">
      <label>Huidig wachtwoord <input type="password" name="current" required></label>
      <label>Nieuw wachtwoord <input type="password" name="new" required></label>
      <label>Herhaal nieuw wachtwoord <input type="password" name="repeat" required></label>
      <button class="btn" type="submit">Wachtwoord opslaan</button>
    </form>
  </div>

  <div class="card" id="twofa">
    <h2>Tweestapsverificatie</h2>
    <?php if ($enabled): ?>
      <p class="note ok">Tweestapsverificatie staat aan.</p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="off2fa">
        <label>Wachtwoord <input type="password" name="current" required></label>
        <button class="btn danger" type="submit">Uitzetten</button>
      </form>
    <?php elseif ($setupSecret): ?>
      <p class="muted small">Scan deze code met Google Authenticator, Authy of 1Password en vul daarna de code in.</p>
      <img class="anim-pop" style="background:#fff;padding:8px;border-radius:10px"
           src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=<?= urlencode(totp_uri($setupSecret, $u['email'], setting('store_name', 'Ederveen3D'))) ?>"
           alt="QR-code">
      <p class="small muted">Lukt scannen niet? Vul deze sleutel in: <code><?= e($setupSecret) ?></code></p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="confirm2fa">
        <label>6-cijferige code <input name="code" maxlength="6" inputmode="numeric" required></label>
        <button class="btn" type="submit">Aanzetten</button>
      </form>
    <?php else: ?>
      <p class="muted">Voeg een extra stap toe bij het inloggen met een authenticator-app. Sterk aangeraden voor beheerders.</p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="start2fa">
        <button class="btn hover-sheen" type="submit">Tweestapsverificatie instellen</button>
      </form>
    <?php endif; ?>
  </div>
</div>

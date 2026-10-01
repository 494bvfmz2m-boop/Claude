<?php
require_owner();
$GLOBALS['page_title'] = 'Team - beheer';
$GLOBALS['page_desc'] = 'Beheerders toevoegen en toegang regelen.';

$errors = [];
$me = current_user();

if (!function_exists('owner_count')) {
function owner_count(): int {
    return (int)(one('SELECT COUNT(*) c FROM users WHERE role = "owner"')['c'] ?? 0);
}
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    $id = (int)($_POST['id'] ?? 0);

    if ($action === 'add') {
        $email = trim((string)($_POST['email'] ?? ''));
        $name  = trim((string)($_POST['full_name'] ?? ''));
        $role  = ($_POST['role'] ?? 'staff') === 'owner' ? 'owner' : 'staff';
        $pass  = (string)($_POST['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Vul een geldig e-mailadres in.';
        if (strlen($pass) < 10) $errors[] = 'Het tijdelijke wachtwoord moet minstens 10 tekens zijn.';
        if (!$errors) {
            $existing = one('SELECT id FROM users WHERE email = ?', [$email]);
            if ($existing) {
                q('UPDATE users SET role = ? WHERE id = ?', [$role, $existing['id']]);
                flash('Dit account heeft nu ' . $role . '-toegang.');
            } else {
                q('INSERT INTO users (email, password_hash, full_name, role) VALUES (?,?,?,?)',
                  [$email, password_hash($pass, PASSWORD_DEFAULT), $name, $role]);
                flash('Account aangemaakt. Geef het tijdelijke wachtwoord privé door en vraag om het te wijzigen.');
            }
            redirect('?p=admin_team');
        }
    } elseif ($action === 'role' && $id) {
        $role = ($_POST['role'] ?? 'staff') === 'owner' ? 'owner' : 'staff';
        $target = one('SELECT * FROM users WHERE id = ?', [$id]);
        if ($target && $target['role'] === 'owner' && $role !== 'owner' && owner_count() <= 1) {
            $errors[] = 'Er moet altijd minstens één eigenaar zijn.';
        } else {
            q('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
            flash('Toegang bijgewerkt.');
            redirect('?p=admin_team');
        }
    } elseif ($action === 'revoke' && $id) {
        $target = one('SELECT * FROM users WHERE id = ?', [$id]);
        if ($target && $target['role'] === 'owner' && owner_count() <= 1) {
            $errors[] = 'Je kunt de laatste eigenaar niet verwijderen.';
        } elseif ((int)$id === (int)$me['id']) {
            $errors[] = 'Je kunt je eigen toegang niet intrekken.';
        } else {
            q('UPDATE users SET role = "customer" WHERE id = ?', [$id]);
            flash('Beheertoegang ingetrokken.', 'warn');
            redirect('?p=admin_team');
        }
    }
}

$team = all('SELECT * FROM users WHERE role IN ("staff","owner") ORDER BY role DESC, email');
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_team'); ?>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <form class="card" method="post">
    <?= csrf_field() ?><input type="hidden" name="action" value="add">
    <h2>Beheerder toevoegen</h2>
    <label>Naam <input name="full_name"></label>
    <label>E-mail <input type="email" name="email" required></label>
    <label>Tijdelijk wachtwoord (minstens 10 tekens) <input name="password" required></label>
    <label>Toegang
      <select name="role"><option value="staff">Staff - bestellingen, verzoeken, producten</option><option value="owner">Owner - alles, ook team</option></select>
    </label>
    <button class="btn hover-sheen" type="submit">Account aanmaken</button>
  </form>

  <div class="card">
    <h2>Huidig team</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>E-mail</th><th>Toegang</th><th>2FA</th><th></th></tr></thead>
      <tbody><?php foreach ($team as $t): ?>
        <tr>
          <td><?= e($t['email']) ?><?= (int)$t['id'] === (int)$me['id'] ? ' <span class="pill">jij</span>' : '' ?></td>
          <td>
            <form method="post" style="display:flex;gap:6px;align-items:center">
              <?= csrf_field() ?><input type="hidden" name="action" value="role"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
              <select name="role" style="width:auto">
                <option value="staff" <?= $t['role'] === 'staff' ? 'selected' : '' ?>>staff</option>
                <option value="owner" <?= $t['role'] === 'owner' ? 'selected' : '' ?>>owner</option>
              </select>
              <button class="btn ghost small" type="submit">Instellen</button>
            </form>
          </td>
          <td><?= (int)$t['totp_enabled'] === 1 ? 'Aan' : '<span class="muted">Uit</span>' ?></td>
          <td>
            <form method="post" onsubmit="return confirm('Beheertoegang voor deze persoon intrekken?')">
              <?= csrf_field() ?><input type="hidden" name="action" value="revoke"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
              <button class="btn danger small" type="submit">Intrekken</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?></tbody>
    </table></div>
    <p class="small muted">Staff kan bestellingen, printverzoeken en producten beheren. Owners kunnen ook het team en de betaalinstellingen beheren.</p>
  </div>
</div>

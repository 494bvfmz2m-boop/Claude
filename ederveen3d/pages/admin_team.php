<?php
require_owner();
$GLOBALS['page_title'] = 'Team access - admin';
$GLOBALS['page_desc'] = 'Add admin accounts and manage access levels.';

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
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid email address.';
        if (strlen($pass) < 10) $errors[] = 'Temporary password must be at least 10 characters.';
        if (!$errors) {
            $existing = one('SELECT id FROM users WHERE email = ?', [$email]);
            if ($existing) {
                q('UPDATE users SET role = ? WHERE id = ?', [$role, $existing['id']]);
                flash('That account now has ' . $role . ' access.');
            } else {
                q('INSERT INTO users (email, password_hash, full_name, role) VALUES (?,?,?,?)',
                  [$email, password_hash($pass, PASSWORD_DEFAULT), $name, $role]);
                flash('Account created. Share the temporary password privately and ask them to change it.');
            }
            redirect('?p=admin_team');
        }
    } elseif ($action === 'role' && $id) {
        $role = ($_POST['role'] ?? 'staff') === 'owner' ? 'owner' : 'staff';
        $target = one('SELECT * FROM users WHERE id = ?', [$id]);
        if ($target && $target['role'] === 'owner' && $role !== 'owner' && owner_count() <= 1) {
            $errors[] = 'There must always be at least one owner.';
        } else {
            q('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
            flash('Access level updated.');
            redirect('?p=admin_team');
        }
    } elseif ($action === 'revoke' && $id) {
        $target = one('SELECT * FROM users WHERE id = ?', [$id]);
        if ($target && $target['role'] === 'owner' && owner_count() <= 1) {
            $errors[] = 'You cannot remove the last owner.';
        } elseif ((int)$id === (int)$me['id']) {
            $errors[] = 'You cannot remove your own access.';
        } else {
            q('UPDATE users SET role = "customer" WHERE id = ?', [$id]);
            flash('Admin access removed.', 'warn');
            redirect('?p=admin_team');
        }
    }
}

$team = all('SELECT * FROM users WHERE role IN ("staff","owner") ORDER BY role DESC, email');
?>
<h1>Admin</h1>
<?php admin_tabs('admin_team'); ?>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <form class="card" method="post">
    <?= csrf_field() ?><input type="hidden" name="action" value="add">
    <h2>Add an admin account</h2>
    <label>Name <input name="full_name"></label>
    <label>Email <input type="email" name="email" required></label>
    <label>Temporary password (min 10 characters) <input name="password" required></label>
    <label>Access level
      <select name="role"><option value="staff">Staff - orders, requests, products</option><option value="owner">Owner - everything, including team</option></select>
    </label>
    <button class="btn hover-sheen" type="submit">Create account</button>
  </form>

  <div class="card">
    <h2>Current team</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Email</th><th>Access</th><th>2FA</th><th></th></tr></thead>
      <tbody><?php foreach ($team as $t): ?>
        <tr>
          <td><?= e($t['email']) ?><?= (int)$t['id'] === (int)$me['id'] ? ' <span class="pill">you</span>' : '' ?></td>
          <td>
            <form method="post" style="display:flex;gap:6px;align-items:center">
              <?= csrf_field() ?><input type="hidden" name="action" value="role"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
              <select name="role" style="width:auto">
                <option value="staff" <?= $t['role'] === 'staff' ? 'selected' : '' ?>>staff</option>
                <option value="owner" <?= $t['role'] === 'owner' ? 'selected' : '' ?>>owner</option>
              </select>
              <button class="btn ghost small" type="submit">Set</button>
            </form>
          </td>
          <td><?= (int)$t['totp_enabled'] === 1 ? 'On' : '<span class="muted">Off</span>' ?></td>
          <td>
            <form method="post" onsubmit="return confirm('Remove admin access for this person?')">
              <?= csrf_field() ?><input type="hidden" name="action" value="revoke"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
              <button class="btn danger small" type="submit">Revoke</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?></tbody>
    </table></div>
    <p class="small muted">Staff can manage orders, print requests and products. Owners can also manage the team and payment settings.</p>
  </div>
</div>

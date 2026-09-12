<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_roles');
$me = current_user();

$PERMS = [
    'manage_posts' => 'Create & manage posts',
    'manage_users' => 'Manage users',
    'manage_roles' => 'Manage roles',
    'manage_settings' => 'Edit site settings',
    'manage_tickets' => 'Manage support tickets',
    'manage_store' => 'View store orders',
];
$actorMaxWeight = user_max_weight($me);

$error = null;
$editingRole = null;

function slugify_role_name($name, $existingIds) {
    $base = strtolower(preg_replace('/[^a-z0-9]+/i', '_', trim($name)));
    $base = trim($base, '_');
    if ($base === '') $base = 'role';
    $slug = $base;
    $i = 2;
    while (in_array($slug, $existingIds, true)) {
        $slug = $base . '_' . $i;
        $i++;
    }
    return $slug;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';
    $actorMaxWeight = user_max_weight($me);

    if ($action === 'delete') {
        $id = $_POST['id'] ?? '';
        $target = get_role($id);
        if ($target && !empty($target['protected'])) {
            $error = 'That role is protected and cannot be deleted.';
        } elseif ($target && role_outranks_user($target, $me)) {
            $error = 'That role outranks you (higher weight than your own) and cannot be deleted.';
        } else {
            // ON DELETE CASCADE on user_roles takes care of unassigning it from everyone.
            db_execute("DELETE FROM roles WHERE id = ?", [$id]);
            redirect(SITE_URL . '/admin/roles');
        }
    }

    if ($action === 'save') {
        $name = trim($_POST['name'] ?? '');
        $color = trim($_POST['color'] ?? '#4f7cff');
        $useGradient = isset($_POST['use_gradient']);
        $color2 = trim($_POST['color2'] ?? '');
        $id = trim($_POST['id'] ?? '');
        $isStaff = isset($_POST['staff']) ? 1 : 0;
        $weight = (int)($_POST['weight'] ?? 0);
        $perms = [];
        foreach (array_keys($PERMS) as $key) {
            $perms[$key] = isset($_POST['perm_' . $key]) ? 1 : 0;
        }

        // Find the role being edited (if any) so we can hierarchy-check it below.
        $existingRole = $id !== '' ? get_role($id) : null;

        if ($name === '') {
            $error = 'Role name is required.';
        } elseif (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $error = 'Badge color must be a valid hex code.';
        } elseif ($useGradient && !preg_match('/^#[0-9a-fA-F]{6}$/', $color2)) {
            $error = 'Gradient end color must be a valid hex code.';
        } elseif ($existingRole && role_outranks_user($existingRole, $me)) {
            $error = 'That role outranks you (higher weight than your own) and cannot be edited.';
        } elseif ($weight > $actorMaxWeight) {
            $error = "You can't set a weight higher than your own (max {$actorMaxWeight}).";
        } else {
            $finalColor2 = $useGradient ? $color2 : null;

            if ($existingRole) {
                if (empty($existingRole['protected'])) {
                    db_execute(
                        "UPDATE roles SET name = ?, color = ?, color2 = ?, staff = ?, weight = ?,
                         perm_manage_posts = ?, perm_manage_users = ?, perm_manage_roles = ?, perm_manage_settings = ?, perm_manage_tickets = ?, perm_manage_store = ?
                         WHERE id = ?",
                        [$name, $color, $finalColor2, $isStaff, $weight,
                         $perms['manage_posts'], $perms['manage_users'], $perms['manage_roles'], $perms['manage_settings'], $perms['manage_tickets'], $perms['manage_store'],
                         $id]
                    );
                } else {
                    // Protected role: color, gradient, staff flag, and weight are editable;
                    // name and permissions stay locked (hierarchy check above already passed).
                    db_execute(
                        "UPDATE roles SET color = ?, color2 = ?, staff = ?, weight = ? WHERE id = ?",
                        [$color, $finalColor2, $isStaff, $weight, $id]
                    );
                }
            } else {
                $existingIds = array_map(fn($r) => $r['id'], get_roles());
                $newId = slugify_role_name($name, $existingIds);
                db_execute(
                    "INSERT INTO roles (id, name, color, color2, protected, staff, weight,
                     perm_manage_posts, perm_manage_users, perm_manage_roles, perm_manage_settings, perm_manage_tickets, perm_manage_store)
                     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [$newId, $name, $color, $finalColor2, $isStaff, $weight,
                     $perms['manage_posts'], $perms['manage_users'], $perms['manage_roles'], $perms['manage_settings'], $perms['manage_tickets'], $perms['manage_store']]
                );
            }
            redirect(SITE_URL . '/admin/roles');
        }
    }
}

if (isset($_GET['edit'])) {
    foreach (get_roles() as $r) {
        if ($r['id'] === $_GET['edit']) { $editingRole = $r; break; }
    }
    if ($editingRole && role_outranks_user($editingRole, $me)) {
        $error = 'That role outranks you (higher weight than your own) — you can view it in the list below, but not edit it.';
        $editingRole = null;
    }
}

$pageTitle = 'Manage Roles';
$activeAdminPage = 'roles';
require_once __DIR__ . '/../includes/header.php';
$roles = get_roles();
usort($roles, fn($a, $b) => ($b['weight'] ?? 0) <=> ($a['weight'] ?? 0));
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1><?= $editingRole ? 'Edit role' : 'Roles' ?></h1>
    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

    <div class="card">
      <form method="post" id="roleForm">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save">
        <?php if ($editingRole): ?><input type="hidden" name="id" value="<?= e($editingRole['id']) ?>"><?php endif; ?>

        <div class="field">
          <label for="name">Role name</label>
          <input type="text" id="name" name="name" required value="<?= e($editingRole['name'] ?? '') ?>" <?= !empty($editingRole['protected']) ? 'readonly' : '' ?>>
          <?php if (!empty($editingRole['protected'])): ?><div class="hint">This is the protected Core role — its name and permissions can't be changed, but its color, gradient, staff flag, and weight can.</div><?php endif; ?>
        </div>

        <div class="field" style="display:flex; gap:20px; flex-wrap:wrap;">
          <div style="max-width:160px;">
            <label for="color">Badge color</label>
            <input type="color" id="color" name="color" value="<?= e($editingRole['color'] ?? '#f4b342') ?>">
          </div>
          <div style="max-width:160px;" id="color2Wrap">
            <label for="color2">Gradient end color</label>
            <input type="color" id="color2" name="color2" value="<?= e($editingRole['color2'] ?? '#2dd4bf') ?>">
          </div>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="use_gradient" name="use_gradient" <?= !empty($editingRole['color2']) ? 'checked' : '' ?>>
          <label for="use_gradient">Make this a 2-color gradient badge instead of a solid color</label>
        </div>

        <div class="checkbox-row" style="margin-top:18px;">
          <input type="checkbox" id="staff" name="staff" <?= !empty($editingRole['staff']) ? 'checked' : '' ?>>
          <label for="staff">Show this role on the public Staff page</label>
        </div>
        <div class="field" style="max-width:160px;">
          <label for="weight">Staff list weight</label>
          <input type="number" step="1" id="weight" name="weight" value="<?= e((string)($editingRole['weight'] ?? 0)) ?>">
          <div class="hint">Higher weight = higher up the Staff page, and roles with a higher weight than yours can't be edited or removed by you — even with "Manage roles" on. You can't set a weight above your own (currently <?= $actorMaxWeight ?>).</div>
        </div>

        <div class="field">
          <label>Permissions</label>
          <?php foreach ($PERMS as $key => $label): ?>
            <div class="checkbox-row">
              <input type="checkbox" id="perm_<?= e($key) ?>" name="perm_<?= e($key) ?>"
                <?= !empty($editingRole['permissions'][$key]) ? 'checked' : '' ?>
                <?= !empty($editingRole['protected']) ? 'disabled' : '' ?>>
              <label for="perm_<?= e($key) ?>"><?= e($label) ?></label>
            </div>
          <?php endforeach; ?>
        </div>
        <button type="submit" class="btn btn-primary"><?= $editingRole ? 'Save changes' : 'Create role' ?></button>
        <?php if ($editingRole): ?><a href="<?= SITE_URL ?>/admin/roles" class="btn btn-outline">Cancel</a><?php endif; ?>
      </form>
    </div>

    <h2 style="margin-top:36px;">All roles</h2>
    <table>
      <tr><th>Role</th><th>Staff</th><th>Weight</th><th>Permissions</th><th></th></tr>
      <?php foreach ($roles as $r): ?>
        <tr>
          <td>
            <span class="role-pill" style="<?= role_pill_style($r) ?>"><?= e($r['name']) ?></span>
            <?php if (!empty($r['protected'])): ?><span class="badge">protected</span><?php endif; ?>
          </td>
          <td class="muted"><?= !empty($r['staff']) ? 'Yes' : '—' ?></td>
          <td class="muted"><?= (int)($r['weight'] ?? 0) ?></td>
          <td class="muted"><?= e(implode(', ', array_keys(array_filter($r['permissions'] ?? [])))) ?: '—' ?></td>
          <td>
            <?php if (role_outranks_user($r, $me)): ?>
              <span class="muted">outranks you</span>
            <?php else: ?>
              <a href="<?= SITE_URL ?>/admin/roles?edit=<?= urlencode($r['id']) ?>" class="btn btn-outline btn-sm">Edit</a>
              <?php if (empty($r['protected'])): ?>
                <form method="post" class="inline-form" data-confirm="Delete this role? It will be removed from all users who have it.">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= e($r['id']) ?>">
                  <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                </form>
              <?php endif; ?>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
    </table>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>

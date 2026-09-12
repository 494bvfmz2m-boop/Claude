<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_users');
$me = current_user();

$error = null;
$renameError = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';

    if ($action === 'rename') {
        $userId = (int)($_POST['user_id'] ?? 0);
        $result = rename_user($userId, $_POST['username'] ?? '');
        if ($result['ok']) {
            redirect(SITE_URL . '/admin/users?manage=' . $userId);
        }
        $renameError = $result['error'];
    }

    if ($action === 'update_roles') {
        $userId = (int)($_POST['user_id'] ?? 0);
        $submittedRoles = $_POST['roles'] ?? [];
        $target = find_user_by_id($userId);
        if ($target) {
            $roles = get_roles();
            $currentRoles = $target['roles'];
            $newRoles = [];
            foreach ($roles as $r) {
                // A role is "locked" for this actor if it's protected, OR its weight
                // outranks the actor's own highest weight. Locked roles can't be
                // added or removed here — they pass through untouched either way,
                // no matter what permission the actor has. Super ops bypass this
                // entirely and can grant/remove any role, protected or not.
                $locked = !is_super_op($me) && (!empty($r['protected']) || role_outranks_user($r, $me));
                $has = in_array($r['id'], $currentRoles, true);
                if ($locked) {
                    if ($has) $newRoles[] = $r['id'];
                } elseif (in_array($r['id'], $submittedRoles, true)) {
                    $newRoles[] = $r['id'];
                }
            }
            $newRoles = array_values(array_unique($newRoles));

            $pdo = db_connect();
            $pdo->beginTransaction();
            db_execute("DELETE FROM user_roles WHERE user_id = ?", [$userId]);
            foreach ($newRoles as $roleId) {
                db_execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [$userId, $roleId]);
            }
            $pdo->commit();
        }
        redirect(SITE_URL . '/admin/users?manage=' . $userId);
    }

    if ($action === 'toggle_verify') {
        $userId = (int)($_POST['user_id'] ?? 0);
        db_execute("UPDATE users SET verified = 1 - verified WHERE id = ?", [$userId]);
        redirect(SITE_URL . '/admin/users?manage=' . $userId);
    }

    if ($action === 'delete') {
        $userId = (int)($_POST['user_id'] ?? 0);
        $target = find_user_by_id($userId);
        if ($target && user_holds_protected_role($target)) {
            $error = 'This account holds a protected role and cannot be deleted.';
        } elseif ($target && user_max_weight($target) > user_max_weight($me)) {
            $error = 'This account outranks you (higher role weight) and cannot be deleted.';
        } elseif ($target && (int)$target['id'] === (int)$me['id']) {
            $error = 'You cannot delete your own account.';
        } else {
            db_execute("DELETE FROM users WHERE id = ?", [$userId]);
            redirect(SITE_URL . '/admin/users');
        }
    }
}

$search = trim($_GET['q'] ?? '');
$manageId = isset($_GET['manage']) ? (int)$_GET['manage'] : null;
$manageUser = $manageId ? find_user_by_id($manageId) : null;

$pageTitle = 'Manage Users';
$activeAdminPage = 'users';
require_once __DIR__ . '/../includes/header.php';

$roles = get_roles();
$actorMaxWeight = user_max_weight($me);
$backLink = SITE_URL . '/admin/users' . ($search !== '' ? '?q=' . urlencode($search) : '');
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">

    <?php if ($manageUser): ?>
      <a href="<?= e($backLink) ?>" class="btn btn-outline btn-sm" style="margin-bottom:18px;">← All users</a>
      <h1><?= author_badge_html($manageUser['id'], $manageUser['username']) ?></h1>
      <p class="muted"><?= e($manageUser['email']) ?><?php if (!empty($manageUser['minecraft_username'])): ?> · Minecraft: <?= e($manageUser['minecraft_username']) ?><?php endif; ?></p>

      <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
      <?php if ($renameError): ?><div class="alert alert-error"><?= e($renameError) ?></div><?php endif; ?>

      <div class="card">
        <div class="status-row">
          <div>
            <?php if (empty($manageUser['verified'])): ?>
              <span class="badge" style="color:#ffb3b3;border-color:rgba(255,107,107,.4);">unverified</span>
            <?php else: ?>
              <span class="badge" style="color:var(--moss);border-color:rgba(124,179,66,.4);">verified</span>
            <?php endif; ?>
          </div>
          <div style="display:flex; gap:8px;">
            <form method="post" class="inline-form">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="toggle_verify">
              <input type="hidden" name="user_id" value="<?= (int)$manageUser['id'] ?>">
              <button type="submit" class="btn btn-outline btn-sm"><?= empty($manageUser['verified']) ? 'Mark verified' : 'Mark unverified' ?></button>
            </form>
            <?php if (!user_holds_protected_role($manageUser) && user_max_weight($manageUser) <= $actorMaxWeight && (int)$manageUser['id'] !== (int)$me['id']): ?>
              <form method="post" class="inline-form" data-confirm="Delete this account?">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="user_id" value="<?= (int)$manageUser['id'] ?>">
                <button type="submit" class="btn btn-danger btn-sm">Delete account</button>
              </form>
            <?php endif; ?>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Username</h2>
        <form method="post" style="display:flex; gap:8px; align-items:flex-end; max-width:360px;">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="rename">
          <input type="hidden" name="user_id" value="<?= (int)$manageUser['id'] ?>">
          <div class="field" style="margin-bottom:0; flex:1;">
            <input type="text" name="username" value="<?= e($manageUser['username']) ?>">
          </div>
          <button type="submit" class="btn btn-outline btn-sm">Rename</button>
        </form>
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Roles</h2>
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="update_roles">
          <input type="hidden" name="user_id" value="<?= (int)$manageUser['id'] ?>">
          <?php foreach ($roles as $r): ?>
            <?php
              $has = in_array($r['id'], $manageUser['roles'] ?? [], true);
              $isProtected = !empty($r['protected']);
              $outranksActor = role_outranks_user($r, $me);
              $locked = !is_super_op($me) && ($isProtected || $outranksActor);
            ?>
            <div class="checkbox-row">
              <input type="checkbox" id="role_<?= e($r['id']) ?>" name="roles[]" value="<?= e($r['id']) ?>"
                <?= $has ? 'checked' : '' ?> <?= $locked ? 'disabled' : '' ?>>
              <label for="role_<?= e($r['id']) ?>">
                <span class="role-swatch" style="background:<?= e($r['color']) ?>"></span> <?= e($r['name']) ?>
                <?php if ($locked && $isProtected): ?><span class="muted">(protected — can't be changed here)</span>
                <?php elseif ($locked && $outranksActor): ?><span class="muted">(outranks you — can't be changed here)</span>
                <?php endif; ?>
              </label>
            </div>
            <?php if ($locked && $has): // ensure it's still submitted even though disabled ?>
              <input type="hidden" name="roles[]" value="<?= e($r['id']) ?>">
            <?php endif; ?>
          <?php endforeach; ?>
          <button type="submit" class="btn btn-outline btn-sm" style="margin-top:8px;">Save roles</button>
        </form>
      </div>

    <?php else: ?>

      <h1>Users</h1>
      <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

      <form method="get" class="user-search">
        <input type="text" name="q" value="<?= e($search) ?>" placeholder="Search by username or email…">
        <button type="submit" class="btn btn-outline btn-sm">Search</button>
        <?php if ($search !== ''): ?><a href="<?= SITE_URL ?>/admin/users" class="btn btn-ghost btn-sm">Clear</a><?php endif; ?>
      </form>

      <?php $users = get_users($search !== '' ? $search : null); ?>

      <?php if (empty($users)): ?>
        <p class="muted" style="margin-top:20px;"><?= $search !== '' ? 'No users match "' . e($search) . '".' : 'No users yet.' ?></p>
      <?php else: ?>
        <div class="user-list">
          <?php foreach ($users as $u): ?>
            <div class="user-row">
              <div class="user-row-info">
                <?= author_badge_html($u['id'], $u['username']) ?>
                <span class="muted user-row-email"><?= e($u['email']) ?></span>
                <?php if (empty($u['verified'])): ?><span class="badge" style="color:#ffb3b3;border-color:rgba(255,107,107,.4);">unverified</span><?php endif; ?>
              </div>
              <a href="<?= SITE_URL ?>/admin/users?manage=<?= (int)$u['id'] ?><?= $search !== '' ? '&q=' . urlencode($search) : '' ?>" class="btn btn-outline btn-sm">Manage</a>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>

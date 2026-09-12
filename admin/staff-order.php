<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_roles');
$me = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';

    if ($action === 'save_order') {
        $orderedIds = array_filter(array_map('intval', explode(',', $_POST['order'] ?? '')));
        $pdo = db_connect();
        $pdo->beginTransaction();
        foreach (array_values($orderedIds) as $index => $userId) {
            db_execute("UPDATE users SET staff_sort_order = ? WHERE id = ?", [$index, $userId]);
        }
        $pdo->commit();
        redirect(SITE_URL . '/admin/staff-order');
    }

    if ($action === 'reset_order') {
        // Only clear it for people currently on the staff list, not everyone.
        foreach (get_staff_list() as $entry) {
            db_execute("UPDATE users SET staff_sort_order = NULL WHERE id = ?", [$entry['user']['id']]);
        }
        redirect(SITE_URL . '/admin/staff-order');
    }
}

$pageTitle = 'Staff Order';
$activeAdminPage = 'staff-order';
require_once __DIR__ . '/../includes/header.php';

$staffList = get_staff_list();
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1>Staff Order</h1>
    <p class="muted">Drag anyone to reorder the public <a href="<?= SITE_URL ?>/staff">/staff</a> page — including yourself, even below people whose role outranks you. New staff without a manual position fall back to their role's weight automatically.</p>

    <?php if (empty($staffList)): ?>
      <p class="muted">Nobody is on the staff list yet.</p>
    <?php else: ?>
      <div class="card">
        <ul class="staff-order-list" id="staffOrderList">
          <?php foreach ($staffList as $entry): ?>
            <li class="staff-order-item" draggable="true" data-user-id="<?= (int)$entry['user']['id'] ?>">
              <span class="staff-order-handle">⠿</span>
              <?php if ($entry['role']): ?>
                <span class="role-pill" style="<?= role_pill_style($entry['role']) ?>"><?= e($entry['role']['name']) ?></span>
              <?php endif; ?>
              <span class="staff-row-name"><?= e($entry['user']['username']) ?></span>
            </li>
          <?php endforeach; ?>
        </ul>
      </div>

      <div style="margin-top:16px; display:flex; gap:8px;">
        <form method="post" id="saveOrderForm">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="save_order">
          <input type="hidden" name="order" id="orderInput" value="">
          <button type="submit" class="btn btn-primary">Save order</button>
        </form>
        <form method="post" data-confirm="Reset everyone currently on the staff list back to automatic weight-based ordering?">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="reset_order">
          <button type="submit" class="btn btn-outline">Reset to automatic order</button>
        </form>
      </div>
    <?php endif; ?>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>

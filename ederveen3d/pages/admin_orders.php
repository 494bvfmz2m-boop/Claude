<?php
require_staff();
$GLOBALS['page_title'] = 'Orders - admin';
$GLOBALS['page_desc'] = 'Manage customer orders.';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $status = (string)($_POST['status'] ?? 'new');
    $payment = (string)($_POST['payment_status'] ?? 'unpaid');
    $tracking = trim((string)($_POST['tracking'] ?? ''));
    $allowedStatus = ['new', 'paid', 'printing', 'finishing', 'shipped', 'complete', 'cancelled'];
    $allowedPayment = ['unpaid', 'pending', 'paid', 'refunded'];
    if (in_array($status, $allowedStatus, true) && in_array($payment, $allowedPayment, true)) {
        q('UPDATE orders SET status = ?, payment_status = ?, tracking = ? WHERE id = ?', [$status, $payment, $tracking ?: null, $id]);
        flash('Order updated.');
    }
    redirect('?p=admin_orders');
}

$filter = (string)($_GET['status'] ?? '');
$orders = $filter !== ''
    ? all('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200', [$filter])
    : all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
?>
<h1>Admin</h1>
<?php admin_tabs('admin_orders'); ?>

<div class="card">
  <h2>Orders</h2>
  <p class="small">
    <a class="pill" href="<?= e(url('?p=admin_orders')) ?>">All</a>
    <?php foreach (['new', 'paid', 'printing', 'shipped', 'complete'] as $s): ?>
      <a class="pill" href="<?= e(url('?p=admin_orders&status=' . $s)) ?>"><?= e($s) ?></a>
    <?php endforeach; ?>
  </p>
  <?php if (!$orders): ?><p class="muted">No orders yet.</p><?php endif; ?>
  <?php foreach ($orders as $o):
      $items = all('SELECT * FROM order_items WHERE order_id = ?', [$o['id']]); ?>
    <div class="card hover-lift" style="margin-bottom:14px">
      <div class="grid cols-2">
        <div>
          <h3><?= e($o['reference']) ?> <span class="pill"><?= e($o['status']) ?></span><span class="pill"><?= e($o['payment_status']) ?></span></h3>
          <p class="small muted"><?= e(date('j M Y H:i', strtotime($o['created_at']))) ?></p>
          <p class="small"><?= e($o['full_name']) ?> &middot; <?= e($o['email']) ?><?= $o['phone'] ? ' &middot; ' . e($o['phone']) : '' ?></p>
          <p class="small muted"><?= e($o['address1']) ?>, <?= e($o['city']) ?> <?= e($o['state']) ?> <?= e($o['postcode']) ?>, <?= e($o['country']) ?></p>
          <ul class="small">
            <?php foreach ($items as $it): ?><li><?= e($it['name']) ?> &times; <?= (int)$it['qty'] ?> - <?= money((int)$it['unit_price_cents']) ?></li><?php endforeach; ?>
          </ul>
          <?php if ($o['notes']): ?><p class="small muted">Note: <?= e($o['notes']) ?></p><?php endif; ?>
          <p class="price"><?= money((int)$o['total_cents']) ?> <span class="small muted">(<?= e($o['shipping_method']) ?>)</span></p>
        </div>
        <form method="post">
          <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$o['id'] ?>">
          <label>Status
            <select name="status">
              <?php foreach (['new', 'paid', 'printing', 'finishing', 'shipped', 'complete', 'cancelled'] as $s): ?>
                <option value="<?= $s ?>" <?= $o['status'] === $s ? 'selected' : '' ?>><?= $s ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <label>Payment
            <select name="payment_status">
              <?php foreach (['unpaid', 'pending', 'paid', 'refunded'] as $s): ?>
                <option value="<?= $s ?>" <?= $o['payment_status'] === $s ? 'selected' : '' ?>><?= $s ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <label>Tracking number <input name="tracking" value="<?= e($o['tracking']) ?>"></label>
          <button class="btn small" type="submit">Save</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
</div>

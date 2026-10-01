<?php
require_staff();
$GLOBALS['page_title'] = 'Bestellingen - beheer';
$GLOBALS['page_desc'] = 'Bestellingen beheren.';

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
        flash('Bestelling bijgewerkt.');
    }
    redirect('?p=admin_orders');
}

$filter = (string)($_GET['status'] ?? '');
$orders = $filter !== ''
    ? all('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200', [$filter])
    : all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_orders'); ?>

<div class="card">
  <h2>Bestellingen</h2>
  <p class="small">
    <a class="pill" href="<?= e(url('?p=admin_orders')) ?>">Alle</a>
    <?php foreach (['new', 'paid', 'printing', 'shipped', 'complete'] as $s): ?>
      <a class="pill" href="<?= e(url('?p=admin_orders&status=' . $s)) ?>"><?= e($s) ?></a>
    <?php endforeach; ?>
  </p>
  <?php if (!$orders): ?><p class="muted">Nog geen bestellingen.</p><?php endif; ?>
  <?php foreach ($orders as $o):
      $items = all('SELECT * FROM order_items WHERE order_id = ?', [$o['id']]); ?>
    <div class="card hover-lift" style="margin-bottom:14px">
      <div class="grid cols-2">
        <div>
          <h3><?= e($o['reference']) ?> <span class="pill"><?= e($o['status']) ?></span><span class="pill"><?= e($o['payment_status']) ?></span></h3>
          <p class="small muted"><?= e(date('d-m-Y H:i', strtotime($o['created_at']))) ?></p>
          <p class="small"><?= e($o['full_name']) ?> &middot; <?= e($o['email']) ?><?= $o['phone'] ? ' &middot; ' . e($o['phone']) : '' ?></p>
          <p class="small muted"><?= e($o['address1']) ?>, <?= e($o['postcode']) ?> <?= e($o['city']) ?>, <?= e($o['country']) ?></p>
          <ul class="small">
            <?php foreach ($items as $it): ?><li><?= e($it['name']) ?> &times; <?= (int)$it['qty'] ?> - <?= money((int)$it['unit_price_cents']) ?></li><?php endforeach; ?>
          </ul>
          <?php if ($o['notes']): ?><p class="small muted">Opmerking: <?= e($o['notes']) ?></p><?php endif; ?>
          <p class="price"><?= money((int)$o['total_cents']) ?> <span class="small muted">(<?= e(shipping_label($o['shipping_method'])) ?>)</span></p>
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
          <label>Betaling
            <select name="payment_status">
              <?php foreach (['unpaid', 'pending', 'paid', 'refunded'] as $s): ?>
                <option value="<?= $s ?>" <?= $o['payment_status'] === $s ? 'selected' : '' ?>><?= $s ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <label>Track &amp; trace <input name="tracking" value="<?= e($o['tracking']) ?>"></label>
          <button class="btn small" type="submit">Opslaan</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
</div>

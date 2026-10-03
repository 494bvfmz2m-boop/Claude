<?php
require_login();
$GLOBALS['page_title'] = 'Your account - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Your orders, custom print requests and security settings.';
$u = current_user();
$orders = all("SELECT * FROM orders WHERE (user_id = ? OR email = ?) AND payment_status IN ('paid', 'refunded') ORDER BY created_at DESC", [$u['id'], $u['email']]);
$requests = all('SELECT * FROM custom_requests WHERE user_id = ? OR email = ? ORDER BY created_at DESC', [$u['id'], $u['email']]);
?>
<h1>Hi <?= e($u['full_name'] ?: $u['email']) ?></h1>
<div class="tabs">
  <a class="tab active" href="<?= e(url('?p=account')) ?>">Orders &amp; requests</a>
  <a class="tab" href="<?= e(url('?p=security')) ?>">Security</a>
  <?php if (is_staff()): ?><a class="tab" href="<?= e(url('?p=admin')) ?>">Admin area</a><?php endif; ?>
</div>

<div class="card">
  <h2>Your orders</h2>
  <?php if (!$orders): ?><p class="muted">No orders yet.</p><?php else: ?>
  <div class="table-scroll"><table>
    <thead><tr><th>Reference</th><th>Date</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead>
    <tbody><?php foreach ($orders as $o): ?>
      <tr>
        <td><?= e($o['reference']) ?></td>
        <td><?= e(date('j M Y', strtotime($o['created_at']))) ?></td>
        <td><?= money((int)$o['total_cents']) ?></td>
        <td><span class="pill"><?= e($o['status']) ?></span></td>
        <td><span class="pill"><?= e($o['payment_status']) ?></span></td>
        <td><a class="btn ghost small" href="<?= e(url('?p=order&ref=' . urlencode($o['reference']))) ?>">View</a></td>
      </tr>
    <?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</div>

<div class="card" style="margin-top:20px">
  <h2>Custom print requests</h2>
  <?php if (!$requests): ?>
    <p class="muted">No requests yet. <a href="<?= e(url('?p=custom')) ?>">Send us a model</a>.</p>
  <?php else: ?>
  <div class="table-scroll"><table>
    <thead><tr><th>Date</th><th>File</th><th>Material</th><th>Qty</th><th>Status</th><th>Quote</th></tr></thead>
    <tbody><?php foreach ($requests as $r): ?>
      <tr>
        <td><?= e(date('j M Y', strtotime($r['created_at']))) ?></td>
        <td><?= e($r['original_filename'] ?: '-') ?></td>
        <td><?= e($r['material']) ?></td>
        <td><?= (int)$r['quantity'] ?></td>
        <td><span class="pill"><?= e($r['status']) ?></span></td>
        <td><?= $r['quote_cents'] !== null ? money((int)$r['quote_cents']) : '<span class="muted">pending</span>' ?></td>
      </tr>
    <?php endforeach; ?></tbody>
  </table></div>
  <?php endif; ?>
</div>

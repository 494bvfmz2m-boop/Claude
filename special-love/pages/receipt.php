<?php
$ref = (string)($_GET['ref'] ?? '');
$order = $ref !== '' ? one("SELECT * FROM orders WHERE reference = ? AND payment_status IN ('paid', 'refunded')", [$ref]) : null;
if (!$order) {
    http_response_code(404);
    echo '<h1>Receipt not found</h1><p class="muted">Receipts are available once payment has gone through.</p>';
    return;
}
$GLOBALS['page_title'] = 'Receipt ' . $order['reference'] . ' - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Receipt for order ' . $order['reference'] . '.';
$items = all('SELECT * FROM order_items WHERE order_id = ?', [$order['id']]);
$store = setting('store_name', 'Special Love 3D');
?>
<div class="receipt">
  <p class="no-print" style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn" type="button" onclick="window.print()">🖨️ Print or save as PDF</button>
    <a class="btn ghost" href="<?= e(url('?p=order&ref=' . urlencode($order['reference']))) ?>">Back to order</a>
  </p>
  <div class="card">
    <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <h1 style="margin-bottom:4px">Receipt</h1>
        <p class="muted small" style="margin:0"><?= e($store) ?><?= setting('contact_email', '') ? ' · ' . e(setting('contact_email', '')) : '' ?></p>
      </div>
      <div style="text-align:right">
        <p style="margin:0"><strong><?= e($order['reference']) ?></strong></p>
        <p class="small muted" style="margin:0"><?= e(date('j M Y', strtotime($order['created_at']))) ?></p>
        <p style="margin:6px 0 0"><span class="pill"><?= $order['payment_status'] === 'refunded' ? 'Refunded' : 'Paid' ?></span></p>
      </div>
    </div>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <p class="small muted" style="margin:0 0 4px">Billed to</p>
    <p style="margin:0 0 18px"><?= e($order['full_name']) ?><br><?= e($order['email']) ?><br>
      <?= e($order['address1']) ?><?= $order['address2'] ? ', ' . e($order['address2']) : '' ?>, <?= e($order['city']) ?> <?= e($order['state']) ?> <?= e($order['postcode']) ?>, <?= e($order['country']) ?></p>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
      <?php foreach ($items as $it): ?>
        <tr><td><?= e($it['name']) ?></td><td><?= (int)$it['qty'] ?></td><td style="text-align:right"><?= money((int)$it['unit_price_cents'] * (int)$it['qty']) ?></td></tr>
      <?php endforeach; ?>
      <tr><td colspan="2">Shipping</td><td style="text-align:right"><?= money((int)$order['shipping_cents']) ?></td></tr>
      <?php if ((int)$order['discount_cents'] > 0): ?>
        <tr><td colspan="2">Discount<?= $order['discount_code'] ? ' (' . e($order['discount_code']) . ')' : '' ?></td><td style="text-align:right">&minus;<?= money((int)$order['discount_cents']) ?></td></tr>
      <?php endif; ?>
      <tr><td colspan="2"><strong>Total paid</strong></td><td style="text-align:right" class="price"><?= money((int)$order['total_cents']) ?></td></tr>
      <?php if ((int)$order['gst_cents'] > 0 && (int)$order['discount_cents'] === 0): ?>
        <tr><td colspan="2" class="small muted">Includes GST</td><td style="text-align:right" class="small muted"><?= money((int)$order['gst_cents']) ?></td></tr>
      <?php endif; ?>
      </tbody>
    </table>
    <p class="small muted" style="margin-top:18px">Paid by card through Stripe. 🎁 Thank you for supporting our small business!</p>
  </div>
</div>

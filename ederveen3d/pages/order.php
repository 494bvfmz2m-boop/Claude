<?php
$ref = (string)($_GET['ref'] ?? '');
$order = $ref !== '' ? one('SELECT * FROM orders WHERE reference = ?', [$ref]) : null;

if (!$order) {
    http_response_code(404);
    echo '<h1>Order not found</h1><p class="muted">Check the link in your confirmation email.</p>';
    return;
}
$GLOBALS['page_title'] = 'Order ' . $order['reference'] . ' - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Order status and details for ' . $order['reference'] . '.';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'pay') {
    csrf_check();
    if (stripe_enabled() && $order['payment_status'] !== 'paid') {
        $items = all('SELECT * FROM order_items WHERE order_id = ?', [$order['id']]);
        [$payUrl, $err] = stripe_checkout_session($order, $items);
        if ($payUrl) redirect($payUrl);
        flash('Could not open the payment page: ' . $err, 'err');
        redirect('?p=order&ref=' . urlencode($ref));
    }
}

$items = all('SELECT * FROM order_items WHERE order_id = ?', [$order['id']]);
$paid = $order['payment_status'] === 'paid';
?>
<div class="card anim-pop" style="text-align:center">
  <?php if ($paid): ?>
    <div class="success-ring"><svg viewBox="0 0 48 48"><path d="M12 25l9 9 16-18"/></svg></div>
    <h1>Thank you!</h1>
    <p class="muted">Payment received. We are getting your print started.</p>
  <?php else: ?>
    <h1>Order received</h1>
    <p class="muted">Your order is saved. <?= stripe_enabled() ? 'Complete payment below to start the print.' : 'We will be in touch about payment.' ?></p>
  <?php endif; ?>
  <p><strong>Reference:</strong> <?= e($order['reference']) ?></p>
  <p><span class="pill"><?= e($order['status']) ?></span><span class="pill"><?= e($order['payment_status']) ?></span></p>
  <?php if (!$paid && stripe_enabled()): ?>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="pay">
      <button class="btn hover-sheen" type="submit">Pay now</button>
    </form>
  <?php endif; ?>
</div>

<div class="card" style="margin-top:20px">
  <h2>Items</h2>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
    <tbody>
    <?php foreach ($items as $it): ?>
      <tr><td><?= e($it['name']) ?></td><td><?= (int)$it['qty'] ?></td><td><?= money((int)$it['unit_price_cents'] * (int)$it['qty']) ?></td></tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  </div>
  <p>Shipping (<?= e($order['shipping_method']) ?>) <span style="float:right"><?= money((int)$order['shipping_cents']) ?></span></p>
  <p class="price">Total <span style="float:right"><?= money((int)$order['total_cents']) ?></span></p>
</div>

<div class="card" style="margin-top:20px">
  <h2>Delivery to</h2>
  <p class="muted">
    <?= e($order['full_name']) ?><br>
    <?= e($order['address1']) ?><?= $order['address2'] ? '<br>' . e($order['address2']) : '' ?><br>
    <?= e($order['city']) ?> <?= e($order['state']) ?> <?= e($order['postcode']) ?><br>
    <?= e($order['country']) ?>
  </p>
  <?php if ($order['tracking']): ?><p>Tracking: <strong><?= e($order['tracking']) ?></strong></p><?php endif; ?>
</div>

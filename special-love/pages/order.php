<?php
$ref = (string)($_GET['ref'] ?? '');
$order = $ref !== '' ? one('SELECT * FROM orders WHERE reference = ?', [$ref]) : null;

// Coming back from Stripe: ask Stripe directly so the order is confirmed even before the webhook arrives.
if ($order && $order['payment_status'] === 'pending' && !empty($order['stripe_session_id'])) {
    $session = stripe_request('GET', 'checkout/sessions/' . rawurlencode($order['stripe_session_id']));
    if (($session['payment_status'] ?? '') === 'paid') {
        stripe_mark_paid($order, $session);
        $order = one('SELECT * FROM orders WHERE id = ?', [$order['id']]);
    }
}

$paid = $order && in_array($order['payment_status'], ['paid', 'refunded'], true);
// Just paid, payment still being confirmed by Stripe.
$confirming = $order && !$paid && $order['payment_status'] === 'pending' && !empty($_GET['paid'])
    && $ref === ($_SESSION['pending_order'] ?? null);

if (!$paid && !$confirming) {
    // Unpaid orders don't count as orders.
    http_response_code(404);
    echo '<h1>Order not found</h1><p class="muted">Check the link in your confirmation email.</p>';
    return;
}
if ($ref === ($_SESSION['pending_order'] ?? null)) {
    $_SESSION['cart'] = [];
    if ($paid) unset($_SESSION['pending_order']);
}
$GLOBALS['page_title'] = 'Order ' . $order['reference'] . ' - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Order status and details for ' . $order['reference'] . '.';

$items = all('SELECT * FROM order_items WHERE order_id = ?', [$order['id']]);
?>
<div class="card anim-pop" style="text-align:center">
  <?php if ($paid): ?>
    <div class="success-ring"><svg viewBox="0 0 48 48"><path d="M12 25l9 9 16-18"/></svg></div>
    <h1>Thank you!</h1>
    <p class="muted">Payment received. We are getting your print started.</p>
  <?php else: ?>
    <h1>Confirming your payment…</h1>
    <p class="muted">Stripe is confirming your payment. This usually takes a few seconds — refresh this page in a moment.</p>
  <?php endif; ?>
  <p><strong>Reference:</strong> <?= e($order['reference']) ?></p>
  <p><span class="pill"><?= e($order['status']) ?></span><span class="pill"><?= e($order['payment_status']) ?></span></p>
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
  <?php if ((int)($order['discount_cents'] ?? 0) > 0): ?><p>Discount<?= $order['discount_code'] ? ' (' . e($order['discount_code']) . ')' : '' ?> <span style="float:right">&minus;<?= money((int)$order['discount_cents']) ?></span></p><?php endif; ?>
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

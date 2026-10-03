<?php
$GLOBALS['page_title'] = 'Your cart - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Review the 3D prints in your cart before checkout.';

// Back from Stripe without paying: the order is thrown away, the cart stays.
$cancelRef = (string)($_GET['cancel'] ?? '');
if ($cancelRef !== '' && $cancelRef === ($_SESSION['pending_order'] ?? null)) {
    unset($_SESSION['pending_order']);
    $pending = one('SELECT * FROM orders WHERE reference = ?', [$cancelRef]);
    if ($pending && discard_unpaid_order($pending)) {
        flash('Payment cancelled. No order was placed; your cart is still here.', 'warn');
    }
    redirect('?p=cart');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    if ($action === 'update') {
        $cart = [];
        foreach ((array)($_POST['qty'] ?? []) as $id => $qty) {
            $qty = (int)$qty;
            if ($qty > 0) $cart[(int)$id] = ['qty' => min(99, $qty)];
        }
        $_SESSION['cart'] = $cart;
        flash('Cart updated.');
    } elseif ($action === 'remove') {
        $cart = cart();
        unset($cart[(int)($_POST['id'] ?? 0)]);
        $_SESSION['cart'] = $cart;
        flash('Item removed.');
    } elseif ($action === 'clear') {
        $_SESSION['cart'] = [];
        flash('Cart emptied.');
    }
    redirect('?p=cart');
}

$lines = cart_lines();
$subtotal = array_sum(array_column($lines, 'subtotal'));
?>
<h1>Your cart</h1>
<?php if (!$lines): ?>
  <div class="card"><p class="muted">Your cart is empty.</p><a class="btn" href="<?= e(url('?p=shop')) ?>">Browse the shop</a></div>
<?php else: ?>
<form method="post" class="card">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="update">
  <div class="table-scroll">
  <table>
    <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($lines as $l): $p = $l['product']; ?>
      <tr>
        <td><a href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>"><?= e($p['name']) ?></a></td>
        <td><?= money((int)$p['price_cents']) ?></td>
        <td style="max-width:110px"><input type="number" name="qty[<?= (int)$p['id'] ?>]" value="<?= (int)$l['qty'] ?>" min="1" max="99"></td>
        <td><?= money((int)$l['subtotal']) ?></td>
        <td><button class="btn ghost small" type="submit" form="rm<?= (int)$p['id'] ?>">Remove</button></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  </div>
  <p class="price" style="text-align:right">Subtotal: <?= money($subtotal) ?></p>
  <button class="btn ghost" type="submit">Update cart</button>
  <a class="btn hover-sheen" href="<?= e(url('?p=checkout')) ?>">Checkout</a>
</form>
<?php foreach ($lines as $l): ?>
  <form id="rm<?= (int)$l['product']['id'] ?>" method="post" style="display:none">
    <?= csrf_field() ?><input type="hidden" name="action" value="remove">
    <input type="hidden" name="id" value="<?= (int)$l['product']['id'] ?>">
  </form>
<?php endforeach; ?>
<?php endif; ?>

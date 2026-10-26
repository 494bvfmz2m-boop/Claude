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
    $key = (string)($_POST['key'] ?? '');
    $cart = cart();
    $saved = normalise_cart($_SESSION['saved'] ?? []);
    if ($action === 'update') {
        foreach ((array)($_POST['qty'] ?? []) as $k => $qty) {
            if (!isset($cart[$k])) continue;
            $qty = (int)$qty;
            if ($qty > 0) $cart[$k]['qty'] = min(99, $qty); else unset($cart[$k]);
        }
        $_SESSION['cart'] = $cart;
        flash('Cart updated.');
    } elseif ($action === 'remove') {
        unset($cart[$key]);
        $_SESSION['cart'] = $cart;
        flash('Item removed.');
    } elseif ($action === 'save_later' && isset($cart[$key])) {
        // Keep it, but leave it out of this order.
        $l = $cart[$key];
        $_SESSION['saved'] = cart_put($saved, $l['id'], $l['qty'], $l['colour'], $l['size']);
        unset($cart[$key]);
        $_SESSION['cart'] = $cart;
        flash('Saved for later. It won\'t be included when you check out.');
    } elseif ($action === 'move_to_cart' && isset($saved[$key])) {
        $l = $saved[$key];
        $_SESSION['cart'] = cart_put($cart, $l['id'], $l['qty'], $l['colour'], $l['size']);
        unset($saved[$key]);
        $_SESSION['saved'] = $saved;
        flash('Moved back to your cart.');
    } elseif ($action === 'remove_saved') {
        unset($saved[$key]);
        $_SESSION['saved'] = $saved;
        flash('Item removed.');
    } elseif ($action === 'clear') {
        $_SESSION['cart'] = [];
        flash('Cart emptied.');
    }
    redirect('?p=cart');
}

$lines = cart_lines();
$savedLines = cart_lines($_SESSION['saved'] ?? []);
$subtotal = array_sum(array_column($lines, 'subtotal'));
?>
<h1>Your cart</h1>
<?php if (!$lines): ?>
  <div class="card"><p class="muted">Your cart is empty<?= $savedLines ? ' (your saved items are below)' : '' ?>.</p><a class="btn" href="<?= e(url('?p=shop')) ?>">Browse the shop</a></div>
<?php else: ?>
<form method="post" class="card">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="update">
  <div class="table-scroll">
  <table class="cart-table">
    <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($lines as $l): $p = $l['product']; ?>
      <tr>
        <td><a href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>"><?= e($p['name']) ?></a><?php if ($l['options'] !== ''): ?><br><span class="small muted"><?= e($l['options']) ?></span><?php endif; ?></td>
        <td><?= money((int)$l['unit']) ?></td>
        <td class="cart-qty" style="max-width:110px"><input type="number" name="qty[<?= e($l['key']) ?>]" value="<?= (int)$l['qty'] ?>" min="1" max="99"></td>
        <td><?= money((int)$l['subtotal']) ?></td>
        <td class="cart-actions" style="white-space:nowrap"><button class="btn ghost small" type="submit" form="sv<?= md5($l['key']) ?>" title="Keep it, but don't buy it in this order">Save for later</button> <button class="btn ghost small" type="submit" form="rm<?= md5($l['key']) ?>">Remove</button></td>
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
  <form id="rm<?= md5($l['key']) ?>" method="post" style="display:none">
    <?= csrf_field() ?><input type="hidden" name="action" value="remove">
    <input type="hidden" name="key" value="<?= e($l['key']) ?>">
  </form>
  <form id="sv<?= md5($l['key']) ?>" method="post" style="display:none">
    <?= csrf_field() ?><input type="hidden" name="action" value="save_later">
    <input type="hidden" name="key" value="<?= e($l['key']) ?>">
  </form>
<?php endforeach; ?>
<?php endif; ?>

<?php if ($savedLines): ?>
<div class="card" style="margin-top:20px">
  <h2>Saved for later</h2>
  <p class="small muted">These stay here but aren't part of your order.</p>
  <div class="table-scroll"><table>
    <tbody>
    <?php foreach ($savedLines as $l): $p = $l['product']; ?>
      <tr>
        <td><a href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>"><?= e($p['name']) ?></a><?php if ($l['options'] !== ''): ?><br><span class="small muted"><?= e($l['options']) ?></span><?php endif; ?></td>
        <td><?= money((int)$l['unit']) ?> &times; <?= (int)$l['qty'] ?></td>
        <td style="white-space:nowrap;text-align:right">
          <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="move_to_cart"><input type="hidden" name="key" value="<?= e($l['key']) ?>"><button class="btn small" type="submit">Move to cart</button></form>
          <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="remove_saved"><input type="hidden" name="key" value="<?= e($l['key']) ?>"><button class="btn ghost small" type="submit">Remove</button></form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>
<?php endif; ?>

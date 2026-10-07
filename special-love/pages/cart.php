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
    } elseif ($action === 'save_later') {
        // Keep it, but leave it out of this order.
        $id = (int)($_POST['id'] ?? 0);
        $cart = cart();
        if (isset($cart[$id])) {
            $saved = $_SESSION['saved'] ?? [];
            $saved[$id] = ['qty' => (int)$cart[$id]['qty']];
            $_SESSION['saved'] = $saved;
            unset($cart[$id]);
            $_SESSION['cart'] = $cart;
            flash('Saved for later. It won\'t be included when you check out.');
        }
    } elseif ($action === 'move_to_cart') {
        $id = (int)($_POST['id'] ?? 0);
        $saved = $_SESSION['saved'] ?? [];
        if (isset($saved[$id])) {
            $cart = cart();
            $cart[$id] = ['qty' => min(99, (int)($cart[$id]['qty'] ?? 0) + (int)$saved[$id]['qty'])];
            $_SESSION['cart'] = $cart;
            unset($saved[$id]);
            $_SESSION['saved'] = $saved;
            flash('Moved back to your cart.');
        }
    } elseif ($action === 'remove_saved') {
        $saved = $_SESSION['saved'] ?? [];
        unset($saved[(int)($_POST['id'] ?? 0)]);
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
        <td><a href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>"><?= e($p['name']) ?></a></td>
        <td><?= money((int)$p['price_cents']) ?></td>
        <td class="cart-qty" style="max-width:110px"><input type="number" name="qty[<?= (int)$p['id'] ?>]" value="<?= (int)$l['qty'] ?>" min="1" max="99"></td>
        <td><?= money((int)$l['subtotal']) ?></td>
        <td class="cart-actions" style="white-space:nowrap"><button class="btn ghost small" type="submit" form="sv<?= (int)$p['id'] ?>" title="Keep it, but don't buy it in this order">Save for later</button> <button class="btn ghost small" type="submit" form="rm<?= (int)$p['id'] ?>">Remove</button></td>
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
  <form id="sv<?= (int)$l['product']['id'] ?>" method="post" style="display:none">
    <?= csrf_field() ?><input type="hidden" name="action" value="save_later">
    <input type="hidden" name="id" value="<?= (int)$l['product']['id'] ?>">
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
        <td><a href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>"><?= e($p['name']) ?></a></td>
        <td><?= money((int)$p['price_cents']) ?> &times; <?= (int)$l['qty'] ?></td>
        <td style="white-space:nowrap;text-align:right">
          <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="move_to_cart"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><button class="btn small" type="submit">Move to cart</button></form>
          <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="remove_saved"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><button class="btn ghost small" type="submit">Remove</button></form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>
<?php endif; ?>

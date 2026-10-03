<?php
$GLOBALS['page_title'] = 'Checkout - ' . setting('store_name', 'Special Love');
$GLOBALS['page_desc'] = 'Secure checkout for your 3D printed order.';

$lines = cart_lines();
if (!$lines) {
    echo '<h1>Checkout</h1><div class="card"><p class="muted">Your cart is empty.</p><a class="btn" href="' . e(url('?p=shop')) . '">Browse the shop</a></div>';
    return;
}

if (!stripe_enabled()) {
    echo '<h1>Checkout</h1><div class="card"><p class="muted">Online payment isn\'t available right now, so orders can\'t be placed. Please try again later or <a href="' . e(url('?p=support')) . '">contact us</a>.</p><a class="btn" href="' . e(url('?p=cart')) . '">Back to cart</a></div>';
    return;
}

$user = current_user();
$errors = [];
$method = $_POST['shipping_method'] ?? 'standard';
if (!in_array($method, ['standard', 'express'], true)) $method = 'standard';

$subtotal = array_sum(array_column($lines, 'subtotal'));
$ship = shipping_cents($subtotal, $method);
$total = $subtotal + $ship;
$gst = gst_cents($total);

// Changing the shipping option only recalculates the totals; it must not place the order.
$placeOrder = $_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST['recalc']);
if ($_SERVER['REQUEST_METHOD'] === 'POST') csrf_check();

if ($placeOrder) {
    $f = [
        'full_name' => trim((string)($_POST['full_name'] ?? '')),
        'email'     => trim((string)($_POST['email'] ?? '')),
        'phone'     => trim((string)($_POST['phone'] ?? '')),
        'address1'  => trim((string)($_POST['address1'] ?? '')),
        'address2'  => trim((string)($_POST['address2'] ?? '')),
        'city'      => trim((string)($_POST['city'] ?? '')),
        'state'     => trim((string)($_POST['state'] ?? '')),
        'postcode'  => trim((string)($_POST['postcode'] ?? '')),
        'country'   => trim((string)($_POST['country'] ?? 'Australia')),
        'notes'     => trim((string)($_POST['notes'] ?? '')),
    ];
    if ($f['full_name'] === '') $errors[] = 'Please enter your name.';
    if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
    if ($f['address1'] === '' || $f['city'] === '' || $f['postcode'] === '') $errors[] = 'Please complete your delivery address.';

    if (!$errors) {
        // Totals are recalculated here from the database - never trusted from the form.
        // The order is held as 'pending' and only shows up in Admin once Stripe confirms payment;
        // unpaid ones are deleted (cancel, expiry or clean-up).
        $ref = order_ref();
        q('INSERT INTO orders (reference, user_id, email, full_name, phone, address1, address2, city, state, postcode, country, notes,
            shipping_method, subtotal_cents, shipping_cents, gst_cents, total_cents)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $ref, $user['id'] ?? null, $f['email'], $f['full_name'], $f['phone'], $f['address1'], $f['address2'],
            $f['city'], $f['state'], $f['postcode'], $f['country'], $f['notes'],
            $method, $subtotal, $ship, $gst, $total,
        ]);
        $orderId = (int)db()->lastInsertId();
        foreach ($lines as $l) {
            q('INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty) VALUES (?,?,?,?,?)', [
                $orderId, (int)$l['product']['id'], $l['product']['name'], (int)$l['product']['price_cents'], (int)$l['qty'],
            ]);
        }
        // The cart is kept until payment goes through, so a cancelled payment loses nothing.
        $order = one('SELECT * FROM orders WHERE id = ?', [$orderId]);
        $items = all('SELECT * FROM order_items WHERE order_id = ?', [$orderId]);
        [$payUrl, $err] = stripe_checkout_session($order, $items);
        if ($payUrl) {
            $_SESSION['pending_order'] = $ref;
            redirect($payUrl);
        }
        delete_order($orderId);
        $errors[] = 'The payment page could not be opened, so no order was placed: ' . $err;
    }
}
?>
<h1>Checkout</h1>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<form method="post" class="grid cols-2" style="align-items:start">
  <?= csrf_field() ?><input type="hidden" name="recalc" value="">
  <div class="card">
    <h2>Delivery details</h2>
    <label>Full name <input name="full_name" required value="<?= e($_POST['full_name'] ?? ($user['full_name'] ?? '')) ?>"></label>
    <label>Email <input type="email" name="email" required value="<?= e($_POST['email'] ?? ($user['email'] ?? '')) ?>"></label>
    <label>Phone <input name="phone" value="<?= e($_POST['phone'] ?? '') ?>"></label>
    <label>Address <input name="address1" required value="<?= e($_POST['address1'] ?? '') ?>"></label>
    <label>Apartment / unit (optional) <input name="address2" value="<?= e($_POST['address2'] ?? '') ?>"></label>
    <div class="row">
      <label>City / suburb <input name="city" required value="<?= e($_POST['city'] ?? '') ?>"></label>
      <label>State / region <input name="state" value="<?= e($_POST['state'] ?? '') ?>"></label>
      <label>Postcode <input name="postcode" required value="<?= e($_POST['postcode'] ?? '') ?>"></label>
      <label>Country <input name="country" value="<?= e($_POST['country'] ?? 'Australia') ?>"></label>
    </div>
    <label>Order notes <textarea name="notes"><?= e($_POST['notes'] ?? '') ?></textarea></label>
  </div>

  <div class="card">
    <h2>Your order</h2>
    <div class="table-scroll">
    <table>
      <tbody>
      <?php foreach ($lines as $l): ?>
        <tr><td><?= e($l['product']['name']) ?> &times; <?= (int)$l['qty'] ?></td><td style="text-align:right"><?= money((int)$l['subtotal']) ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <label style="margin-top:14px">Shipping
      <select name="shipping_method" onchange="this.form.recalc.value='1'; this.form.submit()">
        <option value="standard" <?= $method === 'standard' ? 'selected' : '' ?>>Standard - <?= money(shipping_cents($subtotal, 'standard')) ?></option>
        <option value="express" <?= $method === 'express' ? 'selected' : '' ?>>Express - <?= money(shipping_cents($subtotal, 'express')) ?></option>
      </select>
    </label>
    <p>Subtotal <span style="float:right"><?= money($subtotal) ?></span></p>
    <p>Shipping <span style="float:right"><?= money($ship) ?></span></p>
    <p class="muted small">Includes GST <span style="float:right"><?= money($gst) ?></span></p>
    <p class="price" style="font-size:1.3rem">Total <span style="float:right"><?= money($total) ?></span></p>
    <button class="btn hover-sheen" type="submit" style="width:100%">
      Pay now
    </button>
    <p class="small muted" style="margin-top:10px">
      You will be taken to Stripe's secure payment page. Your order is only placed once payment goes through.
    </p>
  </div>
</form>

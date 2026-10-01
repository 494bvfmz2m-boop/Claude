<?php
$GLOBALS['page_title'] = 'Afrekenen - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Veilig afrekenen voor je 3D-print.';

$lines = cart_lines();
if (!$lines) {
    echo '<h1>Afrekenen</h1><div class="card"><p class="muted">Je winkelwagen is leeg.</p><a class="btn" href="' . e(url('?p=shop')) . '">Naar de shop</a></div>';
    return;
}

$user = current_user();
$errors = [];
$method = $_POST['shipping_method'] ?? 'standard';
if (!in_array($method, ['standard', 'pickup'], true)) $method = 'standard';

$subtotal = array_sum(array_column($lines, 'subtotal'));
$ship = shipping_cents($subtotal, $method);
$total = $subtotal + $ship;
$btw = btw_cents($total);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $f = [
        'full_name' => trim((string)($_POST['full_name'] ?? '')),
        'email'     => trim((string)($_POST['email'] ?? '')),
        'phone'     => trim((string)($_POST['phone'] ?? '')),
        'address1'  => trim((string)($_POST['address1'] ?? '')),
        'address2'  => trim((string)($_POST['address2'] ?? '')),
        'city'      => trim((string)($_POST['city'] ?? '')),
        'state'     => trim((string)($_POST['state'] ?? '')),
        'postcode'  => trim((string)($_POST['postcode'] ?? '')),
        'country'   => trim((string)($_POST['country'] ?? 'Nederland')),
        'notes'     => trim((string)($_POST['notes'] ?? '')),
    ];
    if ($f['full_name'] === '') $errors[] = 'Vul je naam in.';
    if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Vul een geldig e-mailadres in.';
    if ($f['address1'] === '' || $f['city'] === '' || $f['postcode'] === '') $errors[] = 'Vul je bezorgadres volledig in.';

    if (!$errors) {
        // Totals are recalculated here from the database - never trusted from the form.
        $ref = order_ref();
        q('INSERT INTO orders (reference, user_id, email, full_name, phone, address1, address2, city, state, postcode, country, notes,
            shipping_method, subtotal_cents, shipping_cents, gst_cents, total_cents)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $ref, $user['id'] ?? null, $f['email'], $f['full_name'], $f['phone'], $f['address1'], $f['address2'],
            $f['city'], $f['state'], $f['postcode'], $f['country'], $f['notes'],
            $method, $subtotal, $ship, $btw, $total,
        ]);
        $orderId = (int)db()->lastInsertId();
        foreach ($lines as $l) {
            q('INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty) VALUES (?,?,?,?,?)', [
                $orderId, (int)$l['product']['id'], $l['product']['name'], (int)$l['product']['price_cents'], (int)$l['qty'],
            ]);
        }
        $_SESSION['cart'] = [];

        if (stripe_enabled()) {
            $order = one('SELECT * FROM orders WHERE id = ?', [$orderId]);
            $items = all('SELECT * FROM order_items WHERE order_id = ?', [$orderId]);
            [$payUrl, $err] = stripe_checkout_session($order, $items);
            if ($payUrl) redirect($payUrl);
            flash('Bestelling opgeslagen, maar de betaalpagina kon niet worden geopend: ' . $err, 'warn');
        }
        redirect('?p=order&ref=' . urlencode($ref));
    }
}
?>
<h1>Afrekenen</h1>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<form method="post" class="grid cols-2" style="align-items:start">
  <?= csrf_field() ?>
  <div class="card">
    <h2>Bezorggegevens</h2>
    <label>Naam <input name="full_name" required value="<?= e($_POST['full_name'] ?? ($user['full_name'] ?? '')) ?>"></label>
    <label>E-mail <input type="email" name="email" required value="<?= e($_POST['email'] ?? ($user['email'] ?? '')) ?>"></label>
    <label>Telefoon <input name="phone" value="<?= e($_POST['phone'] ?? '') ?>"></label>
    <label>Straat en huisnummer <input name="address1" required value="<?= e($_POST['address1'] ?? '') ?>"></label>
    <label>Toevoeging (optioneel) <input name="address2" value="<?= e($_POST['address2'] ?? '') ?>"></label>
    <div class="row">
      <label>Plaats <input name="city" required value="<?= e($_POST['city'] ?? '') ?>"></label>
      <label>Postcode <input name="postcode" required value="<?= e($_POST['postcode'] ?? '') ?>"></label>
      <label>Land <input name="country" value="<?= e($_POST['country'] ?? 'Nederland') ?>"></label>
    </div>
    <label>Opmerkingen <textarea name="notes"><?= e($_POST['notes'] ?? '') ?></textarea></label>
  </div>

  <div class="card">
    <h2>Je bestelling</h2>
    <div class="table-scroll">
    <table>
      <tbody>
      <?php foreach ($lines as $l): ?>
        <tr><td><?= e($l['product']['name']) ?> &times; <?= (int)$l['qty'] ?></td><td style="text-align:right"><?= money((int)$l['subtotal']) ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <label style="margin-top:14px">Verzending
      <select name="shipping_method" onchange="this.form.submit()">
        <option value="standard" <?= $method === 'standard' ? 'selected' : '' ?>>Standaard (PostNL) - <?= money(shipping_cents($subtotal, 'standard')) ?></option>
        <option value="pickup" <?= $method === 'pickup' ? 'selected' : '' ?>>Ophalen in Maarn - gratis</option>
      </select>
    </label>
    <p>Subtotaal <span style="float:right"><?= money($subtotal) ?></span></p>
    <p>Verzending <span style="float:right"><?= money($ship) ?></span></p>
    <?php if ($btw > 0): ?><p class="muted small">Waarvan btw <span style="float:right"><?= money($btw) ?></span></p><?php endif; ?>
    <p class="price" style="font-size:1.3rem">Totaal <span style="float:right"><?= money($total) ?></span></p>
    <button class="btn hover-sheen" type="submit" style="width:100%">
      <?= stripe_enabled() ? 'Betalen' : 'Bestelling plaatsen' ?>
    </button>
    <p class="small muted" style="margin-top:10px">
      <?= stripe_enabled()
        ? 'Je gaat naar de beveiligde betaalpagina van Stripe (iDEAL, kaart en meer).'
        : 'Online betalen staat nog niet aan. Je krijgt de betaalgegevens per e-mail.' ?>
    </p>
  </div>
</form>

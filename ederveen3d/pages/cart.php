<?php
$GLOBALS['page_title'] = 'Winkelwagen - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = 'Bekijk de 3D-prints in je winkelwagen voordat je afrekent.';

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
        flash('Winkelwagen bijgewerkt.');
    } elseif ($action === 'remove') {
        $cart = cart();
        unset($cart[(int)($_POST['id'] ?? 0)]);
        $_SESSION['cart'] = $cart;
        flash('Product verwijderd.');
    } elseif ($action === 'clear') {
        $_SESSION['cart'] = [];
        flash('Winkelwagen geleegd.');
    }
    redirect('?p=cart');
}

$lines = cart_lines();
$subtotal = array_sum(array_column($lines, 'subtotal'));
?>
<h1>Winkelwagen</h1>
<?php if (!$lines): ?>
  <div class="card"><p class="muted">Je winkelwagen is leeg.</p><a class="btn" href="<?= e(url('?p=shop')) ?>">Naar de shop</a></div>
<?php else: ?>
<form method="post" class="card">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="update">
  <div class="table-scroll">
  <table>
    <thead><tr><th>Product</th><th>Prijs</th><th>Aantal</th><th>Subtotaal</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($lines as $l): $p = $l['product']; ?>
      <tr>
        <td><a href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>"><?= e($p['name']) ?></a></td>
        <td><?= money((int)$p['price_cents']) ?></td>
        <td style="max-width:110px"><input type="number" name="qty[<?= (int)$p['id'] ?>]" value="<?= (int)$l['qty'] ?>" min="1" max="99"></td>
        <td><?= money((int)$l['subtotal']) ?></td>
        <td><button class="btn ghost small" type="submit" form="rm<?= (int)$p['id'] ?>">Verwijderen</button></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  </div>
  <p class="price" style="text-align:right">Subtotaal: <?= money($subtotal) ?></p>
  <button class="btn ghost" type="submit">Bijwerken</button>
  <a class="btn hover-sheen" href="<?= e(url('?p=checkout')) ?>">Afrekenen</a>
</form>
<?php foreach ($lines as $l): ?>
  <form id="rm<?= (int)$l['product']['id'] ?>" method="post" style="display:none">
    <?= csrf_field() ?><input type="hidden" name="action" value="remove">
    <input type="hidden" name="id" value="<?= (int)$l['product']['id'] ?>">
  </form>
<?php endforeach; ?>
<?php endif; ?>

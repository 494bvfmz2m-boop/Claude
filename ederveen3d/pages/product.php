<?php
$slug = (string)($_GET['slug'] ?? '');
$product = one('SELECT * FROM products WHERE slug = ? AND visible = 1', [$slug]);
$showcase = showcase_mode();
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $product && !$showcase) { csrf_check(); $qty = max(1, min(99, (int)($_POST['qty'] ?? 1))); $id = (int)$product['id']; $cart = cart(); $cart[$id] = ['qty' => (int)($cart[$id]['qty'] ?? 0) + $qty]; $_SESSION['cart'] = $cart; flash($product['name'] . ' staat in je winkelwagen.'); redirect('?p=cart'); }
if (!$product) { http_response_code(404); echo '<h1>Product niet gevonden</h1><p><a class="btn" href="' . e(url('?p=shop')) . '">Terug naar het overzicht</a></p>'; return; }
$GLOBALS['page_title'] = $product['name'] . ' - ' . setting('store_name', 'Ederveen3D');
$GLOBALS['page_desc'] = mb_substr(strip_tags((string)$product['description']) ?: $product['name'], 0, 155);
$colours = array_values(array_filter(array_map('trim', explode(',', (string)$product['colours']))));
$mpUrl = trim((string)($product['marktplaats_url'] ?? ''));
?>
<a class="back-link" href="<?= e(url('?p=shop')) ?>">← Terug naar het overzicht</a>
<div class="grid cols-2 product-view">
  <div class="product-photo hover-sheen"><img src="<?= e(url($product['image'] ?: 'assets/hero.jpg')) ?>" alt="<?= e($product['name']) ?>"></div>
  <div><?php if ($product['promo_badge']): ?><span class="pill promo"><?= e($product['promo_badge']) ?></span><?php endif; ?><h1><?= e($product['name']) ?></h1><p class="price product-price"><?= money((int)$product['price_cents']) ?></p><p class="muted"><?= nl2br(e($product['description'])) ?></p>
    <?php if ($showcase): ?>
      <div class="buy-panel">
        <?php if ($mpUrl !== ''): ?>
          <a class="btn hover-sheen" href="<?= e($mpUrl) ?>" target="_blank" rel="noopener">Bekijk op Marktplaats ↗</a>
        <?php else: ?>
          <a class="btn hover-sheen" href="<?= e(url('?p=custom&about=' . urlencode($product['name']))) ?>">Stuur me een bericht</a>
        <?php endif; ?>
      </div>
      <?php if ($colours): ?><p class="small muted">Beschikbare kleuren: <?= e(implode(', ', $colours)) ?></p><?php endif; ?>
    <?php else: ?>
      <form method="post" class="buy-panel"><?= csrf_field() ?><?php if ($colours): ?><label>Kleur<select name="colour"><?php foreach ($colours as $colour): ?><option><?= e($colour) ?></option><?php endforeach; ?></select></label><?php endif; ?><label>Aantal <input type="number" name="qty" value="1" min="1" max="99"></label><button class="btn hover-sheen" type="submit">In winkelwagen</button></form>
    <?php endif; ?>
    <div class="product-info"><h2>Productinformatie</h2><dl><div><dt>Categorie</dt><dd><?= e($product['category'] ?: 'Overig') ?></dd></div><div><dt>Materiaal</dt><dd><?= e($product['material'] ?: 'Zie beschrijving') ?></dd></div><?php if ($product['size_text']): ?><div><dt>Afmetingen</dt><dd><?= e($product['size_text']) ?></dd></div><?php endif; ?><?php if (!$showcase): ?><div><dt>Beschikbaarheid</dt><dd><?= (int)$product['stock'] > 0 ? (int)$product['stock'] . ' op voorraad' : 'Wordt voor je geprint' ?></dd></div><?php endif; ?></dl><?php if ($product['product_details']): ?><p class="muted"><?= nl2br(e($product['product_details'])) ?></p><?php endif; ?><h2>Verzending</h2><p class="small muted">📦 Verstuurd binnen Nederland met PostNL, of ophalen in Ederveen.</p></div>
  </div>
</div>

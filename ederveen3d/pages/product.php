<?php
$slug = (string)($_GET['slug'] ?? '');
$product = one('SELECT * FROM products WHERE slug = ? AND visible = 1', [$slug]);
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $product) { csrf_check(); $qty = max(1, min(99, (int)($_POST['qty'] ?? 1))); $id = (int)$product['id']; $cart = cart(); $cart[$id] = ['qty' => (int)($cart[$id]['qty'] ?? 0) + $qty]; $_SESSION['cart'] = $cart; flash($product['name'] . ' added to your cart.'); redirect('?p=cart'); }
if (!$product) { http_response_code(404); echo '<h1>Product not found</h1><p><a class="btn" href="' . e(url('?p=shop')) . '">Back to the shop</a></p>'; return; }
$GLOBALS['page_title'] = $product['name'] . ' - ' . setting('store_name', 'Special Love 3D');
$GLOBALS['page_desc'] = mb_substr(strip_tags((string)$product['description']) ?: $product['name'], 0, 155);
$colours = array_values(array_filter(array_map('trim', explode(',', (string)$product['colours']))));
?>
<a class="back-link" href="<?= e(url('?p=shop')) ?>">← Back to shop</a>
<div class="grid cols-2 product-view">
  <div class="product-photo hover-sheen"><img src="<?= e(url($product['image'] ?: 'assets/hero.jpg')) ?>" alt="<?= e($product['name']) ?>"></div>
  <div><?php if ($product['promo_badge']): ?><span class="pill promo"><?= e($product['promo_badge']) ?></span><?php endif; ?><h1><?= e($product['name']) ?></h1><p class="price product-price"><?= money((int)$product['price_cents']) ?> <small>AUD</small></p><p class="muted"><?= nl2br(e($product['description'])) ?></p>
    <form method="post" class="buy-panel"><?= csrf_field() ?><?php if ($colours): ?><label>Colour<select name="colour"><?php foreach ($colours as $colour): ?><option><?= e($colour) ?></option><?php endforeach; ?></select></label><?php endif; ?><label>Quantity <input type="number" name="qty" value="1" min="1" max="99"></label><button class="btn hover-sheen" type="submit">Add to cart</button></form>
    <div class="gift-note"><b>🎁 Free gift with high priced orders</b><p class="small muted">Gift may vary depending on availability.</p></div>
    <div class="product-info"><h2>Product information</h2><dl><div><dt>Category</dt><dd><?= e($product['category'] ?: 'Other') ?></dd></div><div><dt>Material</dt><dd><?= e($product['material'] ?: 'See description') ?></dd></div><?php if ($product['size_text']): ?><div><dt>Size</dt><dd><?= e($product['size_text']) ?></dd></div><?php endif; ?><div><dt>Availability</dt><dd><?= (int)$product['stock'] > 0 ? (int)$product['stock'] . ' in stock' : 'Made to order' ?></dd></div></dl><?php if ($product['product_details']): ?><p class="muted"><?= nl2br(e($product['product_details'])) ?></p><?php endif; ?><h2>Shipping information</h2><p class="small muted">🌍 We ship worldwide. Fees are calculated at checkout based on location and order. Tracking is available where supported.</p></div>
  </div>
</div>
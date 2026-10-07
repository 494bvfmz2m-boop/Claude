<?php
$slug = (string)($_GET['slug'] ?? '');
$product = one('SELECT * FROM products WHERE slug = ? AND visible = 1', [$slug]);
$reviewErrors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $product) {
    csrf_check();
    if (($_POST['action'] ?? '') === 'review') {
        $reviewErrors = submit_review((int)$product['id']);
        if (!$reviewErrors) redirect('?p=product&slug=' . urlencode($product['slug']) . '#reviews');
    } else {
        $qty = max(1, min(99, (int)($_POST['qty'] ?? 1))); $id = (int)$product['id']; $cart = cart(); $cart[$id] = ['qty' => (int)($cart[$id]['qty'] ?? 0) + $qty]; $_SESSION['cart'] = $cart; flash($product['name'] . ' added to your cart.'); redirect('?p=cart');
    }
}
if (!$product) { http_response_code(404); echo '<h1>Product not found</h1><p><a class="btn" href="' . e(url('?p=shop')) . '">Back to the shop</a></p>'; return; }
$GLOBALS['page_title'] = $product['name'] . ' - ' . setting('store_name', 'Special Love 3D');
$GLOBALS['page_desc'] = mb_substr(strip_tags((string)$product['description']) ?: $product['name'], 0, 155);
$colours = array_values(array_filter(array_map('trim', explode(',', (string)$product['colours']))));
$media = product_media((int)$product['id']);
if (!$media) $media = [['path' => $product['image'] ?: 'assets/hero.jpg', 'kind' => 'image']];
$reviews = all('SELECT * FROM reviews WHERE product_id = ? AND status = "approved" ORDER BY created_at DESC LIMIT 50', [$product['id']]);
?>
<a class="back-link" href="<?= e(url('?p=shop')) ?>">← Back to shop</a>
<div class="grid cols-2 product-view">
  <div class="gallery" data-gallery>
    <div class="product-photo gallery-main">
      <?php foreach ($media as $i => $m): ?>
        <div class="gallery-slide<?= $i === 0 ? ' active' : '' ?>">
          <?php if ($m['kind'] === 'video'): ?>
            <video src="<?= e(url($m['path'])) ?>" controls playsinline preload="metadata"></video>
          <?php else: ?>
            <img src="<?= e(url($m['path'])) ?>" alt="<?= e($product['name']) ?><?= $i ? ' photo ' . ($i + 1) : '' ?>"<?= $i ? ' loading="lazy"' : '' ?>>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
    <?php if (count($media) > 1): ?>
      <div class="gallery-thumbs">
        <?php foreach ($media as $i => $m): ?>
          <button type="button" class="gallery-thumb<?= $i === 0 ? ' active' : '' ?>" aria-label="Show <?= $m['kind'] === 'video' ? 'video' : 'photo' ?> <?= $i + 1 ?>">
            <?php if ($m['kind'] === 'video'): ?><video src="<?= e(url($m['path'])) ?>" muted preload="metadata"></video><span class="play">▶</span>
            <?php else: ?><img src="<?= e(url($m['path'])) ?>" alt="" loading="lazy"><?php endif; ?>
          </button>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
  <div><?php if ($product['promo_badge']): ?><span class="pill promo"><?= e($product['promo_badge']) ?></span><?php endif; ?><h1><?= e($product['name']) ?></h1><p class="price product-price"><?= money((int)$product['price_cents']) ?> <small>AUD</small></p><p class="muted"><?= nl2br(e($product['description'])) ?></p>
    <form method="post" class="buy-panel"><?= csrf_field() ?><?php if ($colours): ?><label>Colour<select name="colour"><?php foreach ($colours as $colour): ?><option><?= e($colour) ?></option><?php endforeach; ?></select></label><?php endif; ?><label>Quantity <input type="number" name="qty" value="1" min="1" max="99"></label><button class="btn hover-sheen" type="submit">Add to cart</button></form>
    <div class="gift-note"><b>🎁 Free gift with every order</b><p class="small muted">Gift may vary depending on availability.</p></div>
    <div class="product-info"><h2>Product information</h2><dl><div><dt>Category</dt><dd><?= e($product['category'] ?: 'Other') ?></dd></div><div><dt>Material</dt><dd><?= e($product['material'] ?: 'See description') ?></dd></div><?php if ($product['size_text']): ?><div><dt>Size</dt><dd><?= e($product['size_text']) ?></dd></div><?php endif; ?><div><dt>Availability</dt><dd><?= (int)$product['stock'] > 0 ? (int)$product['stock'] . ' in stock' : 'Made to order' ?></dd></div></dl><?php if ($product['product_details']): ?><p class="muted"><?= nl2br(e($product['product_details'])) ?></p><?php endif; ?><h2>Shipping information</h2><p class="small muted">🌍 We ship worldwide. Fees are calculated at checkout based on location and order. Tracking is available where supported.</p></div>
  </div>
</div>

<section id="reviews" class="home-section">
  <h2>Reviews<?php if ($reviews): ?> <span class="small muted"><?= stars((int)round(array_sum(array_column($reviews, 'rating')) / count($reviews))) ?> (<?= count($reviews) ?>)</span><?php endif; ?></h2>
  <div class="grid cols-2" style="align-items:start">
    <div>
      <?php if (!$reviews): ?><p class="muted">No reviews yet. Be the first!</p><?php endif; ?>
      <?php foreach ($reviews as $r) include __DIR__ . '/_review.php'; ?>
    </div>
    <?php $reviewProductId = (int)$product['id']; include __DIR__ . '/_review_form.php'; ?>
  </div>
</section>

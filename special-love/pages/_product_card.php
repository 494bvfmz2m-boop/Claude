<a class="card product-card hover-lift hover-sheen" href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>">
  <?php if (!empty($p['promo_badge']) || !empty($p['is_new'])): ?><span class="product-badge"><?= e($p['promo_badge'] ?: 'New') ?></span><?php endif; ?>
  <div class="thumb">
    <?php if (!empty($p['image'])): ?>
      <img src="<?= e(url($p['image'])) ?>" alt="<?= e($p['name']) ?>" loading="lazy">
    <?php else: ?>
      <img src="<?= e(url('assets/hero.jpg')) ?>" alt="" loading="lazy">
    <?php endif; ?>
  </div>
  <h3><?= e($p['name']) ?></h3>
  <p class="muted small"><?= e($p['category'] ?: 'Other') ?><?= !empty($p['is_new']) ? ' · New' : '' ?></p>
  <p class="price"><?= money((int)$p['price_cents']) ?></p>
  <p class="small muted"><?= (int)$p['stock'] > 0 ? 'In stock' : 'Made to order' ?></p>
</a>

<a class="product-card" href="<?= e(url('?p=product&slug=' . urlencode($p['slug']))) ?>">
  <div class="thumb">
    <img src="<?= e(url($p['image'] ?: 'assets/placeholder.svg')) ?>" alt="<?= e($p['name']) ?>" loading="lazy">
    <?php if (!empty($p['promo_badge']) || !empty($p['is_new'])): ?><span class="product-badge"><?= e($p['promo_badge'] ?: 'Nieuw') ?></span><?php endif; ?>
  </div>
  <div class="product-meta">
    <h3><?= e($p['name']) ?></h3>
    <span class="price"><?= money((int)$p['price_cents']) ?></span>
  </div>
  <p class="small muted"><?= e($p['category'] ?: 'Overig') ?><?php if (!showcase_mode()): ?> · <?= (int)$p['stock'] > 0 ? 'Op voorraad' : 'Wordt voor je geprint' ?><?php endif; ?></p>
</a>

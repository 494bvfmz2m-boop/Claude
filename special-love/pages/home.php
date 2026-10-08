<?php
$GLOBALS['page_title'] = setting('store_name', 'Special Love 3D') . ' — Colourful products made with love';
$GLOBALS['page_desc'] = 'Shop fun, unique and colourful products from a small Australian business. Free gift with every order.';
$best = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_best_seller DESC, created_at DESC LIMIT 4');
$new = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_new DESC, created_at DESC LIMIT 4');
$reviewErrors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'review') {
    csrf_check();
    $reviewErrors = submit_review(0);
    if (!$reviewErrors) redirect('?p=home#reviews');
}
$reviews = all('SELECT r.*, p.name AS product_name, p.slug AS product_slug FROM reviews r LEFT JOIN products p ON p.id = r.product_id
                WHERE r.status = "approved" ORDER BY r.created_at DESC LIMIT 6');
$socials = social_links();
$socialIcons = ['Instagram' => '📸', 'Facebook' => '👍', 'TikTok' => '🎵', 'YouTube' => '▶️'];
$categories = ['Dragons' => '🐉', 'Animals' => '🐾', 'Magnets' => '🧲', 'Fidgets' => '🎮', 'Keychains' => '🔑', 'Other' => '✨'];
?>
<section class="home-hero">
  <div class="home-hero-shade"></div>
  <div class="home-hero-copy anim-rise"><span class="kicker">3D printed with love</span><h1>Special Love <em>3D</em></h1><p>Fun, unique and colourful products made with care.</p><strong>🎁 Free gift with every order</strong><br><a class="btn hover-sheen" href="<?= e(url('?p=shop')) ?>">Shop now →</a> <a class="btn ghost" href="<?= e(url('?p=custom')) ?>">Custom Prints</a></div>
</section>

<section id="best-sellers" class="home-section"><div class="section-heading"><div><span class="kicker">Customer favourites</span><h2>Our Best Sellers</h2></div><a href="<?= e(url('?p=shop&collection=best')) ?>">View all →</a></div><div class="grid cols-4"><?php foreach ($best as $p) include __DIR__ . '/_product_card.php'; ?><?php if (!$best): ?><p class="muted">Products will appear here when you add them.</p><?php endif; ?></div></section>

<section id="new-products" class="home-section"><div class="section-heading"><div><span class="kicker">Fresh off the printer</span><h2>New Products</h2></div><a href="<?= e(url('?p=shop&collection=new')) ?>">View all →</a></div><div class="grid cols-4"><?php foreach ($new as $p) include __DIR__ . '/_product_card.php'; ?><?php if (!$new): ?><p class="muted">Products will appear here when you add them.</p><?php endif; ?></div></section>

<section id="categories" class="home-section section-band"><span class="kicker">Find your favourite</span><h2>Shop by category</h2><div class="grid cols-3 category-grid"><?php foreach ($categories as $name => $icon): ?><a class="card hover-lift" href="<?= e(url('?p=shop&cat=' . urlencode($name))) ?>"><b class="category-icon"><?= $icon ?></b><h3><?= e($name) ?></h3><p class="muted">Shop <?= e(strtolower($name)) ?> →</p></a><?php endforeach; ?></div></section>

<section class="home-section split-feature"><div class="gift-art">🎁</div><div><span class="kicker pink">A little extra from us</span><h2>Free gift with every order</h2><p class="lead muted">Every order from Special Love 3D comes with a free gift. It’s our way of saying thank you for supporting our small business.</p><p class="small muted">Free gift may vary depending on availability.</p></div></section>

<section id="about" class="home-section split-feature"><div><span class="kicker">About Special Love 3D</span><h2>Small business. Big personality.</h2><p class="muted">We’re a small Australian business creating fun, unique and colourful products.</p><p class="muted">Every order is made or selected, checked and packed with care, and we’re always looking for new and exciting things to bring to the store.</p><p>Thank you for supporting our small business.</p></div><figure class="photo-feature"><img src="<?= e(url('assets/owners.webp')) ?>" alt="The owners of Special Love 3D in their workshop with their cat, printers and a cauldron full of Halloween prints" loading="lazy" width="1400" height="1050"><figcaption>Meet the owners (and the shop cat)</figcaption></figure></section>

<section id="workshop" class="home-section split-feature split-reverse"><figure class="photo-feature"><img src="<?= e(url('assets/workshop.webp')) ?>" alt="The Special Love 3D workshop with 3D printers, filament and finished prints" loading="lazy" width="1400" height="1050"><figcaption>Where the magic happens</figcaption></figure><div><span class="kicker pink">Inside the workshop</span><h2>Printed right here, with love</h2><p class="muted">This little room is where every Special Love 3D order comes to life. Our printers run day and night, surrounded by filament, finished prints waiting for their new homes, and plenty of inspiration.</p><p class="muted">Every piece is printed, checked and packed by hand in this workshop.</p><a class="btn ghost" href="<?= e(url('?p=custom')) ?>">Have an idea? Request a custom print</a></div></section>

<section class="home-section section-band"><span class="kicker">Why Special Love 3D?</span><div class="grid cols-3 benefit-grid"><div><b>🩷 Australian business</b><p class="muted">Proudly based in Australia.</p></div><div><b>🖨️ 3D printed</b><p class="muted">Made using modern printing technology.</p></div><div><b>📦 Made with care</b><p class="muted">Every order is checked and packed carefully.</p></div><div><b>🎁 Free gift</b><p class="muted">Every order comes with something extra.</p></div><div><b>🎨 Lots of colours</b><p class="muted">Choose from a range on selected products.</p></div><div><b>🌍 Worldwide shipping</b><p class="muted">We ship our products around the world.</p></div></div></section>

<section class="home-section"><div class="card follow-card"><div><span class="kicker pink">Come say hi</span><h2>Follow Special Love 3D</h2><p class="muted">See what we’re making next, behind-the-scenes prints and new drops.</p></div><div class="social-buttons"><?php foreach ($socials as $label => $link): ?><a class="btn ghost hover-pop" href="<?= e($link) ?>" target="_blank" rel="noopener"><?= $socialIcons[$label] ?? '' ?> <?= e($label) ?></a><?php endforeach; ?><?php if (!$socials): ?><p class="small muted"><?= is_staff() ? 'Add your social links in Admin → Store settings.' : 'Our socials are coming soon.' ?></p><?php endif; ?></div></div></section>

<section id="reviews" class="home-section"><div class="section-heading"><div><span class="kicker">Kind words</span><h2>Customer reviews</h2></div></div>
  <div class="grid cols-2" style="align-items:start">
    <div class="review-list">
      <?php if (!$reviews): ?><p class="muted">No reviews yet. Ordered from us? We'd love to hear what you think!</p><?php endif; ?>
      <?php foreach ($reviews as $r): ?>
        <?php include __DIR__ . '/_review.php'; ?>
        <?php if ($r['product_slug']): ?><p class="small" style="margin:-8px 0 14px 4px">on <a href="<?= e(url('?p=product&slug=' . urlencode($r['product_slug']))) ?>"><?= e($r['product_name']) ?></a></p><?php endif; ?>
      <?php endforeach; ?>
    </div>
    <?php $reviewProductId = 0; include __DIR__ . '/_review_form.php'; ?>
  </div>
</section>

<section class="shipping-callout"><div><span class="kicker">Worldwide shipping</span><h2>Carefully packed. Sent worldwide.</h2><p class="muted">Shipping fees are calculated at checkout based on your delivery location and order. Tracking is included where available.</p></div><a class="btn ghost" href="<?= e(url('?p=support')) ?>">Shipping information</a></section>
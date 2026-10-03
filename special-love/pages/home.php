<?php
$GLOBALS['page_title'] = setting('store_name', 'Special Love 3D') . ' — Colourful products made with love';
$GLOBALS['page_desc'] = 'Shop fun, unique and colourful products from a small Australian business. Free gift with high priced orders.';
$best = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_best_seller DESC, created_at DESC LIMIT 4');
$new = all('SELECT * FROM products WHERE visible = 1 ORDER BY is_new DESC, created_at DESC LIMIT 4');
$categories = ['Dragons' => '🐉', 'Animals' => '🐾', 'Magnets' => '🧲', 'Fidgets' => '🎮', 'Keychains' => '🔑', 'Other' => '✨'];
?>
<section class="home-hero">
  <div class="home-hero-shade"></div>
  <div class="home-hero-copy anim-rise"><span class="kicker">3D printed with love</span><h1>Special Love <em>3D</em></h1><p>Fun, unique and colourful products made with care.</p><strong>🎁 Free gift with high priced orders</strong><br><a class="btn hover-sheen" href="<?= e(url('?p=shop')) ?>">Shop now →</a> <a class="btn ghost" href="<?= e(url('?p=custom')) ?>">Custom Prints</a></div>
</section>

<section id="best-sellers" class="home-section"><div class="section-heading"><div><span class="kicker">Customer favourites</span><h2>Our Best Sellers</h2></div><a href="<?= e(url('?p=shop&collection=best')) ?>">View all →</a></div><div class="grid cols-4"><?php foreach ($best as $p) include __DIR__ . '/_product_card.php'; ?><?php if (!$best): ?><p class="muted">Products will appear here when you add them.</p><?php endif; ?></div></section>

<section id="new-products" class="home-section"><div class="section-heading"><div><span class="kicker">Fresh off the printer</span><h2>New Products</h2></div><a href="<?= e(url('?p=shop&collection=new')) ?>">View all →</a></div><div class="grid cols-4"><?php foreach ($new as $p) include __DIR__ . '/_product_card.php'; ?><?php if (!$new): ?><p class="muted">Products will appear here when you add them.</p><?php endif; ?></div></section>

<section id="categories" class="home-section section-band"><span class="kicker">Find your favourite</span><h2>Shop by category</h2><div class="grid cols-3 category-grid"><?php foreach ($categories as $name => $icon): ?><a class="card hover-lift" href="<?= e(url('?p=shop&cat=' . urlencode($name))) ?>"><b class="category-icon"><?= $icon ?></b><h3><?= e($name) ?></h3><p class="muted">Shop <?= e(strtolower($name)) ?> →</p></a><?php endforeach; ?></div></section>

<section class="home-section split-feature"><div class="gift-art">🎁</div><div><span class="kicker pink">A little extra from us</span><h2>Free gift with high priced orders</h2><p class="lead muted">High priced orders from Special Love 3D come with a free gift. It’s our way of saying thank you for supporting our small business.</p><p class="small muted">Free gift may vary depending on availability.</p></div></section>

<section id="about" class="home-section split-feature"><div><span class="kicker">About Special Love 3D</span><h2>Small business. Big personality.</h2><p class="muted">We’re a small Australian business creating fun, unique and colourful products.</p><p class="muted">Every order is made or selected, checked and packed with care, and we’re always looking for new and exciting things to bring to the store.</p><p>Thank you for supporting our small business.</p></div><div class="workshop-art">🖨️<span>Workshop photos coming soon</span></div></section>

<section class="home-section section-band"><span class="kicker">Why Special Love 3D?</span><div class="grid cols-3 benefit-grid"><div><b>🩷 Australian business</b><p class="muted">Proudly based in Australia.</p></div><div><b>🖨️ 3D printed</b><p class="muted">Made using modern printing technology.</p></div><div><b>📦 Made with care</b><p class="muted">Every order is checked and packed carefully.</p></div><div><b>🎁 Free gift</b><p class="muted">High priced orders come with something extra.</p></div><div><b>🎨 Lots of colours</b><p class="muted">Choose from a range on selected products.</p></div><div><b>🌍 Worldwide shipping</b><p class="muted">We ship our products around the world.</p></div></div></section>

<section class="home-section social-grid"><div class="card"><h2>Follow Special Love 3D</h2><p class="muted">See what we’re making next. Social links and real product posts will appear here once connected.</p></div><div class="card"><h2>Customer reviews</h2><p class="muted">Verified customer reviews will appear here after orders begin arriving.</p></div></section>

<section class="shipping-callout"><div><span class="kicker">Worldwide shipping</span><h2>Carefully packed. Sent worldwide.</h2><p class="muted">Shipping fees are calculated at checkout based on your delivery location and order. Tracking is included where available.</p></div><a class="btn ghost" href="<?= e(url('?p=support')) ?>">Shipping information</a></section>
<?php
function render_page(string $path): void {
    ob_start();
    require $path;
    $content = ob_get_clean();
    $title = $GLOBALS['page_title'] ?? setting('store_name', 'Special Love 3D Print Shop');
    $desc  = $GLOBALS['page_desc'] ?? setting('tagline', 'Small-batch 3D printing made with love.');
    ?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="<?= e(url('assets/logo.png')) ?>">
<link rel="stylesheet" href="<?= e(url('assets/style.css')) ?>">
</head>
<body>
<?php if (setting('promo_bar_enabled', '1') === '1'): ?><div class="announcement"><?= e(setting('promo_bar_text', 'Free gift with high priced orders')) ?></div><?php endif; ?>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand hover-lift" href="<?= e(url('?p=home')) ?>">
      <img src="<?= e(url('assets/logo.png')) ?>" alt="">
      <span><?= e(setting('store_name', 'Special Love')) ?></span>
    </a>
    <nav class="nav">
      <a href="<?= e(url('?p=home')) ?>">Home</a>
      <a href="<?= e(url('?p=shop')) ?>">Shop</a><a href="<?= e(url('?p=home#categories')) ?>">Categories</a><a href="<?= e(url('?p=shop&collection=best')) ?>">Best Sellers</a><a href="<?= e(url('?p=shop&collection=new')) ?>">New Products</a><a href="<?= e(url('?p=home#about')) ?>">About Us</a><a href="<?= e(url('?p=support')) ?>">Contact</a>
      <?php if (is_staff()): ?><a class="accent" href="<?= e(url('?p=admin')) ?>">Admin</a><?php endif; ?>
      <?php if (is_logged_in()): ?>
        <a href="<?= e(url('?p=account')) ?>">Account</a>
        <a href="<?= e(url('?p=logout')) ?>">Sign out</a>
      <?php else: ?>
        <a href="<?= e(url('?p=login')) ?>">Sign in</a>
      <?php endif; ?>
      <a class="cart-link hover-pop" href="<?= e(url('?p=cart')) ?>">Cart <span class="badge"><?= cart_count() ?></span></a>
    </nav>
  </div>
</header>

<main class="wrap page anim-rise">
  <?php foreach ((array)flash() as $f): ?>
    <div class="note <?= e($f['type']) ?> anim-pop"><?= e($f['msg']) ?></div>
  <?php endforeach; ?>
  <?= $content ?>
</main>

<footer class="site-footer">
  <div class="wrap footer-inner">
    <div>
      <strong><?= e(setting('store_name', 'Special Love')) ?></strong>
      <p>A small Australian business bringing colourful products, thoughtful packing and a free gift with high priced orders.</p>
    </div>
    <div>
      <a href="<?= e(url('?p=shop')) ?>">Shop</a>
      <a href="<?= e(url('?p=shop&collection=best')) ?>">Best Sellers</a><a href="<?= e(url('?p=shop&collection=new')) ?>">New Products</a><a href="<?= e(url('?p=home#categories')) ?>">Categories</a>
    </div>
    <div>
      <a href="<?= e(url('?p=support')) ?>">Contact & FAQs</a><a href="<?= e(url('?p=support')) ?>">Shipping & Returns</a><p>Questions? <a href="mailto:<?= e(setting('contact_email', '')) ?>"><?= e(setting('contact_email', '')) ?></a></p>
      <p class="muted">&copy; <?= date('Y') ?> <?= e(setting('store_name', 'Special Love')) ?></p>
    </div>
  </div>
</footer>
<script src="<?= e(url('assets/app.js')) ?>"></script>
</body>
</html><?php
}

function admin_tabs(string $active): void {
    $tabs = [
        'admin_orders'   => 'Orders',
        'admin_products' => 'Products',
        'admin_requests' => 'Print requests',
        'admin_settings' => 'Store settings',
        'admin_payments' => 'Payments',
    ];
    if (is_owner()) $tabs['admin_team'] = 'Team access';
    echo '<div class="tabs">';
    foreach ($tabs as $key => $label) {
        $cls = $key === $active ? 'tab active' : 'tab';
        echo '<a class="' . $cls . '" href="' . e(url('?p=' . $key)) . '">' . e($label) . '</a>';
    }
    echo '</div>';
}

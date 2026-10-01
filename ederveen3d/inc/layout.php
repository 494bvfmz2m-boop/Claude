<?php
function render_page(string $path): void {
    ob_start();
    require $path;
    $content = ob_get_clean();
    $store = setting('store_name', 'Ederveen3D');
    $title = $GLOBALS['page_title'] ?? $store;
    $desc  = $GLOBALS['page_desc'] ?? setting('tagline', 'Laag voor laag geprint in Maarn.');
    $showcase = showcase_mode();
    $social = array_filter([
        'Instagram'   => setting('instagram_url', ''),
        'TikTok'      => setting('tiktok_url', ''),
        'Marktplaats' => setting('marktplaats_profile_url', ''),
    ]);
    ?><!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:type" content="website">
<meta property="og:image" content="<?= e(url('assets/logo.png')) ?>">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="<?= e(url('assets/logo.svg')) ?>" type="image/svg+xml">
<link rel="icon" href="<?= e(url('assets/logo.png')) ?>" type="image/png">
<link rel="stylesheet" href="<?= e(url('assets/style.css')) ?>">
</head>
<body>
<?php if (setting('promo_bar_enabled', '1') === '1'): ?><div class="announcement"><?= e(setting('promo_bar_text', 'Laag voor laag geprint in Maarn')) ?></div><?php endif; ?>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand hover-lift" href="<?= e(url('?p=home')) ?>">
      <img src="<?= e(url('assets/logo.svg')) ?>" alt="">
      <span><?= e($store) ?></span>
    </a>
    <nav class="nav">
      <a href="<?= e(url('?p=home')) ?>">Home</a>
      <a href="<?= e(url('?p=shop')) ?>"><?= $showcase ? 'Mijn werk' : 'Shop' ?></a><a href="<?= e(url('?p=home#categories')) ?>">Categorieën</a><a href="<?= e(url('?p=shop&collection=new')) ?>">Nieuw</a><a href="<?= e(url('?p=home#about')) ?>">Over mij</a><a href="<?= e(url('?p=custom')) ?>">Eigen idee?</a><a href="<?= e(url('?p=support')) ?>">Contact</a>
      <?php if (is_staff()): ?><a class="accent" href="<?= e(url('?p=admin')) ?>">Beheer</a><?php endif; ?>
      <?php if (is_logged_in()): ?>
        <a href="<?= e(url('?p=account')) ?>">Account</a>
        <a href="<?= e(url('?p=logout')) ?>">Uitloggen</a>
      <?php elseif (!$showcase): ?>
        <a href="<?= e(url('?p=login')) ?>">Inloggen</a>
      <?php endif; ?>
      <?php if (!$showcase): ?>
        <a class="cart-link hover-pop" href="<?= e(url('?p=cart')) ?>">Winkelwagen <span class="badge"><?= cart_count() ?></span></a>
      <?php endif; ?>
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
      <img class="footer-logo" src="<?= e(url('assets/logo.svg')) ?>" alt="">
      <strong><?= e($store) ?></strong>
      <p class="muted small">Kleine 3D-printstudio uit Maarn. Alles wordt laag voor laag geprint en met de hand afgewerkt.</p>
    </div>
    <div>
      <a href="<?= e(url('?p=shop')) ?>"><?= $showcase ? 'Mijn werk' : 'Shop' ?></a>
      <a href="<?= e(url('?p=shop&collection=new')) ?>">Nieuw</a><a href="<?= e(url('?p=home#categories')) ?>">Categorieën</a><a href="<?= e(url('?p=custom')) ?>">Eigen idee laten printen</a>
      <?php foreach ($social as $label => $link): ?><a href="<?= e($link) ?>" target="_blank" rel="noopener"><?= e($label) ?></a><?php endforeach; ?>
    </div>
    <div>
      <a href="<?= e(url('?p=support')) ?>">Contact &amp; veelgestelde vragen</a>
      <?php if (setting('contact_email', '')): ?><p>Vragen? <a href="mailto:<?= e(setting('contact_email', '')) ?>"><?= e(setting('contact_email', '')) ?></a></p><?php endif; ?>
      <?php
        $legal = array_filter([
            setting('legal_name', ''),
            setting('business_address', ''),
            setting('kvk_number', '') ? 'KvK ' . setting('kvk_number', '') : '',
            setting('btw_id', '') ? 'Btw-id ' . setting('btw_id', '') : '',
        ]);
      ?>
      <?php if ($legal): ?><p class="muted small"><?= implode('<br>', array_map('e', $legal)) ?></p><?php endif; ?>
      <p class="muted small">&copy; <?= date('Y') ?> <?= e($store) ?><?php if (!is_logged_in()): ?> · <a class="inline" href="<?= e(url('?p=login')) ?>">Inloggen</a><?php endif; ?></p>
    </div>
  </div>
</footer>
<script src="<?= e(url('assets/app.js')) ?>"></script>
</body>
</html><?php
}

function admin_tabs(string $active): void {
    $tabs = [
        'admin_products' => 'Producten',
        'admin_requests' => 'Printverzoeken',
        'admin_settings' => 'Instellingen',
    ];
    if (!showcase_mode()) {
        $tabs = ['admin_orders' => 'Bestellingen'] + $tabs;
        $tabs['admin_payments'] = 'Betalingen';
    }
    if (is_owner()) $tabs['admin_team'] = 'Team';
    echo '<div class="tabs">';
    foreach ($tabs as $key => $label) {
        $cls = $key === $active ? 'tab active' : 'tab';
        echo '<a class="' . $cls . '" href="' . e(url('?p=' . $key)) . '">' . e($label) . '</a>';
    }
    echo '</div>';
}

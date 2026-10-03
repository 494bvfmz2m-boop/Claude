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
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<?php if (setting('promo_bar_enabled', '1') === '1'): ?><div class="announcement"><?= e(setting('promo_bar_text', 'Laag voor laag geprint in Maarn')) ?></div><?php endif; ?>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="<?= e(url('?p=home')) ?>">
      <img src="<?= e(url('assets/logo.svg')) ?>" alt="">
      <span>Ederveen<b>3D</b></span>
    </a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Menu">
    <label for="nav-toggle" class="nav-burger" aria-hidden="true"><span></span></label>
    <nav class="nav">
      <a href="<?= e(url('?p=shop')) ?>"><?= $showcase ? 'Mijn werk' : 'Shop' ?></a>
      <a href="<?= e(url('?p=custom')) ?>">Eigen idee</a>
      <a href="<?= e(url('?p=home#over')) ?>">Over mij</a>
      <a href="<?= e(url('?p=support')) ?>">Vragen</a>
      <?php if (is_staff()): ?>
        <?php $adminUnread = chat_unread_for_admin(); ?>
        <a class="nav-strong" href="<?= e(url('?p=admin')) ?>">Beheer<?php if ($adminUnread > 0): ?> <span class="badge"><?= $adminUnread ?></span><?php endif; ?></a>
      <?php elseif (is_logged_in()): ?>
        <?php $userUnread = chat_unread_for_user((int)current_user()['id']); ?>
        <a href="<?= e(url('?p=account')) ?>">Account</a>
        <a class="nav-cta" href="<?= e(url('?p=chat')) ?>">💬 Chat<?php if ($userUnread > 0): ?> <span class="badge"><?= $userUnread ?></span><?php endif; ?></a>
      <?php else: ?>
        <a href="<?= e(url('?p=login')) ?>">Inloggen</a>
        <a class="nav-cta" href="<?= e(url('?p=chat')) ?>">💬 Chat</a>
      <?php endif; ?>
      <?php if (is_logged_in()): ?><a class="nav-quiet" href="<?= e(url('?p=logout')) ?>">Uitloggen</a><?php endif; ?>
      <?php if (!$showcase): ?>
        <a class="cart-link" href="<?= e(url('?p=cart')) ?>">🛒 <span class="badge"><?= cart_count() ?></span></a>
      <?php endif; ?>
    </nav>
  </div>
</header>

<main class="wrap page">
  <?php foreach ((array)flash() as $f): ?>
    <div class="note <?= e($f['type']) ?> anim-pop"><?= e($f['msg']) ?></div>
  <?php endforeach; ?>
  <?= $content ?>
</main>

<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">
      <img src="<?= e(url('assets/logo.svg')) ?>" alt="">
      <div>
        <strong><?= e($store) ?></strong>
        <p>3D-printstudio uit Maarn.<br>Laag voor laag geprint, met de hand afgewerkt.</p>
      </div>
    </div>
    <div>
      <h4>Kijken</h4>
      <a href="<?= e(url('?p=shop')) ?>"><?= $showcase ? 'Mijn werk' : 'Shop' ?></a>
      <a href="<?= e(url('?p=shop&collection=new')) ?>">Nieuw</a>
      <a href="<?= e(url('?p=custom')) ?>">Eigen idee laten printen</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="<?= e(url('?p=chat')) ?>">Chat</a>
      <a href="<?= e(url('?p=support')) ?>">Veelgestelde vragen</a>
      <?php if (setting('contact_email', '')): ?><a href="mailto:<?= e(setting('contact_email', '')) ?>"><?= e(setting('contact_email', '')) ?></a><?php endif; ?>
      <?php foreach ($social as $label => $link): ?><a href="<?= e($link) ?>" target="_blank" rel="noopener"><?= e($label) ?></a><?php endforeach; ?>
    </div>
    <div>
      <?php
        $legal = array_filter([
            setting('legal_name', ''),
            setting('business_address', ''),
            setting('kvk_number', '') ? 'KvK ' . setting('kvk_number', '') : '',
            setting('btw_id', '') ? 'Btw-id ' . setting('btw_id', '') : '',
        ]);
      ?>
      <?php if ($legal): ?><p class="small"><?= implode('<br>', array_map('e', $legal)) ?></p><?php endif; ?>
      <p class="small">&copy; <?= date('Y') ?> <?= e($store) ?></p>
    </div>
  </div>
</footer>
<script src="<?= e(url('assets/app.js')) ?>"></script>
</body>
</html><?php
}

function admin_tabs(string $active): void {
    $unread = chat_unread_for_admin();
    $tabs = [
        'admin_chats'    => 'Chats' . ($unread > 0 ? " ($unread)" : ''),
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

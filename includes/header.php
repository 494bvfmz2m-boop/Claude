<?php
// Safe to call even if the page already required bootstrap.php (require_once).
require_once __DIR__ . '/bootstrap.php';
$settings = db_read('settings', []);
$siteName = $settings['site_name'] ?? SITE_NAME;
$pageTitle = isset($pageTitle) ? $pageTitle . ' — ' . $siteName : $siteName;
// Pages set $pageDescription before including this file for a page-specific
// summary; otherwise fall back to the homepage banner text, then a generic line.
$pageDescription = $pageDescription ?? ($settings['banner_text'] ?? ($siteName . ' — a chill Minecraft SMP.'));
$requestPath = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
$pageNoIndex = $pageNoIndex ?? (strpos($requestPath, '/admin') === 0);
// Full URI (with query string) since some pages (post?id=5) are only
// distinguished by their query, not their path.
$canonicalUrl = SITE_URL . ($_SERVER['REQUEST_URI'] ?? '/');
$me = current_user();
$cartCount = (int)($_SESSION['basket_item_count'] ?? 0);
$storeEnabled = store_is_enabled($settings);
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($pageTitle) ?></title>
<meta name="description" content="<?= e(truncate_text($pageDescription, 160)) ?>">
<?php if ($pageNoIndex): ?>
<meta name="robots" content="noindex, nofollow">
<?php else: ?>
<link rel="canonical" href="<?= e($canonicalUrl) ?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="<?= e($siteName) ?>">
<meta property="og:title" content="<?= e($pageTitle) ?>">
<meta property="og:description" content="<?= e(truncate_text($pageDescription, 160)) ?>">
<meta property="og:url" content="<?= e($canonicalUrl) ?>">
<meta property="og:image" content="<?= SITE_URL ?>/assets/img/logo.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="<?= e($pageTitle) ?>">
<meta name="twitter:description" content="<?= e(truncate_text($pageDescription, 160)) ?>">
<meta name="twitter:image" content="<?= SITE_URL ?>/assets/img/logo.png">
<?php endif; ?>
<meta name="theme-color" content="#0f1420">
<link rel="icon" type="image/png" href="<?= SITE_URL ?>/assets/img/favicon.png?v=<?= ASSET_VERSION ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= SITE_URL ?>/assets/css/style.css?v=<?= ASSET_VERSION ?>">
</head>
<body data-theme="<?= e($settings['active_theme'] ?? 'default') ?>" data-effects="<?= !empty($settings['theme_effects']) ? '1' : '0' ?>">
<div class="bg-glow" aria-hidden="true"></div>

<header class="site-header">
  <div class="wrap header-inner">
    <a href="<?= SITE_URL ?>" class="brand">
      <img src="<?= SITE_URL ?>/assets/img/logo-small.png?v=<?= ASSET_VERSION ?>" alt="" class="brand-mark">
      <span class="brand-text"><?= e($settings['site_name'] ?? SITE_NAME) ?></span>
    </a>
    <nav class="main-nav" id="mainNav">
      <div class="nav-links" id="navLinks">
        <a href="<?= SITE_URL ?>">Home</a>
        <a href="<?= SITE_URL ?>/rules">Rules</a>
        <a href="<?= SITE_URL ?>/staff">Staff</a>
        <a href="<?= SITE_URL ?>/announcements">Announcements</a>
        <?php if ($storeEnabled): ?><a href="<?= SITE_URL ?>/store">Store</a><?php endif; ?>
        <a href="<?= SITE_URL ?>/support">Support</a>
        <?php if (!empty($settings['discord_invite'])): ?>
          <a href="<?= e($settings['discord_invite']) ?>" target="_blank" rel="noopener">Discord</a>
        <?php endif; ?>
      </div>
      <div class="nav-more" id="navMore">
        <button type="button" class="nav-more-btn" id="navMoreBtn">More <span aria-hidden="true">▾</span></button>
        <div class="nav-more-menu" id="navMoreMenu"></div>
      </div>
    </nav>
    <div class="nav-auth">
      <?php if ($storeEnabled): ?>
        <div class="cart-group">
          <a href="<?= SITE_URL ?>/store" class="cart-store-btn">🛍️ Store</a>
          <a href="<?= SITE_URL ?>/basket" class="cart-chip" aria-label="View basket">
            🛒<?php if ($cartCount > 0): ?><span class="cart-count"><?= $cartCount ?></span><?php endif; ?>
          </a>
        </div>
      <?php endif; ?>
      <?php if ($me): ?>
        <?php $role = primary_role_for_user($me); ?>
        <a href="<?= SITE_URL ?>/account" class="user-chip" style="--role-color: <?= e(role_color_or_default($role)) ?>">
          <?= e($me['username']) ?><?php if ($role): ?><i><?= e($role['name']) ?></i><?php endif; ?>
        </a>
        <?php if (user_has_any_admin_permission($me)): ?>
          <a href="<?= SITE_URL ?>/admin" class="btn btn-ghost">Staff Panel</a>
        <?php endif; ?>
        <a href="<?= SITE_URL ?>/logout" class="btn btn-outline">Log out</a>
      <?php else: ?>
        <a href="<?= SITE_URL ?>/login" class="btn btn-outline">Log in</a>
        <a href="<?= SITE_URL ?>/register" class="btn btn-primary">Join</a>
      <?php endif; ?>
    </div>
    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">☰</button>
  </div>
</header>
<main>

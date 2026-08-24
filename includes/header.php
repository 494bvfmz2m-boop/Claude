<?php
/**
 * Expects (optionally) $currentPage to be set by the including page,
 * one of: home, products, posts, about, contact.
 */
$currentPage = $currentPage ?? '';
$navProducts = Content::all('products');
require_once __DIR__ . '/XyphrosAuth.php';
$xsCurrentUser = XyphrosAuth::currentUser();
no_cache_headers();
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo isset($pageTitle) ? e($pageTitle) . ' &mdash; ' . SITE_NAME : e(SITE_NAME); ?></title>
<meta name="description" content="<?php echo e($pageDescription ?? SITE_TAGLINE); ?>">
<link rel="icon" type="image/png" href="<?php echo e(asset_url('/assets/img/favicon-32.png')); ?>">
<link rel="apple-touch-icon" href="<?php echo e(asset_url('/assets/img/apple-touch-icon.png')); ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?php echo e(asset_url('/assets/css/style.css')); ?>">
</head>
<body>

<div class="scroll-progress" id="scroll-progress"></div>

<?php require __DIR__ . '/broadcast-bar.php'; ?>

<header class="site-header">
    <div class="container site-header__bar">
        <a href="/" class="brand">
            <img src="<?php echo e(asset_url('/assets/img/logo-full.png')); ?>" alt="Xyphros Studios">
        </a>

        <nav class="nav" id="site-nav">
            <button class="nav__toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>
            <ul class="nav__links">
                <li><a href="/" class="<?php echo $currentPage === 'home' ? 'is-active' : ''; ?>">Home</a></li>
                <li><a href="/products" class="<?php echo $currentPage === 'products' ? 'is-active' : ''; ?>">Products</a></li>
                <li><a href="/store" class="<?php echo $currentPage === 'store' ? 'is-active' : ''; ?>">Store <span style="opacity:.55;font-size:.85em;">(WIP)</span></a></li>
                <li><a href="/posts" class="<?php echo $currentPage === 'posts' ? 'is-active' : ''; ?>">Posts</a></li>
                <li><a href="/about" class="<?php echo $currentPage === 'about' ? 'is-active' : ''; ?>">About</a></li>
                <li><a href="/contact" class="<?php echo $currentPage === 'contact' ? 'is-active' : ''; ?>">Contact</a></li>
            </ul>

            <a href="<?php echo e(DISCORD_INVITE_URL); ?>" target="_blank" rel="noopener" class="btn btn--discord btn--sm">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="flex-shrink:0"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
                <span class="btn--discord__label">Discord</span>
            </a>

            <div class="signin-menu" id="signin-menu">
                <button type="button" class="btn btn--primary btn--sm signin-menu__toggle" id="signin-toggle" aria-haspopup="true" aria-expanded="false">
                    <?php if ($xsCurrentUser): ?>
                        <?php if (!empty($xsCurrentUser['avatar'])): ?>
                            <img src="<?php echo e($xsCurrentUser['avatar']); ?>" alt="" style="width:18px;height:18px;border-radius:50%;object-fit:cover;">
                        <?php endif; ?>
                        <?php echo e($xsCurrentUser['name'] ?: $xsCurrentUser['username']); ?>
                    <?php else: ?>
                        Sign in
                    <?php endif; ?>
                    <span class="signin-menu__chevron">&#9662;</span>
                </button>
                <div class="signin-menu__panel" id="signin-panel" role="menu">
                    <?php if ($xsCurrentUser): ?>
                        <a href="/account" class="signin-menu__item" role="menuitem">
                            <span class="signin-menu__text">
                                <span class="signin-menu__name">Manage account</span>
                                <span class="signin-menu__sub">Profile, password, 2FA</span>
                            </span>
                            <span class="signin-menu__arrow">&rarr;</span>
                        </a>
                        <?php if (XyphrosAuth::isXyphrosStaff($xsCurrentUser)): ?>
                        <a href="https://staff.xyphros.net" class="signin-menu__item" role="menuitem">
                            <span class="signin-menu__text">
                                <span class="signin-menu__name">Staff panel</span>
                            </span>
                            <span class="signin-menu__arrow">&rarr;</span>
                        </a>
                        <?php endif; ?>
                        <a href="/logout.php" class="signin-menu__item" role="menuitem">
                            <span class="signin-menu__text"><span class="signin-menu__name">Sign out</span></span>
                        </a>
                    <?php else: ?>
                        <a href="<?php echo e('/login.php?return_to=' . urlencode(SITE_URL . $_SERVER['REQUEST_URI'])); ?>" class="signin-menu__item" role="menuitem">
                            <span class="signin-menu__text">
                                <span class="signin-menu__name">Sign in to your Xyphros account</span>
                                <span class="signin-menu__sub">One account, every product</span>
                            </span>
                            <span class="signin-menu__arrow">&rarr;</span>
                        </a>
                        <?php if (empty($navProducts)): ?>
                            <div class="signin-menu__empty">No products yet</div>
                        <?php else: ?>
                            <?php foreach ($navProducts as $navProduct): ?>
                                <a href="<?php echo e($navProduct['url']); ?>" class="signin-menu__item" role="menuitem">
                                    <span class="signin-menu__icon">
                                        <?php if (!empty($navProduct['icon'])): ?>
                                            <img src="<?php echo e($navProduct['icon']); ?>" alt="">
                                        <?php else: ?>
                                            <span class="signin-menu__icon-dot"></span>
                                        <?php endif; ?>
                                    </span>
                                    <span class="signin-menu__text">
                                        <span class="signin-menu__name"><?php echo e($navProduct['name']); ?></span>
                                        <span class="signin-menu__sub">Open</span>
                                    </span>
                                    <span class="signin-menu__arrow">&rarr;</span>
                                </a>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>
            </div>
        </nav>
    </div>
</header>

<main>

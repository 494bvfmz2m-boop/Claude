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
<script>!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_YHmEsq0YmJnr1F");whop.track("page");</script>
<?php
$xsPageTitleFull = isset($pageTitle) ? $pageTitle . ' - ' . SITE_NAME : SITE_NAME;
$xsPageDesc = $pageDescription ?? SITE_TAGLINE;
$xsCanonicalUrl = SITE_URL . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$xsOgImage = SITE_URL . '/assets/img/og-image.jpg';
?>
<title><?php echo e($xsPageTitleFull); ?></title>
<meta name="description" content="<?php echo e($xsPageDesc); ?>">
<link rel="canonical" href="<?php echo e($xsCanonicalUrl); ?>">
<?php if (!empty($noIndex)): ?>
<meta name="robots" content="noindex, nofollow">
<?php endif; ?>
<meta property="og:type" content="website">
<meta property="og:site_name" content="<?php echo e(SITE_NAME); ?>">
<meta property="og:title" content="<?php echo e($xsPageTitleFull); ?>">
<meta property="og:description" content="<?php echo e($xsPageDesc); ?>">
<meta property="og:url" content="<?php echo e($xsCanonicalUrl); ?>">
<meta property="og:image" content="<?php echo e($xsOgImage); ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?php echo e($xsPageTitleFull); ?>">
<meta name="twitter:description" content="<?php echo e($xsPageDesc); ?>">
<meta name="twitter:image" content="<?php echo e($xsOgImage); ?>">
<link rel="icon" type="image/png" href="<?php echo e(asset_url('/assets/img/favicon-32.png')); ?>">
<link rel="apple-touch-icon" href="<?php echo e(asset_url('/assets/img/apple-touch-icon.png')); ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?php echo e(asset_url('/assets/css/style.css')); ?>">
</head>
<body>

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
                <li><a href="/store" class="<?php echo $currentPage === 'store' ? 'is-active' : ''; ?>">Store</a></li>
                <li><a href="/posts" class="<?php echo $currentPage === 'posts' ? 'is-active' : ''; ?>">Posts</a></li>
                <li><a href="/docs" class="<?php echo $currentPage === 'docs' ? 'is-active' : ''; ?>">Docs</a></li>
                <li><a href="/about" class="<?php echo $currentPage === 'about' ? 'is-active' : ''; ?>">About</a></li>
                <li><a href="/contact" class="<?php echo $currentPage === 'contact' ? 'is-active' : ''; ?>">Contact</a></li>
            </ul>

            <a href="<?php echo e(DISCORD_INVITE_URL); ?>" target="_blank" rel="noopener" class="btn btn--discord btn--sm">
                <?php echo xs_icon_discord(16); ?>
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
                        <a href="/staff" class="signin-menu__item" role="menuitem">
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

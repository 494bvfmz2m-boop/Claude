<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'home';
$pageTitle = 'Home';
$settings = get_settings();
$pageDescription = $settings['tagline'];

$products = Content::all('products');
$featuredProduct = null;
foreach ($products as $product) {
    if (!empty($product['featured'])) {
        $featuredProduct = $product;
        break;
    }
}
if (!$featuredProduct && !empty($products)) {
    $featuredProduct = $products[0];
}

$posts = Content::all('posts');
$posts = array_filter($posts, fn($p) => !empty($p['published']));
usort($posts, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
$latestPosts = array_slice($posts, 0, 3);

require __DIR__ . '/includes/header.php';
?>

<section class="hero">
    <div class="hero__glow"></div>
    <img src="<?php echo e(asset_url('/assets/img/globe-wire.svg')); ?>" alt="" class="hero__globe">
    <div class="container hero__content">
        <img src="<?php echo e(asset_url('/assets/img/logo-full.png')); ?>" alt="Xyphros Studios" class="hero__logo">
        <h1><?php echo highlight_last_word($settings['hero_headline']); ?></h1>
        <p class="lede lede--center">
            <?php echo e($settings['hero_subtext']); ?>
        </p>
        <div class="btn-row">
            <a href="/products" class="btn btn--primary">Explore products</a>
            <a href="/posts" class="btn btn--ghost">Read the blog</a>
        </div>
    </div>
</section>

<?php if ($featuredProduct): ?>
<section class="section section--border-top section--glow-r">
    <div class="container">
        <span class="eyebrow">Featured product</span>
        <div class="product-card" style="margin-top:6px;">
            <div class="product-card__icon">
                <?php if (!empty($featuredProduct['icon'])): ?>
                    <img src="<?php echo e($featuredProduct['icon']); ?>" alt="">
                <?php else: ?>
                    <div class="product-card__icon-fallback"></div>
                <?php endif; ?>
            </div>
            <div>
                <div class="product-card__head">
                    <h3><?php echo e($featuredProduct['name']); ?></h3>
                    <?php $statusMeta = product_status_meta($featuredProduct['status'] ?? 'online'); ?>
                    <span class="status-pill <?php echo e($statusMeta['class']); ?>"><?php echo e($statusMeta['label']); ?></span>
                </div>
                <p class="product-card__tagline"><?php echo e($featuredProduct['tagline']); ?></p>
                <p><?php echo e($featuredProduct['description']); ?></p>
                <div class="btn-row">
                    <a href="<?php echo e($featuredProduct['url']); ?>" class="btn btn--primary btn--sm"><?php echo e($featuredProduct['cta_label'] ?: 'Open ' . $featuredProduct['name']); ?></a>
                    <a href="/products" class="btn btn--ghost btn--sm">See all products</a>
                </div>
            </div>
        </div>
    </div>
</section>
<?php endif; ?>

<section class="section section--border-top section--tint">
    <div class="container">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; margin-bottom:36px;">
            <div>
                <span class="eyebrow">From the studio</span>
                <h2 style="font-size:30px; margin-bottom:0;">Latest posts</h2>
            </div>
            <a href="/posts" class="btn btn--ghost btn--sm">View all posts</a>
        </div>

        <?php if (empty($latestPosts)): ?>
            <div class="empty-state">
                <div class="empty-state__icon">&#128221;</div>
                <p style="margin:0;">No posts yet &mdash; check back soon.</p>
            </div>
        <?php else: ?>
            <div class="grid grid--3">
                <?php foreach ($latestPosts as $post): ?>
                    <a href="/posts/<?php echo urlencode($post['slug']); ?>" class="post-card">
                        <?php if (!empty($post['cover'])): ?>
                            <div class="post-card__cover"><img src="<?php echo e($post['cover']); ?>" alt=""></div>
                        <?php endif; ?>
                        <div class="post-card__body">
                            <div class="post-date"><?php echo e(format_date($post['created_at'] ?? '')); ?></div>
                            <h3><?php echo e($post['title']); ?></h3>
                            <p><?php echo e($post['excerpt']); ?></p>
                            <span class="read-more">Read more &rarr;</span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</section>

<section class="section section--border-top text-center">
    <div class="container">
        <div class="cta-panel">
            <span class="eyebrow">Let's talk</span>
            <h2 style="font-size:30px;">Have a project, a question, or feedback?</h2>
            <p class="lede lede--center">We read every message that comes through. Tell us what you're working on.</p>
            <div class="btn-row" style="justify-content:center;">
                <a href="/contact" class="btn btn--primary">Get in touch</a>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

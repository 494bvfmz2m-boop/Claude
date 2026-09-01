<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'products';
$pageTitle = 'Products';
$pageDescription = 'The tools Xyphros Studios builds and maintains.';

$products = Content::all('products');
usort($products, function ($a, $b) {
    return ($b['featured'] ?? false) <=> ($a['featured'] ?? false);
});

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">What we're building</span>
        <h1>Products</h1>
        <p class="lede lede--center">
            Everything here is built and maintained in-house by Xyphros Studios. No bloat,
            no dark patterns &mdash; just tools we actually want to use ourselves.
        </p>
    </div>
</section>

<section class="section">
    <div class="container" style="display:flex; flex-direction:column; gap:24px;">
        <?php if (empty($products)): ?>
            <div class="empty-state">
                <div class="empty-state__icon">&#129529;</div>
                <p style="margin:0;">Nothing published here yet &mdash; check back soon.</p>
            </div>
        <?php else: ?>
            <?php foreach ($products as $product): ?>
                <?php $statusMeta = product_status_meta($product['status'] ?? 'online'); ?>
                <div class="product-card">
                    <div class="product-card__icon">
                        <?php if (!empty($product['icon'])): ?>
                            <img src="<?php echo e($product['icon']); ?>" alt="">
                        <?php else: ?>
                            <div class="product-card__icon-fallback"></div>
                        <?php endif; ?>
                    </div>
                    <div>
                        <div class="product-card__head">
                            <h3><?php echo e($product['name']); ?></h3>
                            <span class="status-pill <?php echo e($statusMeta['class']); ?>"><?php echo e($statusMeta['label']); ?></span>
                        </div>
                        <p class="product-card__tagline"><?php echo e($product['tagline']); ?></p>
                        <p><?php echo e($product['description']); ?></p>
                        <div class="btn-row">
                            <a href="<?php echo e($product['url']); ?>" class="btn btn--primary btn--sm">
                                <?php echo e($product['cta_label'] ?: 'Open ' . $product['name']); ?>
                            </a>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

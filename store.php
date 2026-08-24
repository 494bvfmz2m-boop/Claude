<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'store';
$pageTitle = 'Store (WIP)';

$user = XyphrosAuth::currentUser();
$categories = Tebex::getCategories();

// Cheapest-first: sort packages within each category by price, then sort
// the categories themselves by their cheapest package, so the grid reads
// cheapest top-left down to most expensive bottom-right.
foreach ($categories as &$category) {
    usort($category['packages'], fn($a, $b) => ($a['total_price'] ?? $a['base_price'] ?? 0) <=> ($b['total_price'] ?? $b['base_price'] ?? 0));
}
unset($category);
usort($categories, function ($a, $b) {
    $aMin = !empty($a['packages']) ? min(array_column($a['packages'], 'total_price')) : PHP_INT_MAX;
    $bMin = !empty($b['packages']) ? min(array_column($b['packages'], 'total_price')) : PHP_INT_MAX;
    return $aMin <=> $bMin;
});

$error = $_GET['error'] ?? null;
$csrfToken = xs_csrf_token();

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Store &mdash; Work in progress</span>
        <h1>Support Xyphros</h1>
        <p class="lede lede--center">This is still being built &mdash; things here may change, break, or disappear without notice.</p>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="alert" style="max-width:560px;margin:0 auto 32px;background:rgba(255,200,87,.08);border:1px solid rgba(255,200,87,.25);color:var(--beta);text-align:center;">
            &#9888; This store is a work in progress. Purchases may not be fully supported yet &mdash; if something looks off, it probably is.
        </div>

        <?php if ($error): ?><div class="alert alert--error" style="max-width:520px;margin:0 auto 24px;"><?php echo e($error); ?></div><?php endif; ?>

        <?php if (empty($categories)): ?>
            <div class="empty-state">
                <div class="empty-state__icon">&#128722;</div>
                <p>Nothing's for sale here yet &mdash; check back soon.</p>
            </div>
        <?php else: foreach ($categories as $category): ?>
            <?php if (empty($category['packages'])) continue; ?>
            <h2 style="font-size:20px;margin:0 0 18px;"><?php echo e($category['name']); ?></h2>
            <div class="shop-grid">
                <?php foreach ($category['packages'] as $package): ?>
                    <div class="shop-card">
                        <?php if (!empty($package['image'])): ?>
                            <img src="<?php echo e($package['image']); ?>" class="shop-card__image" alt="">
                        <?php endif; ?>
                        <div class="shop-card__body">
                            <h3><?php echo e($package['name']); ?></h3>
                            <p><?php echo e(strip_tags($package['description'] ?? '')); ?></p>
                            <div class="shop-card__foot">
                                <span class="shop-card__price"><?php echo e($package['currency'] ?? 'USD'); ?> <?php echo number_format((float) ($package['total_price'] ?? $package['base_price'] ?? 0), 2); ?></span>
                                <?php if ($user): ?>
                                    <form method="post" action="/store-buy">
                                        <input type="hidden" name="csrf_token" value="<?php echo e($csrfToken); ?>">
                                        <input type="hidden" name="package_id" value="<?php echo e($package['id']); ?>">
                                        <button type="submit" class="btn btn--primary btn--sm">Buy now</button>
                                    </form>
                                <?php else: ?>
                                    <a href="/login?return_to=<?php echo rawurlencode(SITE_URL . '/store'); ?>" class="btn btn--ghost btn--sm">Sign in to buy</a>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endforeach; endif; ?>

        <?php if ($user): ?>
            <p style="text-align:center;margin-top:40px;color:var(--text-muted);font-size:14px;">
                <a href="/account?tab=orders">View your order history &rarr;</a>
            </p>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

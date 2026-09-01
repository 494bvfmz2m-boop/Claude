<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'store';
$pageTitle = 'Store';
$pageDescription = 'Support Xyphros and unlock Discord perks.';

// Browsing the store doesn't require signing in — only buying does
// (store-buy.php enforces that server-side regardless of what this page
// renders). Package listings themselves only need the public Tebex
// token, which is safe to call for anyone.
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
$categories = array_values(array_filter($categories, fn($c) => !empty($c['packages'])));

$totalPackages = array_sum(array_map(fn($c) => count($c['packages']), $categories));

$error = $_GET['error'] ?? null;
$justLinkedDiscord = isset($_GET['discord_linked']);
$csrfToken = xs_csrf_token();
$signInUrl = '/login?return_to=' . rawurlencode(SITE_URL . '/store');

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">Store</span>
        <h1>Support Xyphros, unlock perks</h1>
        <p class="lede lede--center">Purchases connect straight to Discord at checkout &mdash; your role shows up automatically once payment goes through.</p>
        <?php if ($user): ?>
            <div style="text-align:center;margin-top:8px;">
                <a href="/account?tab=connections" class="btn btn--ghost btn--sm" style="display:inline-flex;">
                    <?php echo xs_icon_discord(15); ?> <span>Your linked Discord account</span>
                </a>
            </div>
        <?php endif; ?>
    </div>
</section>

<section class="section" style="padding-top:32px;">
    <div class="container">

        <?php if ($error): ?><div class="alert alert--error" style="max-width:560px;margin:0 auto 28px;"><?php echo e($error); ?></div><?php endif; ?>
        <?php if ($justLinkedDiscord): ?><div class="alert alert--success" style="max-width:560px;margin:0 auto 28px;text-align:center;">Discord linked — you can buy that item now.</div><?php endif; ?>
        <?php if (!$user): ?><div class="alert" style="max-width:560px;margin:0 auto 28px;text-align:center;">Browsing is open to everyone &mdash; <a href="<?php echo e($signInUrl); ?>" style="color:var(--magenta);font-weight:700;">sign in</a> to buy.</div><?php endif; ?>

        <?php if ($totalPackages === 0): ?>
            <div class="empty-state">
                <div class="empty-state__icon">&#128722;</div>
                <p>Nothing's for sale here yet &mdash; check back soon.</p>
            </div>

        <?php else: ?>

            <?php if (count($categories) > 1): ?>
            <nav class="store-tabs" aria-label="Categories">
                <a href="#cat-all" class="store-tabs__item is-active" data-cat="all">All</a>
                <?php foreach ($categories as $i => $category): ?>
                    <a href="#cat-<?php echo (int) $i; ?>" class="store-tabs__item" data-cat="<?php echo (int) $i; ?>"><?php echo e($category['name']); ?></a>
                <?php endforeach; ?>
            </nav>
            <?php endif; ?>

            <?php foreach ($categories as $i => $category): ?>
                <div class="store-category" id="cat-<?php echo (int) $i; ?>" data-cat-index="<?php echo (int) $i; ?>">
                    <div class="store-category__head">
                        <h2><?php echo e($category['name']); ?></h2>
                        <span class="store-category__count"><?php echo count($category['packages']); ?> item<?php echo count($category['packages']) === 1 ? '' : 's'; ?></span>
                    </div>
                    <div class="shop-grid">
                        <?php foreach ($category['packages'] as $package):
                            $price = (float) ($package['total_price'] ?? $package['base_price'] ?? 0);
                            $basePrice = (float) ($package['base_price'] ?? $price);
                            $onSale = $basePrice > $price;
                            $isSub = ($package['type'] ?? 'single') === 'subscription';
                            $isFeatured = in_array((int) $package['id'], TEBEX_FEATURED_PACKAGES, true);
                            $hasImage = !empty($package['image']);
                            $descLines = xs_store_description_lines($package['description'] ?? '', 5);
                            // First line reads as the intro sentence ("Buying this
                            // package gives you the X role!"); anything after it is
                            // the actual perk list, shown as bullets instead of run
                            // -on truncated text.
                            $descIntro = $descLines[0] ?? '';
                            $descBullets = array_slice($descLines, 1, 4);
                            // Full, untruncated version of the same lines for the
                            // quick-view modal — the card itself only shows a
                            // trimmed preview.
                            $fullLines = xs_store_description_lines($package['description'] ?? '', 30);
                            $fullIntro = $fullLines[0] ?? '';
                            $fullBullets = array_slice($fullLines, 1);
                        ?>
                        <div class="shop-card<?php echo $isFeatured ? ' shop-card--featured' : ''; ?>" data-pkg="<?php echo (int) $package['id']; ?>" tabindex="0" role="button" aria-haspopup="dialog">
                            <?php if ($isFeatured && $hasImage): ?><span class="shop-card__ribbon">Best value</span><?php endif; ?>
                            <?php if ($hasImage): ?>
                            <div class="shop-card__media">
                                <img src="<?php echo e($package['image']); ?>" class="shop-card__image" alt="" loading="lazy">
                                <?php if ($isSub): ?><span class="shop-card__tag">Subscription</span><?php endif; ?>
                            </div>
                            <?php endif; ?>
                            <div class="shop-card__body">
                                <?php if (!$hasImage): ?>
                                    <div class="shop-card__top">
                                        <div class="shop-card__icon"><?php echo xs_icon_discord(18); ?></div>
                                        <?php if ($isFeatured): ?><span class="shop-card__tag shop-card__tag--inline shop-card__tag--best">Best value</span>
                                        <?php elseif ($isSub): ?><span class="shop-card__tag shop-card__tag--inline">Subscription</span><?php endif; ?>
                                    </div>
                                <?php endif; ?>
                                <h3><?php echo e($package['name']); ?></h3>
                                <?php if ($descIntro !== ''): ?>
                                    <p class="shop-card__intro"><?php echo e(xs_truncate_words($descIntro, 100)); ?></p>
                                <?php endif; ?>
                                <?php if ($descBullets): ?>
                                    <ul class="shop-card__perks">
                                        <?php foreach ($descBullets as $bullet): ?>
                                            <li><?php echo xs_icon('check', 13); ?><span><?php echo e(xs_truncate_words($bullet, 58)); ?></span></li>
                                        <?php endforeach; ?>
                                    </ul>
                                <?php endif; ?>
                                <div class="shop-card__foot">
                                    <div class="shop-card__price-wrap">
                                        <?php if ($onSale): ?><span class="shop-card__price-was"><?php echo e($package['currency'] ?? 'USD'); ?> <?php echo number_format($basePrice, 2); ?></span><?php endif; ?>
                                        <span class="shop-card__price"><?php echo e($package['currency'] ?? 'USD'); ?> <?php echo number_format($price, 2); ?><?php if ($isSub): ?><span class="shop-card__price-period">/mo</span><?php endif; ?></span>
                                    </div>
                                    <?php if ($user): ?>
                                        <form method="post" action="/store-buy">
                                            <input type="hidden" name="csrf_token" value="<?php echo e($csrfToken); ?>">
                                            <input type="hidden" name="package_id" value="<?php echo e($package['id']); ?>">
                                            <button type="submit" class="btn btn--primary btn--sm">Buy now</button>
                                        </form>
                                    <?php else: ?>
                                        <a href="<?php echo e($signInUrl); ?>" class="btn btn--ghost btn--sm">Sign in to buy</a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                        <template id="pkg-tpl-<?php echo (int) $package['id']; ?>">
                            <?php if ($hasImage): ?>
                                <img src="<?php echo e($package['image']); ?>" class="store-modal__image" alt="">
                            <?php endif; ?>
                            <div class="store-modal__badges">
                                <?php if ($isFeatured): ?><span class="shop-card__tag shop-card__tag--inline shop-card__tag--best">Best value</span><?php endif; ?>
                                <?php if ($isSub): ?><span class="shop-card__tag shop-card__tag--inline">Subscription</span><?php endif; ?>
                            </div>
                            <h2 class="store-modal__title"><?php echo e($package['name']); ?></h2>
                            <?php if ($fullIntro !== ''): ?><p class="store-modal__intro"><?php echo e($fullIntro); ?></p><?php endif; ?>
                            <?php if ($fullBullets): ?>
                                <ul class="shop-card__perks store-modal__perks">
                                    <?php foreach ($fullBullets as $bullet): ?>
                                        <li><?php echo xs_icon('check', 14); ?><span><?php echo e($bullet); ?></span></li>
                                    <?php endforeach; ?>
                                </ul>
                            <?php endif; ?>
                            <div class="store-modal__foot">
                                <div class="shop-card__price-wrap">
                                    <?php if ($onSale): ?><span class="shop-card__price-was"><?php echo e($package['currency'] ?? 'USD'); ?> <?php echo number_format($basePrice, 2); ?></span><?php endif; ?>
                                    <span class="shop-card__price"><?php echo e($package['currency'] ?? 'USD'); ?> <?php echo number_format($price, 2); ?><?php if ($isSub): ?><span class="shop-card__price-period">/mo</span><?php endif; ?></span>
                                </div>
                                <?php if ($user): ?>
                                    <form method="post" action="/store-buy">
                                        <input type="hidden" name="csrf_token" value="<?php echo e($csrfToken); ?>">
                                        <input type="hidden" name="package_id" value="<?php echo e($package['id']); ?>">
                                        <button type="submit" class="btn btn--primary">Buy now</button>
                                    </form>
                                <?php else: ?>
                                    <a href="<?php echo e($signInUrl); ?>" class="btn btn--primary">Sign in to buy</a>
                                <?php endif; ?>
                            </div>
                        </template>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>

            <?php if ($user): ?>
            <p style="text-align:center;margin-top:8px;color:var(--text-muted);font-size:14px;">
                <a href="/account?tab=orders">View your order history &rarr;</a>
            </p>
            <?php endif; ?>

            <div class="store-modal" id="store-modal" hidden>
                <div class="store-modal__overlay" data-close></div>
                <div class="store-modal__panel" role="dialog" aria-modal="true" tabindex="-1">
                    <button type="button" class="store-modal__close" data-close aria-label="Close">&times;</button>
                    <div class="store-modal__body" id="store-modal-body"></div>
                </div>
            </div>
        <?php endif; ?>
    </div>
</section>

<?php if ($totalPackages > 0): ?>
<script>
(function () {
    var modal = document.getElementById('store-modal');
    var body = document.getElementById('store-modal-body');
    if (!modal || !body) return;

    function openModal(pkgId) {
        var tpl = document.getElementById('pkg-tpl-' + pkgId);
        if (!tpl) return;
        body.innerHTML = '';
        body.appendChild(tpl.content.cloneNode(true));
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        modal.querySelector('.store-modal__panel').focus();
    }
    function closeModal() {
        modal.hidden = true;
        document.body.style.overflow = '';
        body.innerHTML = '';
    }

    document.querySelectorAll('.shop-card[data-pkg]').forEach(function (card) {
        card.addEventListener('click', function (e) {
            if (e.target.closest('form') || e.target.closest('button') || e.target.closest('a')) return;
            openModal(card.dataset.pkg);
        });
        card.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('form') && !e.target.closest('a')) {
                e.preventDefault();
                openModal(card.dataset.pkg);
            }
        });
    });

    modal.querySelectorAll('[data-close]').forEach(function (el) {
        el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
})();
</script>
<?php endif; ?>

<?php if (count($categories) > 1): ?>
<script>
(function () {
    var tabs = document.querySelectorAll('.store-tabs__item');
    var cats = document.querySelectorAll('.store-category');
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            var target = tab.dataset.cat;
            tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
            cats.forEach(function (c) {
                c.style.display = (target === 'all' || c.dataset.catIndex === target) ? '' : 'none';
            });
            if (target !== 'all') {
                var el = document.getElementById('cat-' + target);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
})();
</script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>

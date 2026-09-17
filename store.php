<?php
require_once __DIR__ . '/includes/bootstrap.php';

$me = current_user();
$error = null;
$notice = null;
$justAdded = false;
$settings = db_read('settings', []);
$storeEnabled = store_is_enabled($settings);

/** The Minecraft username to attribute purchases to: session override, else the logged-in account's saved one. */
function store_current_username() {
    global $me;
    if (!empty($_SESSION['mc_username'])) return $_SESSION['mc_username'];
    if ($me && !empty($me['minecraft_username'])) return $me['minecraft_username'];
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $storeEnabled ? ($_POST['action'] ?? '') : '';

    if ($action === 'set_username') {
        $username = trim($_POST['minecraft_username'] ?? '');
        if ($username === '' || !is_valid_minecraft_username($username)) {
            $error = 'Enter a valid Minecraft username (3-16 characters: letters, numbers, underscores — Bedrock players can leave the leading "." from Geyser).';
        } else {
            $_SESSION['mc_username'] = $username;
            $notice = 'Playing as ' . $username . '. You can add items to your basket now.';
        }
    }

    if ($action === 'add_to_cart') {
        $packageId = (int)($_POST['package_id'] ?? 0);
        $username = store_current_username();
        if (!tebex_configured()) {
            $error = 'The store isn\'t set up yet — check back soon.';
        } elseif (!$username) {
            $error = 'Enter your Minecraft username above first, so we know who to deliver this to.';
        } else {
            $basket = get_active_basket();
            if (!$basket) {
                $basket = tebex_create_basket(SITE_URL . '/order-return', SITE_URL . '/store', $username);
                if ($basket && !empty($basket['ident'])) {
                    store_basket_ident_cookie($basket['ident']);
                }
            }
            if (!$basket || empty($basket['ident'])) {
                $error = 'Could not start your basket. Please try again in a moment.';
            } else {
                $result = tebex_add_package_to_basket($basket['ident'], $packageId, 1);
                if ($result['ok']) {
                    $updated = $result['data'];
                    $count = 0;
                    foreach (($updated['packages'] ?? []) as $p) $count += (int)($p['quantity'] ?? 1);
                    $_SESSION['basket_item_count'] = $count;
                    $notice = 'Added to your basket.';
                    $justAdded = true;
                } else {
                    $error = $result['error'] ?: 'Could not add that item. Please try again.';
                }
            }
        }
    }
}

$pageTitle = 'Store';
$pageDescription = 'Support the server and grab a rank, kit, or perk from the store.';
require_once __DIR__ . '/includes/header.php';

$categories = tebex_configured() ? tebex_get_categories() : [];
$username = store_current_username();
?>
<section class="section">
  <div class="wrap">
    <div class="section-head store-hero">
      <h2>🛍️ Store</h2>
      <p>Support <?= e($settings['site_name'] ?? SITE_NAME) ?> and grab a rank, kit, or perk. Purchases are handled securely by Tebex.</p>
    </div>

    <?php if ($justAdded): ?><span id="cartJustAdded" hidden></span><?php endif; ?>
    <?php if ($notice): ?><div class="alert alert-success"><?= e($notice) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

    <?php if (!$storeEnabled): ?>
      <div class="empty-state">🛍️ The store is currently closed. Check back soon!</div>
    <?php else: ?>
    <div class="mc-username-bar">
      <form method="post" style="display:flex; gap:8px; flex:1; flex-wrap:wrap; align-items:center;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="set_username">
        <label for="minecraft_username" style="margin:0; white-space:nowrap;"><?= $username ? 'Playing as' : 'Minecraft username' ?></label>
        <input type="text" id="minecraft_username" name="minecraft_username" value="<?= e($username ?? '') ?>" placeholder="Your in-game username" style="max-width:220px;" required pattern="\.?[A-Za-z0-9_]{3,16}" title="3-16 letters, numbers, underscores. Bedrock players: keep the leading &quot;.&quot; from Geyser.">
        <button type="submit" class="btn btn-outline btn-sm"><?= $username ? 'Change' : 'Set' ?></button>
      </form>
      <a href="<?= SITE_URL ?>/basket" class="btn btn-ghost btn-sm">🛒 View basket</a>
    </div>

    <?php if (!tebex_configured()): ?>
      <div class="empty-state">The store isn't connected yet. Check back soon.</div>
    <?php elseif (empty($categories)): ?>
      <div class="empty-state">No packages are listed yet — check back soon.</div>
    <?php else: ?>
      <?php foreach ($categories as $cat): ?>
        <?php $packages = $cat['packages'] ?? []; if (empty($packages)) continue; ?>
        <div class="store-category" data-reveal>
          <div class="store-category-head">
            <div>
              <h2><?= e($cat['name'] ?? 'Store') ?></h2>
              <?php if (!empty($cat['description'])): ?><p><?= e(truncate_text($cat['description'], 160)) ?></p><?php endif; ?>
            </div>
            <span class="badge store-category-count"><?= count($packages) ?> item<?= count($packages) === 1 ? '' : 's' ?></span>
          </div>
          <div class="package-grid">
            <?php foreach ($packages as $pkg): ?>
              <?php
                $price = $pkg['total_price'] ?? $pkg['price'] ?? null;
                $basePrice = $pkg['base_price'] ?? null;
                $currency = $pkg['currency'] ?? 'USD';
                $onSale = $basePrice !== null && $price !== null && (float)$basePrice > (float)$price;
                $isSubscription = ($pkg['type'] ?? '') === 'subscription';
                $priceHtml = ($onSale ? '<span class="was">' . e(tebex_format_price($basePrice, $currency)) . '</span>' : '')
                    . e(tebex_format_price($price, $currency)) . ($isSubscription ? '<span class="package-price-period">/mo</span>' : '');
                $desc = store_parse_description($pkg['description'] ?? '');
                $tags = [];
                if ($isSubscription) $tags[] = 'Subscription';
                if ($onSale) $tags[] = 'Sale';
              ?>
              <div class="package-card" data-package-card
                   data-package-id="<?= (int)($pkg['id'] ?? 0) ?>"
                   data-name="<?= e($pkg['name'] ?? 'Package') ?>"
                   data-intro="<?= e($desc['intro']) ?>"
                   data-features="<?= e(json_encode($desc['features'])) ?>"
                   data-tags="<?= e(json_encode($tags)) ?>"
                   data-price-html="<?= e($priceHtml) ?>"
                   data-image="<?= e($pkg['image'] ?? '') ?>">
                <div class="package-top">
                  <span class="package-icon<?= $isSubscription ? ' is-subscription' : '' ?>">
                    <?php if (!empty($pkg['image'])): ?>
                      <img src="<?= e($pkg['image']) ?>" alt="" loading="lazy">
                      <?php if ($isSubscription): ?><span class="package-icon-badge" title="Subscription">🔁</span><?php endif; ?>
                    <?php else: ?>
                      <?= $isSubscription ? '🔁' : '🛍️' ?>
                    <?php endif; ?>
                  </span>
                  <?php if (!empty($tags)): ?>
                    <div class="package-tags">
                      <?php foreach ($tags as $tag): ?><span class="pkg-tag pkg-tag-<?= e(strtolower($tag)) ?>"><?= e($tag) ?></span><?php endforeach; ?>
                    </div>
                  <?php endif; ?>
                </div>
                <div class="package-body">
                  <h3><?= e($pkg['name'] ?? 'Package') ?></h3>
                  <?php if ($desc['intro'] !== ''): ?><p class="package-desc"><?= e(truncate_text($desc['intro'], 120)) ?></p><?php endif; ?>
                  <?php if (!empty($desc['features'])): ?>
                    <ul class="package-features">
                      <?php foreach (array_slice($desc['features'], 0, 5) as $feature): ?><li><?= e($feature) ?></li><?php endforeach; ?>
                    </ul>
                  <?php endif; ?>
                </div>
                <div class="package-bottom">
                  <div class="package-price"><?= $priceHtml ?></div>
                  <form method="post" class="package-buy-form" data-package-form="<?= (int)($pkg['id'] ?? 0) ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="add_to_cart">
                    <input type="hidden" name="package_id" value="<?= (int)($pkg['id'] ?? 0) ?>">
                    <button type="submit" class="btn btn-primary btn-sm">Buy now</button>
                  </form>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<div class="package-modal-overlay" id="packageModalOverlay">
  <div class="package-modal" role="dialog" aria-modal="true" aria-labelledby="packageModalTitle">
    <button type="button" class="package-modal-close" id="packageModalClose" aria-label="Close">&times;</button>
    <img class="package-modal-image" id="packageModalImage" alt="" hidden>
    <div class="package-tags" id="packageModalTags"></div>
    <h2 id="packageModalTitle"></h2>
    <p class="package-modal-intro" id="packageModalIntro"></p>
    <ul class="package-features" id="packageModalFeatures"></ul>
    <div class="package-modal-footer">
      <div class="package-price" id="packageModalPrice"></div>
      <button type="button" class="btn btn-primary" id="packageModalBuy">Buy now</button>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

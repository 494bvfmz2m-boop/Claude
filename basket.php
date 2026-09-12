<?php
require_once __DIR__ . '/includes/bootstrap.php';

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = $_POST['action'] ?? '';
    $ident = current_basket_ident();

    if ($action === 'remove' && $ident) {
        $packageId = (int)($_POST['package_id'] ?? 0);
        $result = tebex_remove_package_from_basket($ident, $packageId);
        if ($result['ok']) {
            $updated = $result['data'];
            $count = 0;
            foreach (($updated['packages'] ?? []) as $p) $count += (int)($p['quantity'] ?? 1);
            $_SESSION['basket_item_count'] = $count;
        } else {
            $error = $result['error'] ?: 'Could not remove that item.';
        }
    }
}

$pageTitle = 'Your basket';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';

$basket = tebex_configured() ? get_active_basket() : null;
$items = $basket['packages'] ?? [];
$currency = $basket['currency'] ?? 'USD';
$total = $basket['total_price'] ?? $basket['subtotal'] ?? null;
?>
<section class="section">
  <div class="wrap" style="max-width: 720px;">
    <div class="section-head">
      <h2>🛒 Your basket</h2>
      <p>Review your items, then check out securely with Tebex.</p>
    </div>

    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>

    <?php if (!tebex_configured()): ?>
      <div class="empty-state">The store isn't connected yet.</div>
    <?php elseif (empty($items)): ?>
      <div class="empty-state">
        Your basket is empty.<br>
        <a href="<?= SITE_URL ?>/store" class="btn btn-primary" style="margin-top:14px;">Browse the store</a>
      </div>
    <?php else: ?>
      <?php foreach ($items as $item): ?>
        <div class="basket-row">
          <div class="basket-row-info">
            <strong><?= e($item['name'] ?? 'Package') ?></strong>
            <?php if (!empty($item['quantity']) && (int)$item['quantity'] > 1): ?><span class="muted"> × <?= (int)$item['quantity'] ?></span><?php endif; ?>
          </div>
          <div class="basket-row-price"><?= e(tebex_format_price($item['total_price'] ?? $item['price'] ?? null, $currency)) ?></div>
          <form method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="remove">
            <input type="hidden" name="package_id" value="<?= (int)($item['id'] ?? 0) ?>">
            <button type="submit" class="btn btn-outline btn-sm">Remove</button>
          </form>
        </div>
      <?php endforeach; ?>

      <div class="basket-summary">
        <span>Total</span>
        <span><?= e(tebex_format_price($total, $currency)) ?></span>
      </div>

      <?php if (!empty($basket['links']['checkout'])): ?>
        <a href="<?= e($basket['links']['checkout']) ?>" class="btn btn-primary btn-block">Checkout with Tebex</a>
      <?php endif; ?>
      <div style="text-align:center; margin-top:14px;">
        <a href="<?= SITE_URL ?>/store" class="muted">← Keep browsing the store</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

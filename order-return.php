<?php
require_once __DIR__ . '/includes/bootstrap.php';

// Whether the visitor actually completed checkout or just landed here, the
// basket they had is done with either way — stop counting it in the nav.
clear_basket_ident_cookie();
$_SESSION['basket_item_count'] = 0;

$pageTitle = 'Thank you';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<section class="section">
  <div class="wrap" style="max-width: 560px; text-align:center;">
    <div class="section-head">
      <h2>🦥 Thanks for your order!</h2>
      <p>Your purchase is being processed by Tebex. In-game rewards are usually delivered within a couple of minutes of joining the server — if anything looks off, reach out through <a href="<?= SITE_URL ?>/support">Support</a>.</p>
    </div>
    <a href="<?= SITE_URL ?>/store" class="btn btn-outline">Back to the store</a>
    <a href="<?= SITE_URL ?>" class="btn btn-primary">Back to home</a>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

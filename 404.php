<?php
require_once __DIR__ . '/includes/bootstrap.php';

http_response_code(404);

$pageTitle = 'Page not found';
$pageNoIndex = true;
require_once __DIR__ . '/includes/header.php';
?>
<section class="section">
  <div class="wrap" style="max-width: 640px; text-align:center;">
    <div class="section-head">
      <h2>🦥 404 — page not found</h2>
      <p>That page doesn't exist, or it moved.</p>
    </div>
    <a href="<?= SITE_URL ?>" class="btn btn-primary">Back to the homepage</a>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_permission('manage_store');
$me = current_user();

$pageTitle = 'Store';
$activeAdminPage = 'store';
require_once __DIR__ . '/../includes/header.php';

$orders = db_query("SELECT * FROM tebex_orders ORDER BY created_at DESC LIMIT 100");
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1>Store</h1>

    <div class="card">
      <h2 style="margin-top:0;">Connection status</h2>
      <?php if (tebex_configured()): ?>
        <p><span class="badge" style="color:var(--moss);border-color:rgba(124,179,66,.4);">connected</span> This site is talking to your Tebex webstore via the Headless API.</p>
      <?php else: ?>
        <p><span class="badge" style="color:#ffb3b3;border-color:rgba(255,107,107,.4);">not connected</span> Add your Public Token and Private Key to <code>includes/tebex_config.php</code> on the server (copy it from <code>includes/tebex_config.example.php</code>).</p>
      <?php endif; ?>
      <p class="muted">Packages, categories, and prices are managed in your <a href="https://creator.tebex.io" target="_blank" rel="noopener">Tebex Creator Panel</a> — this site just displays and sells whatever you set up there. To log completed orders below, add a webhook in the Creator Panel pointing to <code><?= e(SITE_URL) ?>/api/tebex_webhook</code>.</p>
    </div>

    <h2 style="margin-top:32px;">Recent orders</h2>
    <?php if (empty($orders)): ?>
      <p class="muted">No orders logged yet. This list only fills in once the Tebex webhook is configured (see above) — the store itself works fine either way.</p>
    <?php else: ?>
      <table>
        <tr><th>Player</th><th>Total</th><th>Email</th><th>Received</th></tr>
        <?php foreach ($orders as $o): ?>
          <tr>
            <td><?= e($o['minecraft_username'] ?? '—') ?></td>
            <td><?= e(tebex_format_price($o['total'], $o['currency'] ?? 'USD')) ?></td>
            <td class="muted"><?= e($o['email'] ?? '—') ?></td>
            <td class="muted"><?= e(time_ago($o['created_at'])) ?></td>
          </tr>
        <?php endforeach; ?>
      </table>
    <?php endif; ?>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>

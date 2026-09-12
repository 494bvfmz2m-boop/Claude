</main>

<footer class="site-footer">
  <div class="wrap footer-inner">
    <div>
      <img src="<?= SITE_URL ?>/assets/img/logo-small.png?v=<?= ASSET_VERSION ?>" alt="" class="brand-mark">
      <strong><?= e($settings['site_name'] ?? SITE_NAME) ?></strong>
      <p class="muted">A chill SMP for chill people.</p>
    </div>
    <div class="footer-links">
      <a href="<?= SITE_URL ?>/rules">Server Rules</a>
      <a href="<?= SITE_URL ?>/staff">Staff</a>
      <a href="<?= SITE_URL ?>/announcements">Announcements</a>
      <?php if (store_is_enabled($settings)): ?><a href="<?= SITE_URL ?>/store">Store</a><?php endif; ?>
      <?php if (!empty($settings['discord_invite'])): ?>
        <a href="<?= e($settings['discord_invite']) ?>" target="_blank" rel="noopener">Discord</a>
      <?php endif; ?>
    </div>
    <div class="footer-links footer-contact">
      <a href="mailto:<?= e(SITE_EMAIL) ?>"><?= e(SITE_EMAIL) ?></a>
    </div>
    <div class="muted footer-copy">
      &copy; <?= date('Y') ?> <?= e($settings['site_name'] ?? SITE_NAME) ?>. Not affiliated with Mojang or Microsoft.
    </div>
  </div>
</footer>

<script src="<?= SITE_URL ?>/assets/js/main.js?v=<?= ASSET_VERSION ?>"></script>
</body>
</html>

<?php
require_once __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Home';
$settingsForMeta = db_read('settings', []);
$pageDescription = $settingsForMeta['banner_text'] ?? 'A chill Minecraft SMP — join the server, read the rules, and see who\'s online.';
require_once __DIR__ . '/includes/header.php';

$posts = get_posts();

$announcements = array_values(array_filter($posts, fn($p) => ($p['type'] ?? 'post') === 'announcement'));
$announcements = array_slice($announcements, 0, 5);

$regularPosts = array_values(array_filter($posts, fn($p) => ($p['type'] ?? 'post') !== 'announcement'));
$regularPosts = array_slice($regularPosts, 0, 3);
?>

<section class="hero">
  <div class="wrap">
    <img src="<?= SITE_URL ?>/assets/img/logo.png?v=<?= ASSET_VERSION ?>" alt="<?= e($settings['site_name'] ?? SITE_NAME) ?> logo" class="hero-logo">
    <h1><?= e($settings['site_name'] ?? SITE_NAME) ?> is <span>live</span></h1>
    <p class="lede"><?= e($settings['banner_text'] ?? '') ?></p>
    <div class="hero-actions">
      <a href="#status" class="btn btn-primary">See who's online</a>
      <a href="<?= SITE_URL ?>/rules" class="btn btn-outline">Read the rules</a>
      <a href="<?= SITE_URL ?>/store" class="btn btn-outline">Visit the store</a>
    </div>

    <div class="status-card" id="status">
      <div class="status-row">
        <div class="status-title">🦥 Server status</div>
        <span class="status-pill" id="overallPill">Checking…</span>
      </div>
      <div class="status-grid">
        <div class="status-block">
          <div class="label">Java Edition</div>
          <code><?= e($settings['java_ip'] ?? '') ?></code>
          <div class="status-players" id="javaPlayers">—</div>
          <div class="player-list" id="javaPlayerList"></div>
        </div>
        <div class="status-block">
          <div class="label">Bedrock Edition</div>
          <code><?= e($settings['bedrock_ip'] ?? '') ?><?php if (!empty($settings['bedrock_port'])): ?>:<?= e($settings['bedrock_port']) ?><?php endif; ?></code>
          <div class="status-players" id="bedrockPlayers">—</div>
          <div class="player-list" id="bedrockPlayerList"></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2>📣 Announcements</h2>
      <p>Official word from the <?= e($settings['site_name'] ?? SITE_NAME) ?> team</p>
    </div>

    <?php if (empty($announcements)): ?>
      <p class="muted" style="text-align:center;">No announcements yet — check back soon.</p>
    <?php else: ?>
      <div class="announce-strip">
        <?php foreach ($announcements as $p): ?>
          <div class="announce-item">
            <span class="announce-icon">🦥</span>
            <div>
              <h3><a href="<?= SITE_URL ?>/post?id=<?= (int)$p['id'] ?>"><?= e($p['title']) ?></a></h3>
              <p class="post-meta">by <?= author_badge_html($p['author_id'] ?? null, $p['author_name']) ?> <span class="muted">· <?= e(time_ago($p['created_at'])) ?></span></p>
              <p><?= e(truncate_text($p['content'], 160)) ?></p>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
      <div style="text-align:center; margin-top:12px;">
        <a href="<?= SITE_URL ?>/announcements" class="btn btn-outline btn-sm">View all announcements</a>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if (!empty($regularPosts)): ?>
<section class="section" style="padding-top:0;">
  <div class="wrap">
    <div class="section-head">
      <h2>Latest posts</h2>
      <p>What's new around the SMP</p>
    </div>
    <?php foreach ($regularPosts as $p): ?>
      <div class="card post-card">
        <div class="post-meta">
          <span class="post-type-tag"><?= e($p['type'] ?? 'post') ?></span>
          <span>by <?= author_badge_html($p['author_id'] ?? null, $p['author_name']) ?></span>
          <span>· <?= e(time_ago($p['created_at'])) ?></span>
        </div>
        <h3><a href="<?= SITE_URL ?>/post?id=<?= (int)$p['id'] ?>"><?= e($p['title']) ?></a></h3>
        <p class="post-excerpt"><?= e(truncate_text($p['content'], 180)) ?></p>
      </div>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

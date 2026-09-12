<?php
require_once __DIR__ . '/includes/bootstrap.php';

$pageTitle = 'Announcements';
$pageDescription = 'Everything posted by the team.';
require_once __DIR__ . '/includes/header.php';

$allPosts = get_posts();

$perPage = 12;
$totalPages = max(1, (int)ceil(count($allPosts) / $perPage));
$page = max(1, min($totalPages, (int)($_GET['page'] ?? 1)));
$posts = array_slice($allPosts, ($page - 1) * $perPage, $perPage);
?>
<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2>Announcements</h2>
      <p>Everything posted by the team</p>
    </div>

    <?php if (empty($posts)): ?>
      <p class="muted" style="text-align:center;">Nothing posted yet — check back soon.</p>
    <?php else: ?>
      <?php foreach ($posts as $p): ?>
        <div class="card post-card" data-reveal>
          <div class="post-meta">
            <span class="post-type-tag<?= ($p['type'] ?? 'post') === 'announcement' ? ' announcement' : '' ?>"><?= e($p['type'] ?? 'post') ?></span>
            <span>by <?= author_badge_html($p['author_id'] ?? null, $p['author_name']) ?></span>
            <span>· <?= e(time_ago($p['created_at'])) ?></span>
          </div>
          <h3><a href="<?= SITE_URL ?>/post?id=<?= (int)$p['id'] ?>"><?= e($p['title']) ?></a></h3>
          <p class="post-excerpt"><?= e(truncate_text($p['content'], 220)) ?></p>
        </div>
      <?php endforeach; ?>

      <?php if ($totalPages > 1): ?>
        <div style="display:flex; justify-content:center; gap:10px; margin-top:24px;">
          <?php if ($page > 1): ?>
            <a href="<?= SITE_URL ?>/announcements?page=<?= $page - 1 ?>" class="btn btn-outline btn-sm">← Newer</a>
          <?php endif; ?>
          <span class="muted" style="align-self:center; font-size:0.85rem;">Page <?= $page ?> of <?= $totalPages ?></span>
          <?php if ($page < $totalPages): ?>
            <a href="<?= SITE_URL ?>/announcements?page=<?= $page + 1 ?>" class="btn btn-outline btn-sm">Older →</a>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

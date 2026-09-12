<?php
require_once __DIR__ . '/includes/bootstrap.php';

$id = (int)($_GET['id'] ?? 0);
$post = find_post_by_id($id);

if (!$post) {
    http_response_code(404);
}

$pageTitle = $post ? $post['title'] : 'Not found';
if (!$post) {
    $pageNoIndex = true;
} else {
    $pageDescription = truncate_text($post['content'], 160);
}
require_once __DIR__ . '/includes/header.php';
?>
<section class="section">
  <div class="wrap" style="max-width: 760px;">
    <?php if (!$post): ?>
      <div class="section-head">
        <h2>Post not found</h2>
        <p><a href="<?= SITE_URL ?>/announcements">Back to announcements</a></p>
      </div>
    <?php else: ?>
      <div class="post-meta">
        <span class="post-type-tag<?= ($post['type'] ?? 'post') === 'announcement' ? ' announcement' : '' ?>"><?= e($post['type'] ?? 'post') ?></span>
        <span>by <?= author_badge_html($post['author_id'] ?? null, $post['author_name']) ?></span>
        <span>· <?= e(time_ago($post['created_at'])) ?></span>
      </div>
      <h1><?= e($post['title']) ?></h1>
      <div class="card post-body"><?= e($post['content']) ?></div>
    <?php endif; ?>
  </div>
</section>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

<?php
require_once __DIR__ . '/includes/functions.php';

$currentPage = 'posts';
$pageTitle = 'Posts';
$pageDescription = 'Updates, notes, and announcements from Xyphros Studios.';

$posts = Content::all('posts');
$posts = array_filter($posts, fn($p) => !empty($p['published']));
usort($posts, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="container">
        <span class="eyebrow">From the studio</span>
        <h1>Posts</h1>
        <p class="lede lede--center">Notes on what we're building, shipping, and learning.</p>
    </div>
</section>

<section class="section">
    <div class="container">
        <?php if (empty($posts)): ?>
            <div class="empty-state">
                <div class="empty-state__icon">&#128221;</div>
                <p style="margin:0;">No posts yet. Be the first to write one &mdash; check back soon.</p>
            </div>
        <?php else: ?>
            <div class="grid grid--3">
                <?php foreach ($posts as $post): ?>
                    <a href="/posts/<?php echo urlencode($post['slug']); ?>" class="post-card">
                        <?php if (!empty($post['cover'])): ?>
                            <div class="post-card__cover"><img src="<?php echo e($post['cover']); ?>" alt=""></div>
                        <?php endif; ?>
                        <div class="post-card__body">
                            <div class="post-date"><?php echo e(format_date($post['created_at'] ?? '')); ?><?php if (!empty($post['author_id']) || !empty($post['author_name'])): ?> &middot; <?php echo e(post_author($post)['name']); ?><?php endif; ?></div>
                            <h3><?php echo e($post['title']); ?></h3>
                            <p><?php echo e($post['excerpt']); ?></p>
                            <span class="read-more">Read more &rarr;</span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

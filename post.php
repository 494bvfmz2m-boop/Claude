<?php
require_once __DIR__ . '/includes/functions.php';

$slug = $_GET['slug'] ?? '';
$posts = Content::all('posts');
$post = null;
foreach ($posts as $p) {
    if (($p['slug'] ?? '') === $slug && !empty($p['published'])) {
        $post = $p;
        break;
    }
}

if (!$post) {
    http_response_code(404);
    $currentPage = 'posts';
    $pageTitle = 'Post not found';
    require __DIR__ . '/includes/header.php';
    ?>
    <section class="section text-center">
        <div class="container">
            <span class="eyebrow">404</span>
            <h1>We couldn't find that post</h1>
            <p class="lede lede--center">It may have been moved or unpublished.</p>
            <div class="btn-row" style="justify-content:center;">
                <a href="/posts" class="btn btn--primary">Back to posts</a>
            </div>
        </div>
    </section>
    <?php
    require __DIR__ . '/includes/footer.php';
    exit;
}

$currentPage = 'posts';
$pageTitle = $post['title'];
$pageDescription = $post['excerpt'] ?? SITE_TAGLINE;

require __DIR__ . '/includes/header.php';
?>

<section class="section--tight">
    <div class="container" style="max-width: 740px;">
        <div class="post-date" style="margin-bottom:14px;"><?php echo e(format_date($post['created_at'] ?? '')); ?></div>
        <h1 style="font-size:clamp(28px,4vw,42px); text-align:left;"><?php echo e($post['title']); ?></h1>
        <?php if (!empty($post['author_id']) || !empty($post['author_name'])):
            $author = post_author($post); ?>
        <div style="display:flex;align-items:center;gap:10px;margin-top:16px;">
            <?php if (!empty($author['avatar'])): ?>
                <img src="<?php echo e($author['avatar']); ?>" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">
            <?php endif; ?>
            <span style="font-size:14px;color:var(--text-muted);">By <?php echo e($author['name']); ?></span>
        </div>
        <?php endif; ?>
    </div>
</section>

<?php if (!empty($post['cover'])): ?>
<section class="container" style="max-width: 900px;">
    <div style="border-radius: var(--radius-lg); overflow:hidden; border:1px solid var(--border); margin-bottom: 20px;">
        <img src="<?php echo e($post['cover']); ?>" alt="">
    </div>
</section>
<?php endif; ?>

<section class="section--tight">
    <div class="container" style="max-width: 740px;">
        <div style="font-size:17px; color: var(--text);">
            <?php echo render_post_body($post['body'] ?? ''); ?>
        </div>
        <div style="margin-top:48px;">
            <a href="/posts" class="btn btn--ghost btn--sm">&larr; Back to all posts</a>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>

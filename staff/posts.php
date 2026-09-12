<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_posts');

$navPage = 'posts';
$pageTitle = 'Posts';

$posts = Content::all('posts');
usort($posts, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Posts</h1>
        <p>Write, edit, and publish updates for the blog.</p>
    </div>
    <a href="/staff/post-edit" class="btn btn--primary btn--sm">New post</a>
</div>

<?php if (empty($posts)): ?>
    <div class="empty-state">
        <div class="empty-state__icon"><?php echo xs_icon('doc', 26); ?></div>
        <p style="margin:0;">No posts yet. <a href="/staff/post-edit" style="color:var(--magenta); font-weight:700;">Write the first one</a>.</p>
    </div>
<?php else: ?>
    <div class="table-wrap">
        <table class="staff-table">
            <thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
                <?php foreach ($posts as $post): ?>
                    <tr>
                        <td><?php echo e($post['title']); ?><br><span class="badge-muted">/posts/<?php echo e($post['slug'] ?? ''); ?></span></td>
                        <td><?php echo (!empty($post['author_id']) || !empty($post['author_name'])) ? e(post_author($post)['name']) : '&mdash;'; ?></td>
                        <td><?php echo !empty($post['published']) ? '<span class="status-pill status--online">Published</span>' : '<span class="status-pill status--soon">Draft</span>'; ?></td>
                        <td><?php echo e(format_date($post['created_at'] ?? '')); ?></td>
                        <td class="actions">
                            <a href="/staff/post-edit?id=<?php echo e($post['id']); ?>" class="btn btn--ghost btn--sm">Edit</a>
                            <form action="/staff/post-delete" method="post" onsubmit="return confirm('Delete this post? This cannot be undone.');">
                                <?php csrf_field(); ?>
                                <input type="hidden" name="id" value="<?php echo e($post['id']); ?>">
                                <button type="submit" class="btn btn--danger btn--sm">Delete</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_docs');

$navPage = 'docs';
$pageTitle = 'Docs & Wiki';

$groups = xs_docs_grouped(false);

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Docs &amp; Wiki</h1>
        <p>Help articles and internal knowledge, published at <a href="/docs" target="_blank">/docs</a>.</p>
    </div>
    <a href="/staff/doc-edit" class="btn btn--primary btn--sm">New page</a>
</div>

<?php if (empty($groups)): ?>
    <div class="empty-state">
        <div class="empty-state__icon"><?php echo xs_icon('doc', 26); ?></div>
        <p style="margin:0;">No pages yet. <a href="/staff/doc-edit" style="color:var(--magenta); font-weight:700;">Write the first one</a>.</p>
    </div>
<?php else: ?>
    <?php foreach ($groups as $group): ?>
        <div class="staff-card" style="margin-bottom:20px;">
            <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);margin-bottom:16px;"><?php echo e($group['category']); ?></h2>
            <div class="table-wrap">
                <table class="staff-table">
                    <thead><tr><th>Title</th><th>Order</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
                    <tbody>
                        <?php foreach ($group['pages'] as $page): ?>
                            <tr>
                                <td><?php echo e($page['title']); ?><br><span class="badge-muted">/docs/<?php echo e($page['slug'] ?? ''); ?></span></td>
                                <td><?php echo (int) ($page['sort_order'] ?? 0); ?></td>
                                <td><?php echo !empty($page['published']) ? '<span class="status-pill status--online">Published</span>' : '<span class="status-pill status--soon">Draft</span>'; ?></td>
                                <td><?php echo e(format_date($page['updated_at'] ?? $page['created_at'] ?? '')); ?></td>
                                <td class="actions">
                                    <a href="/staff/doc-edit?id=<?php echo e($page['id']); ?>" class="btn btn--ghost btn--sm">Edit</a>
                                    <form action="/staff/doc-delete" method="post" onsubmit="return confirm('Delete this page? This cannot be undone.');">
                                        <?php csrf_field(); ?>
                                        <input type="hidden" name="id" value="<?php echo e($page['id']); ?>">
                                        <button type="submit" class="btn btn--danger btn--sm">Delete</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endforeach; ?>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

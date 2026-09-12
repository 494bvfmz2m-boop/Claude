<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('view_messages');

$navPage = 'messages';
$pageTitle = 'Messages';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $id = $_POST['id'] ?? null;
    $action = $_POST['action'] ?? '';
    if ($action === 'delete') {
        Content::delete('messages', $id);
    } elseif ($action === 'mark_read') {
        Content::update('messages', $id, ['read' => true]);
    }
    header('Location: /staff/messages');
    exit;
}

$messages = Content::all('messages');
usort($messages, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Messages</h1>
        <p>Submissions from the public contact form.</p>
    </div>
</div>

<?php if (empty($messages)): ?>
    <div class="empty-state">
        <div class="empty-state__icon"><?php echo xs_icon('inbox', 26); ?></div>
        <p style="margin:0;">No messages yet.</p>
    </div>
<?php else: ?>
    <?php foreach ($messages as $m): ?>
        <div class="staff-card" style="<?php echo empty($m['read']) ? 'border-color:var(--border-strong);' : ''; ?>">
            <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px;">
                <div>
                    <strong><?php echo e($m['subject']); ?></strong>
                    <?php if (empty($m['read'])): ?><span class="status-pill status--beta" style="margin-left:8px;">New</span><?php endif; ?>
                    <div class="badge-muted" style="margin-top:4px;">
                        <?php echo e($m['name']); ?> &middot; <a href="mailto:<?php echo e($m['email']); ?>" style="color:var(--text-faint);"><?php echo e($m['email']); ?></a> &middot; <?php echo e(format_date($m['created_at'] ?? '')); ?>
                    </div>
                </div>
                <div class="btn-row">
                    <?php if (empty($m['read'])): ?>
                    <form method="post">
                        <?php csrf_field(); ?>
                        <input type="hidden" name="id" value="<?php echo e($m['id']); ?>">
                        <input type="hidden" name="action" value="mark_read">
                        <button type="submit" class="btn btn--ghost btn--sm">Mark read</button>
                    </form>
                    <?php endif; ?>
                    <form method="post" onsubmit="return confirm('Delete this message?');">
                        <?php csrf_field(); ?>
                        <input type="hidden" name="id" value="<?php echo e($m['id']); ?>">
                        <input type="hidden" name="action" value="delete">
                        <button type="submit" class="btn btn--danger btn--sm">Delete</button>
                    </form>
                </div>
            </div>
            <p style="margin:0;white-space:pre-wrap;font-size:13.5px;color:var(--text-muted);"><?php echo e($m['message']); ?></p>
            <div class="btn-row" style="margin-top:14px;">
                <a href="/staff/email?to=<?php echo rawurlencode($m['email']); ?>&subject=<?php echo rawurlencode('Re: ' . $m['subject']); ?>" class="btn btn--ghost btn--sm">Reply via Email tab &rarr;</a>
            </div>
        </div>
    <?php endforeach; ?>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

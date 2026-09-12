<?php
require_once __DIR__ . '/includes/staff-auth.php';

$navPage = 'dashboard';
$pageTitle = 'Dashboard';

$postsCount = Content::count('posts');
$productsCount = Content::count('products');
$messages = Content::all('messages');
$unreadCount = count(array_filter($messages, fn($m) => empty($m['read'])));
$openTicketsCount = count(SupportTicket::all('open'));

$recentSignups = XyphrosAuth::db()->query(
    "SELECT id, username, email, name, avatar, created_at FROM users ORDER BY created_at DESC LIMIT 6"
)->fetchAll();

$recentAudit = $isFounder ? AuditLog::recent(8) : [];

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Dashboard</h1>
        <p>Welcome back<?php echo !empty($currentStaffUser['name']) ? ', ' . e(explode(' ', $currentStaffUser['name'])[0]) : ''; ?>. Here's what's going on across Xyphros.</p>
    </div>
</div>

<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-card__icon"><?php echo xs_icon('doc', 17); ?></div>
        <div><span class="num"><?php echo $postsCount; ?></span><span class="label">Posts</span></div>
    </div>
    <div class="stat-card">
        <div class="stat-card__icon"><?php echo xs_icon('box', 17); ?></div>
        <div><span class="num"><?php echo $productsCount; ?></span><span class="label">Products</span></div>
    </div>
    <div class="stat-card">
        <div class="stat-card__icon"><?php echo xs_icon('inbox', 17); ?></div>
        <div><span class="num"><?php echo $unreadCount; ?></span><span class="label">Unread messages</span></div>
    </div>
    <?php if (Permissions::can($currentStaffUser, 'manage_support')): ?>
    <div class="stat-card">
        <div class="stat-card__icon"><?php echo xs_icon('chat', 17); ?></div>
        <div><span class="num"><?php echo $openTicketsCount; ?></span><span class="label">Open support chats</span></div>
    </div>
    <?php endif; ?>
</div>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('plus', 18); ?></div>
        <h3>Quick actions</h3>
    </div>
    <div class="btn-row">
        <?php if (Permissions::can($currentStaffUser, 'manage_posts')): ?><a href="/staff/post-edit" class="btn btn--primary btn--sm">New post</a><?php endif; ?>
        <?php if (Permissions::can($currentStaffUser, 'manage_products')): ?><a href="/staff/product-edit" class="btn btn--ghost btn--sm">Add product</a><?php endif; ?>
        <?php if (Permissions::can($currentStaffUser, 'manage_team')): ?><a href="/staff/team-edit" class="btn btn--ghost btn--sm">Add team member</a><?php endif; ?>
        <?php if (Permissions::can($currentStaffUser, 'manage_support')): ?><a href="/staff/tickets" class="btn btn--ghost btn--sm">Support inbox</a><?php endif; ?>
        <?php if (Permissions::can($currentStaffUser, 'view_messages')): ?><a href="/staff/messages" class="btn btn--ghost btn--sm">View messages</a><?php endif; ?>
        <?php if ($isFounder || Permissions::can($currentStaffUser, 'manage_accounts')): ?>
        <a href="/staff/accounts" class="btn btn--ghost btn--sm">Find an account</a>
        <?php endif; ?>
    </div>
</div>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('users', 18); ?></div>
        <h3>Recently joined</h3>
    </div>
    <?php foreach ($recentSignups as $u): ?>
        <div class="acc-summary">
            <?php if (!empty($u['avatar'])): ?>
                <img src="<?php echo e($u['avatar']); ?>" class="acc-avatar" alt="">
            <?php else: ?>
                <span class="acc-avatar-fallback"><?php echo e(strtoupper(substr($u['name'] ?: $u['username'], 0, 1))); ?></span>
            <?php endif; ?>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13.5px;"><?php echo e($u['name'] ?: $u['username']); ?></div>
                <div style="color:var(--text-faint);font-size:12px;"><?php echo e($u['email']); ?></div>
            </div>
            <span class="badge-muted"><?php echo e(time_ago($u['created_at'])); ?></span>
        </div>
    <?php endforeach; ?>
</div>

<?php if ($isFounder && !empty($recentAudit)): ?>
<div class="staff-card">
    <div class="staff-card__head" style="justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div class="staff-card__icon"><?php echo xs_icon('clock', 18); ?></div>
            <h3>Recent activity</h3>
        </div>
        <a href="/staff/audit" style="font-size:12px;font-weight:600;color:var(--magenta);">View all &rarr;</a>
    </div>
    <?php foreach ($recentAudit as $entry): ?>
        <div class="audit-row">
            <div class="audit-icon"><?php echo xs_icon('shield', 14); ?></div>
            <div style="flex:1;min-width:0;">
                <div><strong><?php echo e($entry['actor_name']); ?></strong> &middot; <?php echo e($entry['detail']); ?></div>
                <?php if ($entry['target_label']): ?><div class="audit-detail">Target: <?php echo e($entry['target_label']); ?></div><?php endif; ?>
            </div>
            <span class="audit-time"><?php echo e(time_ago($entry['created_at'])); ?></span>
        </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

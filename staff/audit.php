<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_founder();

$navPage = 'audit';
$pageTitle = 'Audit Log';

$entries = AuditLog::recent(200);

$actionLabels = [
    'account_locked'      => ['label' => 'Account locked',       'icon' => 'lock'],
    'account_unlocked'    => ['label' => 'Account unlocked',     'icon' => 'lock'],
    'password_reset'      => ['label' => 'Password reset',       'icon' => 'key'],
    'session_revoked'     => ['label' => 'Device signed out',    'icon' => 'monitor'],
    'all_sessions_revoked'=> ['label' => 'All devices signed out','icon' => 'monitor'],
    'staff_granted'       => ['label' => 'Staff access granted', 'icon' => 'shield'],
    'staff_revoked'       => ['label' => 'Staff access revoked', 'icon' => 'shield'],
];

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Audit Log</h1>
        <p>Every sensitive action taken from this site: who did what, and to which account.</p>
    </div>
</div>

<div class="staff-card">
    <?php if (empty($entries)): ?>
        <p style="color:var(--text-muted);margin:0;">Nothing logged yet.</p>
    <?php else: foreach ($entries as $entry):
        $meta = $actionLabels[$entry['action']] ?? ['label' => $entry['action'], 'icon' => 'shield'];
    ?>
        <div class="audit-row">
            <div class="audit-icon"><?php echo xs_icon($meta['icon'], 14); ?></div>
            <div style="flex:1;min-width:0;">
                <div><strong><?php echo e($entry['actor_name']); ?></strong> &mdash; <?php echo e($meta['label']); ?></div>
                <div class="audit-detail">
                    <?php echo e($entry['detail']); ?>
                    <?php if ($entry['target_label']): ?> &middot; Target: <strong><?php echo e($entry['target_label']); ?></strong><?php endif; ?>
                    <?php if ($entry['ip']): ?> &middot; <?php echo e($entry['ip']); ?><?php endif; ?>
                </div>
            </div>
            <span class="audit-time"><?php echo e(date('M j, g:ia', strtotime($entry['created_at']))); ?></span>
        </div>
    <?php endforeach; endif; ?>
</div>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_founder();

$navPage = 'permissions';
$pageTitle = 'Permissions';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok()) {
    $targetId = $_POST['target_id'] ?? '';
    $target = XyphrosAuth::findById($targetId);
    if ($target && !empty($target['is_xyphros_staff'])) {
        $perms = [];
        foreach (array_keys(Permissions::ALL) as $key) {
            $perms[$key] = isset($_POST['perm_' . $key]);
        }
        Permissions::set($targetId, $perms);
        AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'permissions_updated', $targetId, $target['email'], 'Updated staff permissions');
        $success = 'Permissions updated for ' . ($target['name'] ?: $target['username']) . '.';
    }
}

$staffList = XyphrosAuth::db()->query(
    "SELECT id, username, email, name, avatar FROM users WHERE is_xyphros_staff = 1 AND is_super_admin = 0 ORDER BY username ASC"
)->fetchAll();

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Permissions</h1>
        <p>What each Xyphros staff member can actually do, beyond just having basic access. Founders always have everything: this only affects everyone else.</p>
    </div>
</div>

<?php if ($success): ?><div class="alert alert--success"><?php echo e($success); ?></div><?php endif; ?>

<?php if (empty($staffList)): ?>
    <div class="empty-state">
        <div class="empty-state__icon"><?php echo xs_icon('lock', 26); ?></div>
        <p style="margin:0;">Nobody has basic Xyphros staff access yet. Grant that first from <a href="/staff/access?product=xyphros" style="color:var(--magenta);">Staff Access</a>, then come back here to set what they can do.</p>
    </div>
<?php else: foreach ($staffList as $person): $perms = Permissions::get($person['id']); ?>
    <div class="staff-card">
        <div class="acc-summary" style="border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:16px;">
            <?php if (!empty($person['avatar'])): ?>
                <img src="<?php echo e($person['avatar']); ?>" class="acc-avatar" alt="">
            <?php else: ?>
                <span class="acc-avatar-fallback"><?php echo e(strtoupper(substr($person['name'] ?: $person['username'], 0, 1))); ?></span>
            <?php endif; ?>
            <div>
                <strong><?php echo e($person['name'] ?: $person['username']); ?></strong>
                <div style="color:var(--text-muted);font-size:12.5px;"><?php echo e($person['email']); ?></div>
            </div>
        </div>
        <form method="post">
            <?php csrf_field(); ?>
            <input type="hidden" name="target_id" value="<?php echo e($person['id']); ?>">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:16px;">
                <?php foreach (Permissions::ALL as $key => $label): ?>
                    <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:13px;line-height:1.4;">
                        <input type="checkbox" name="perm_<?php echo e($key); ?>" style="width:auto;margin-top:2px;" <?php echo $perms[$key] ? 'checked' : ''; ?>>
                        <span><?php echo e($label); ?></span>
                    </label>
                <?php endforeach; ?>
            </div>
            <button type="submit" class="btn btn--primary btn--sm">Save permissions</button>
        </form>
    </div>
<?php endforeach; endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

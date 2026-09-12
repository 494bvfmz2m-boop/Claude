<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_team');

$navPage = 'team';
$pageTitle = 'Team';
$team = Content::all('team');

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Team</h1>
        <p>Shown on the About page.</p>
    </div>
    <a href="/staff/team-edit" class="btn btn--primary btn--sm">Add team member</a>
</div>

<?php if (empty($team)): ?>
    <div class="empty-state">
        <div class="empty-state__icon"><?php echo xs_icon('users', 26); ?></div>
        <p style="margin:0;">No team members yet. <a href="/staff/team-edit" style="color:var(--magenta); font-weight:700;">Add one</a>.</p>
    </div>
<?php else: ?>
    <div class="table-wrap">
        <table class="staff-table">
            <thead><tr><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
                <?php foreach ($team as $member): ?>
                    <tr>
                        <td><?php echo e($member['name']); ?></td>
                        <td><?php echo e($member['role']); ?></td>
                        <td class="actions">
                            <a href="/staff/team-edit?id=<?php echo e($member['id']); ?>" class="btn btn--ghost btn--sm">Edit</a>
                            <form action="/staff/team-delete" method="post" onsubmit="return confirm('Remove this team member?');">
                                <?php csrf_field(); ?>
                                <input type="hidden" name="id" value="<?php echo e($member['id']); ?>">
                                <button type="submit" class="btn btn--danger btn--sm">Remove</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

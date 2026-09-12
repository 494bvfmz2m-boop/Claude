<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_team');

$editId = $_GET['id'] ?? null;
$existing = $editId ? Content::find('team', $editId) : null;

$navPage = 'team';
$pageTitle = $existing ? 'Edit team member' : 'Add team member';
$error = null;
$notice = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } elseif (($_POST['action'] ?? 'save') === 'fetch_discord') {
        // Only ever updates the photo — name/role are left completely alone.
        $id = $_POST['id'] ?? null;
        $discordId = trim($_POST['discord_id'] ?? '');
        [$ok, $result] = discord_fetch_avatar_url($discordId);
        if (!$ok) {
            $error = $result;
        } else {
            Content::update('team', $id, ['photo' => $result, 'discord_id' => $discordId]);
            $notice = 'Avatar pulled from Discord.';
            $existing = Content::find('team', $id);
        }
    } else {
        $name = trim($_POST['name'] ?? '');
        $role = trim($_POST['role'] ?? '');
        $id = $_POST['id'] ?? null;

        if ($name === '') {
            $error = 'Name is required.';
        } else {
            try {
                $photo = handle_image_upload('photo', UPLOADS_DIR . '/team', SITE_URL . UPLOADS_URL . '/team');
            } catch (RuntimeException $ex) {
                $error = $ex->getMessage();
                $photo = null;
            }

            if (!$error) {
                $words = preg_split('/\s+/', trim($name));
                $initials = strtoupper((count($words) > 1 ? $words[0][0] . end($words)[0] : mb_substr($name, 0, 1)));
                $fields = [
                    'name' => $name, 'role' => $role, 'initials' => $initials,
                    'discord_id' => trim($_POST['discord_id'] ?? '') ?: null,
                ];
                if (!$id) {
                    $fields['photo'] = $photo;
                    Content::insert('team', $fields);
                } else {
                    if ($photo) {
                        delete_uploaded_file($existing['photo'] ?? null);
                        $fields['photo'] = $photo;
                    }
                    Content::update('team', $id, $fields);
                }
                header('Location: /staff/team');
                exit;
            }
        }
    }
}

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1><?php echo $existing ? 'Edit team member' : 'Add team member'; ?></h1>
        <p>Shown on the About page.</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>
<?php if ($notice): ?><div class="alert alert--success"><?php echo e($notice); ?></div><?php endif; ?>

<form class="staff-form" method="post" enctype="multipart/form-data">
    <?php csrf_field(); ?>
    <input type="hidden" name="action" value="save">
    <?php if ($existing): ?><input type="hidden" name="id" value="<?php echo e($existing['id']); ?>"><?php endif; ?>

    <div class="field">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required maxlength="80" value="<?php echo e($_POST['name'] ?? $existing['name'] ?? ''); ?>">
    </div>
    <div class="field">
        <label for="role">Role</label>
        <input type="text" id="role" name="role" maxlength="80" placeholder="e.g. Founder" value="<?php echo e($_POST['role'] ?? $existing['role'] ?? ''); ?>">
    </div>
    <div class="field">
        <label for="photo">Photo</label>
        <?php if (!empty($existing['photo'])): ?>
            <div class="current-image">
                <img src="<?php echo e($existing['photo']); ?>" alt="">
                <span class="field--hint">Current photo &mdash; upload a new file to replace it.</span>
            </div>
        <?php endif; ?>
        <input type="file" id="photo" name="photo" accept=".jpg,.jpeg,.png,.gif,.webp">
        <div class="field--hint">Optional. Falls back to initials on a gradient circle if left blank.</div>
    </div>

    <div class="btn-row">
        <button type="submit" class="btn btn--primary"><?php echo $existing ? 'Save changes' : 'Add team member'; ?></button>
        <a href="/staff/team" class="btn btn--ghost">Cancel</a>
    </div>
</form>

<?php if ($existing): ?>
<div class="staff-card" style="margin-top:20px;max-width:640px;">
    <h3>Pull photo from Discord</h3>
    <p style="color:var(--text-muted);font-size:13.5px;margin-bottom:16px;">
        Fetches their current Discord avatar and uses it as this person's photo. This never touches the name or role above.
        <?php if (empty(constant('DISCORD_BOT_TOKEN'))): ?><br><strong>Not set up yet.</strong> Add a bot token to <code>DISCORD_BOT_TOKEN</code> in <code>includes/config.php</code> first.<?php endif; ?>
    </p>
    <form method="post">
        <?php csrf_field(); ?>
        <input type="hidden" name="action" value="fetch_discord">
        <input type="hidden" name="id" value="<?php echo e($existing['id']); ?>">
        <div class="field" style="max-width:280px;">
            <label for="discord_id">Discord user ID</label>
            <input type="text" id="discord_id" name="discord_id" inputmode="numeric" placeholder="e.g. 123456789012345678" value="<?php echo e($existing['discord_id'] ?? ''); ?>">
            <div class="field--hint">Right-click their name in Discord (Developer Mode on) &rarr; Copy User ID.</div>
        </div>
        <button type="submit" class="btn btn--ghost btn--sm">Fetch avatar from Discord</button>
    </form>
</div>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

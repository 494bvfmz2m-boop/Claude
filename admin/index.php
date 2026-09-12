<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_login();
$me = current_user();

$pageTitle = 'Admin Dashboard';
$activeAdminPage = 'dashboard';

$users = get_users();
$posts = get_posts();
$roles = get_roles();

require_once __DIR__ . '/../includes/header.php';
?>
<div class="admin-shell">
  <?php require __DIR__ . '/../includes/admin_nav.php'; ?>
  <div class="admin-main">
    <h1>Dashboard</h1>
    <p class="muted">Welcome back, <?= e($me['username']) ?>.</p>

    <div class="status-grid" style="margin-top: 24px;">
      <div class="status-block">
        <div class="label">Members</div>
        <div style="font-size:1.8rem; font-weight:700;"><?= count($users) ?></div>
      </div>
      <div class="status-block">
        <div class="label">Posts &amp; announcements</div>
        <div style="font-size:1.8rem; font-weight:700;"><?= count($posts) ?></div>
      </div>
      <div class="status-block">
        <div class="label">Roles</div>
        <div style="font-size:1.8rem; font-weight:700;"><?= count($roles) ?></div>
      </div>
      <div class="status-block">
        <div class="label">Unverified accounts</div>
        <div style="font-size:1.8rem; font-weight:700;"><?= count(array_filter($users, fn($u) => empty($u['verified']))) ?></div>
      </div>
    </div>

    <div style="margin-top:32px; display:flex; gap:12px; flex-wrap:wrap;">
      <?php if (user_has_permission($me, 'manage_posts')): ?>
        <a href="<?= SITE_URL ?>/admin/posts" class="btn btn-primary">Write a post</a>
      <?php endif; ?>
      <?php if (user_has_permission($me, 'manage_users')): ?>
        <a href="<?= SITE_URL ?>/admin/users" class="btn btn-outline">Manage users</a>
      <?php endif; ?>
      <?php if (user_has_permission($me, 'manage_store')): ?>
        <a href="<?= SITE_URL ?>/admin/store" class="btn btn-outline">Store orders</a>
      <?php endif; ?>
      <?php if (user_has_permission($me, 'manage_settings')): ?>
        <a href="<?= SITE_URL ?>/admin/settings" class="btn btn-outline">Edit server info</a>
      <?php endif; ?>
    </div>
  </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>

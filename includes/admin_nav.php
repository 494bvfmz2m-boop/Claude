<?php
// Expects $me and $activeAdminPage to be set by the including page.
?>
<nav class="admin-side">
  <?php if (user_has_permission($me, 'manage_posts')): ?>
    <a href="<?= SITE_URL ?>/admin" class="<?= $activeAdminPage === 'dashboard' ? 'active' : '' ?>">Dashboard</a>
    <a href="<?= SITE_URL ?>/admin/posts" class="<?= $activeAdminPage === 'posts' ? 'active' : '' ?>">Posts</a>
  <?php endif; ?>
  <?php if (user_has_permission($me, 'manage_users')): ?>
    <a href="<?= SITE_URL ?>/admin/users" class="<?= $activeAdminPage === 'users' ? 'active' : '' ?>">Users</a>
  <?php endif; ?>
  <?php if (user_has_permission($me, 'manage_roles')): ?>
    <a href="<?= SITE_URL ?>/admin/roles" class="<?= $activeAdminPage === 'roles' ? 'active' : '' ?>">Roles</a>
    <a href="<?= SITE_URL ?>/admin/staff-order" class="<?= $activeAdminPage === 'staff-order' ? 'active' : '' ?>">Staff Order</a>
  <?php endif; ?>
  <?php if (user_has_permission($me, 'manage_tickets')): ?>
    <a href="<?= SITE_URL ?>/admin/tickets" class="<?= $activeAdminPage === 'tickets' ? 'active' : '' ?>">
      Tickets
      <?php $openCount = count_open_tickets(); if ($openCount > 0): ?><span class="badge" style="color:var(--gold);border-color:rgba(242,169,30,.4);margin-left:4px;"><?= $openCount ?></span><?php endif; ?>
    </a>
  <?php endif; ?>
  <?php if (user_has_permission($me, 'manage_store')): ?>
    <a href="<?= SITE_URL ?>/admin/store" class="<?= $activeAdminPage === 'store' ? 'active' : '' ?>">Store</a>
  <?php endif; ?>
  <?php if (user_has_permission($me, 'manage_settings')): ?>
    <a href="<?= SITE_URL ?>/admin/settings" class="<?= $activeAdminPage === 'settings' ? 'active' : '' ?>">Settings</a>
    <a href="<?= SITE_URL ?>/admin/theme" class="<?= $activeAdminPage === 'theme' ? 'active' : '' ?>">Theme</a>
  <?php endif; ?>
</nav>

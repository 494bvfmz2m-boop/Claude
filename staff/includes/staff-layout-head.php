<?php
/** Expects $navPage and $pageTitle to be set by the including page. */
$navPage = $navPage ?? '';
$staffSupportUnread = SupportTicket::unreadCountForStaff();
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title><?php echo e($pageTitle ?? 'Dashboard'); ?> - Staff - <?php echo e(SITE_NAME); ?></title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="<?php echo e(asset_url('/assets/img/favicon-32.png')); ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?php echo e(asset_url('/assets/css/style.css')); ?>">
</head>
<body>

<div class="staff-mobile-topbar">
    <button type="button" class="staff-mobile-topbar__toggle" id="staff-nav-toggle" aria-label="Open menu" aria-expanded="false"><?php echo xs_icon('sliders', 18); ?></button>
    <span class="staff-mobile-topbar__title"><?php echo e($pageTitle ?? 'Dashboard'); ?></span>
</div>
<div class="staff-sidebar-backdrop" id="staff-sidebar-backdrop"></div>

<div class="staff-shell">
    <aside class="staff-sidebar" id="staff-sidebar">
        <a href="/staff" class="staff-sidebar__brand">
            <img src="<?php echo e(asset_url('/assets/img/mark.png')); ?>" alt="">
            <span>Xyphros Staff</span>
        </a>
        <nav class="staff-nav">
            <span class="staff-nav__label">Overview</span>
            <a href="/staff" class="<?php echo $navPage === 'dashboard' ? 'is-active' : ''; ?>"><?php echo xs_icon('home', 15); ?> Dashboard</a>

            <?php if (Permissions::can($currentStaffUser, 'manage_posts') || Permissions::can($currentStaffUser, 'manage_products') || Permissions::can($currentStaffUser, 'manage_team') || Permissions::can($currentStaffUser, 'manage_settings')): ?>
            <span class="staff-nav__label">Content</span>
            <?php if (Permissions::can($currentStaffUser, 'manage_posts')): ?><a href="/staff/posts" class="<?php echo $navPage === 'posts' ? 'is-active' : ''; ?>"><?php echo xs_icon('doc', 15); ?> Posts</a><?php endif; ?>
            <?php if (Permissions::can($currentStaffUser, 'manage_products')): ?><a href="/staff/products" class="<?php echo $navPage === 'products' ? 'is-active' : ''; ?>"><?php echo xs_icon('box', 15); ?> Products</a><?php endif; ?>
            <?php if (Permissions::can($currentStaffUser, 'manage_team')): ?><a href="/staff/team" class="<?php echo $navPage === 'team' ? 'is-active' : ''; ?>"><?php echo xs_icon('users', 15); ?> Team</a><?php endif; ?>
            <?php if (Permissions::can($currentStaffUser, 'manage_settings')): ?><a href="/staff/settings" class="<?php echo $navPage === 'settings' ? 'is-active' : ''; ?>"><?php echo xs_icon('sliders', 15); ?> Page content</a><?php endif; ?>
            <?php endif; ?>

            <?php if (Permissions::can($currentStaffUser, 'view_messages') || Permissions::can($currentStaffUser, 'manage_support') || Permissions::can($currentStaffUser, 'send_email') || Permissions::can($currentStaffUser, 'manage_broadcasts')): ?>
            <span class="staff-nav__label">Inbox</span>
            <?php if (Permissions::can($currentStaffUser, 'manage_support')): ?>
            <a href="/staff/tickets" class="<?php echo $navPage === 'tickets' ? 'is-active' : ''; ?>">
                <?php echo xs_icon('chat', 15); ?> Support chat
                <?php if ($staffSupportUnread > 0): ?><span class="staff-nav__badge"><?php echo (int) $staffSupportUnread; ?></span><?php endif; ?>
            </a>
            <?php endif; ?>
            <?php if (Permissions::can($currentStaffUser, 'view_messages')): ?><a href="/staff/messages" class="<?php echo $navPage === 'messages' ? 'is-active' : ''; ?>"><?php echo xs_icon('inbox', 15); ?> Messages</a><?php endif; ?>
            <?php if (Permissions::can($currentStaffUser, 'send_email')): ?><a href="/staff/email" class="<?php echo $navPage === 'email' ? 'is-active' : ''; ?>"><?php echo xs_icon('send', 15); ?> Email</a><?php endif; ?>
            <?php if (Permissions::can($currentStaffUser, 'manage_broadcasts')): ?><a href="/staff/broadcasts" class="<?php echo $navPage === 'broadcasts' ? 'is-active' : ''; ?>"><?php echo xs_icon('send', 15); ?> Broadcasts</a><?php endif; ?>
            <?php endif; ?>

            <?php if ($isFounder || Permissions::can($currentStaffUser, 'manage_accounts')): ?>
            <span class="staff-nav__label"><?php echo $isFounder ? 'Founder' : 'Accounts'; ?></span>
            <a href="/staff/accounts" class="<?php echo $navPage === 'accounts' ? 'is-active' : ''; ?>"><?php echo xs_icon('user', 15); ?> Accounts</a>
            <?php endif; ?>
            <?php if ($isFounder || Permissions::can($currentStaffUser, 'manage_orders')): ?>
            <a href="/staff/orders" class="<?php echo $navPage === 'orders' ? 'is-active' : ''; ?>"><?php echo xs_icon('box', 15); ?> Orders</a>
            <?php endif; ?>
            <?php if ($isFounder || Permissions::can($currentStaffUser, 'manage_licenses')): ?>
            <a href="/staff/licenses" class="<?php echo $navPage === 'licenses' ? 'is-active' : ''; ?>"><?php echo xs_icon('key', 15); ?> License Keys</a>
            <?php endif; ?>
            <?php if ($isFounder): ?>
            <a href="/staff/access" class="<?php echo $navPage === 'access' ? 'is-active' : ''; ?>"><?php echo xs_icon('shield', 15); ?> Staff Access</a>
            <a href="/staff/permissions" class="<?php echo $navPage === 'permissions' ? 'is-active' : ''; ?>"><?php echo xs_icon('sliders', 15); ?> Permissions</a>
            <a href="/staff/audit" class="<?php echo $navPage === 'audit' ? 'is-active' : ''; ?>"><?php echo xs_icon('clock', 15); ?> Audit Log</a>
            <?php endif; ?>
        </nav>
        <div class="staff-sidebar__bottom">
            <a href="<?php echo e(DISCORD_INVITE_URL); ?>" target="_blank" rel="noopener" class="discord-btn">
                <?php echo xs_icon_discord(15); ?> Discord
            </a>
            <a href="/account" class="staff-sidebar__account">
                <?php if (!empty($currentStaffUser['avatar'])): ?>
                    <img src="<?php echo e($currentStaffUser['avatar']); ?>" alt="">
                <?php else: ?>
                    <span class="staff-sidebar__account-fallback"><?php echo e(strtoupper(substr($currentStaffUser['name'] ?? $currentStaffUser['username'], 0, 1))); ?></span>
                <?php endif; ?>
                <span class="staff-sidebar__account-info">
                    <span class="staff-sidebar__account-name"><?php echo e($currentStaffUser['name'] ?? $currentStaffUser['username']); ?></span>
                    <span class="staff-sidebar__account-role"><?php echo $isFounder ? 'Founder' : 'Xyphros Staff'; ?></span>
                </span>
            </a>
            <a href="/" style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:8px;font-size:13px;color:var(--text-faint);"><?php echo xs_icon('external', 14); ?> xyphros.net</a>
            <a href="/logout.php" class="staff-sidebar__logout" style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:8px;font-size:13px;"><?php echo xs_icon('logout', 14); ?> Log out</a>
        </div>
    </aside>

    <main class="staff-main">

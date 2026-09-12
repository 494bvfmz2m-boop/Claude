<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_broadcasts');

$navPage = 'broadcasts';
$pageTitle = 'Broadcasts';
$error = $success = '';
if ($flash = get_flash()) {
    if ($flash['type'] === 'error') $error = $flash['message']; else $success = $flash['message'];
}

$products = [
    'xyphros'    => ['label' => 'Xyphros', 'sub' => 'xyphros.net'],
    'portal'     => ['label' => 'XyphrosPortal', 'sub' => 'portal.xyphros.net'],
    'subtracker' => ['label' => 'Plexer Pass Tracker', 'sub' => 'plexsmp.xyphros.net'],
];
$product = $_GET['product'] ?? 'xyphros';
if (!isset($products[$product])) $product = 'xyphros';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $postProduct = $_POST['product'] ?? 'xyphros';
        if (!isset($products[$postProduct])) $postProduct = 'xyphros';
        $action = $_POST['action'] ?? '';
        $redirectUrl = '/staff/broadcasts?product=' . $postProduct;

        if ($action === 'create') {
            $message = trim($_POST['message'] ?? '');
            $style = $_POST['style'] ?? 'info';
            $link = trim($_POST['link'] ?? '');
            if ($message === '') {
                $error = 'Write a message first.';
                $product = $postProduct;
            } else {
                Broadcast::create($postProduct, $currentStaffUser['id'], $message, $style, $link ?: null);
                AuditLog::log($currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'], 'broadcast_created', null, $products[$postProduct]['label'], 'Posted a broadcast: ' . mb_substr($message, 0, 80));
                redirect_with_flash($redirectUrl, 'success', 'Broadcast is live on ' . $products[$postProduct]['label'] . '.');
            }
        } elseif ($action === 'deactivate') {
            Broadcast::setActive($postProduct, $_POST['id'] ?? '', false);
            redirect_with_flash($redirectUrl, 'success', 'Broadcast turned off.');
        } elseif ($action === 'activate') {
            Broadcast::deactivateAll($postProduct);
            Broadcast::setActive($postProduct, $_POST['id'] ?? '', true);
            redirect_with_flash($redirectUrl, 'success', 'Broadcast is live again.');
        } elseif ($action === 'delete') {
            Broadcast::delete($postProduct, $_POST['id'] ?? '');
            redirect_with_flash($redirectUrl, 'success', 'Broadcast deleted.');
        }
        $product = $postProduct;
    }
}

$broadcasts = Broadcast::all($product);

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Broadcasts</h1>
        <p>Site-wide announcement bars. One product, one live broadcast at a time.</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>
<?php if ($success): ?><div class="alert alert--success"><?php echo e($success); ?></div><?php endif; ?>

<div class="product-tabs">
    <?php foreach ($products as $key => $p): ?>
        <a href="/staff/broadcasts?product=<?php echo e($key); ?>" class="product-tab <?php echo $product === $key ? 'is-active' : ''; ?>"><?php echo xs_icon('grid', 14); ?> <?php echo e($p['label']); ?></a>
    <?php endforeach; ?>
</div>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('send', 18); ?></div>
        <h3>New broadcast for <?php echo e($products[$product]['label']); ?></h3>
    </div>
    <form method="post">
        <?php csrf_field(); ?>
        <input type="hidden" name="action" value="create">
        <input type="hidden" name="product" value="<?php echo e($product); ?>">
        <div class="field">
            <label for="message">Message</label>
            <input type="text" id="message" name="message" required maxlength="220" placeholder="e.g. Scheduled maintenance tonight at 11pm UTC">
        </div>
        <div class="staff-form__row" style="display:grid;grid-template-columns:1fr 2fr;gap:18px;">
            <div class="field">
                <label for="style">Type</label>
                <select id="style" name="style">
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Urgent</option>
                </select>
            </div>
            <div class="field">
                <label for="link">Link (optional)</label>
                <input type="url" id="link" name="link" placeholder="https://">
            </div>
        </div>
        <button type="submit" class="btn btn--primary">Post broadcast</button>
    </form>
</div>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('clock', 18); ?></div>
        <h3>History</h3>
    </div>
    <?php if (empty($broadcasts)): ?>
        <p style="color:var(--text-muted);margin:0;">No broadcasts yet for this product.</p>
    <?php else: foreach ($broadcasts as $b): ?>
        <div class="audit-row">
            <div class="audit-icon"><?php echo xs_icon('send', 14); ?></div>
            <div style="flex:1;min-width:0;">
                <div><?php echo e($b['message']); ?></div>
                <div class="audit-detail">
                    <span class="status-pill status--<?php echo $b['style'] === 'error' ? 'maintenance' : ($b['style'] === 'success' ? 'online' : ($b['style'] === 'warning' ? 'beta' : 'soon')); ?>"><?php echo ucfirst($b['style']); ?></span>
                    &middot; <?php echo e(time_ago($b['created_at'] ?? '')); ?>
                    <?php if (!empty($b['active'])): ?> &middot; <strong style="color:var(--online);">Live now</strong><?php endif; ?>
                </div>
            </div>
            <div class="btn-row">
                <?php if (!empty($b['active'])): ?>
                    <form method="post"><?php csrf_field(); ?><input type="hidden" name="action" value="deactivate"><input type="hidden" name="product" value="<?php echo e($product); ?>"><input type="hidden" name="id" value="<?php echo e($b['id']); ?>"><button type="submit" class="btn btn--ghost btn--sm">Turn off</button></form>
                <?php else: ?>
                    <form method="post"><?php csrf_field(); ?><input type="hidden" name="action" value="activate"><input type="hidden" name="product" value="<?php echo e($product); ?>"><input type="hidden" name="id" value="<?php echo e($b['id']); ?>"><button type="submit" class="btn btn--ghost btn--sm">Make live</button></form>
                <?php endif; ?>
                <form method="post" onsubmit="return confirm('Delete this broadcast?');"><?php csrf_field(); ?><input type="hidden" name="action" value="delete"><input type="hidden" name="product" value="<?php echo e($product); ?>"><input type="hidden" name="id" value="<?php echo e($b['id']); ?>"><button type="submit" class="btn btn--danger btn--sm">Delete</button></form>
            </div>
        </div>
    <?php endforeach; endif; ?>
</div>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

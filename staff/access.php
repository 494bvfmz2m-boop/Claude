<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_founder();

$navPage = 'access';
$pageTitle = 'Staff Access';
$error = $success = '';
if ($flash = get_flash()) {
    if ($flash['type'] === 'error') $error = $flash['message']; else $success = $flash['message'];
}

// Registry of products this tool can grant access to. Adding a new
// product later is just adding an entry here — no schema change needed
// as long as it follows the is_{name}_staff column convention.
$products = [
    'xyphros' => ['label' => 'Xyphros', 'column' => 'is_xyphros_staff', 'sub' => 'xyphros.net'],
    'portal'  => ['label' => 'XyphrosPortal', 'column' => 'is_portal_staff', 'sub' => 'portal.xyphros.net'],
    'subtracker' => ['label' => 'Plexer Pass Tracker', 'column' => 'is_subtracker_staff', 'sub' => 'plexsmp.xyphros.net'],
];

$product = $_GET['product'] ?? 'xyphros';
if (!isset($products[$product])) $product = 'xyphros';
$column = $products[$product]['column'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $targetId = $_POST['target_id'] ?? '';
        $action = $_POST['action'] ?? '';
        $postProduct = $_POST['product'] ?? 'xyphros';
        $postColumn = $products[$postProduct]['column'] ?? 'is_xyphros_staff';

        if ($targetId === $currentStaffUser['id']) {
            $error = "You can't change your own access from here.";
        } else {
            $target = XyphrosAuth::findById($targetId);
            if (!$target) {
                $error = 'Account not found.';
            } elseif (!empty($target['is_super_admin'])) {
                $error = 'Founder accounts always have access everywhere: nothing to change.';
            } elseif ($action === 'grant' || $action === 'revoke') {
                $grant = $action === 'grant';
                XyphrosAuth::updateUser($targetId, [$postColumn => $grant ? 1 : 0]);
                AuditLog::log(
                    $currentStaffUser['id'], $currentStaffUser['name'] ?? $currentStaffUser['username'],
                    $grant ? 'staff_granted' : 'staff_revoked', $targetId, $target['email'],
                    ($grant ? 'Granted' : 'Revoked') . ' ' . ($products[$postProduct]['label'] ?? $postProduct) . ' staff access'
                );
                $msg = ($target['name'] ?: $target['username']) . ($grant ? ' now has ' : ' no longer has ') . $products[$postProduct]['label'] . ' access.';
                redirect_with_flash('/staff/access?product=' . $postProduct, 'success', $msg);
            }
        }
        if ($error) {
            $product = $postProduct;
            $column = $postColumn;
        }
    }
}

$currentStaffList = XyphrosAuth::db()->query(
    "SELECT id, username, email, name, avatar, is_super_admin FROM users WHERE {$column} = 1 OR is_super_admin = 1 ORDER BY is_super_admin DESC, username ASC"
)->fetchAll();

$q = trim($_GET['q'] ?? '');
$searchResults = [];
if ($q !== '') {
    $stmt = XyphrosAuth::db()->prepare(
        "SELECT id, username, email, name, avatar FROM users WHERE (username LIKE ? OR email LIKE ? OR name LIKE ?) AND {$column} = 0 AND is_super_admin = 0 ORDER BY username ASC LIMIT 20"
    );
    $like = '%' . $q . '%';
    $stmt->execute([$like, $like, $like]);
    $searchResults = $stmt->fetchAll();
}

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Staff Access</h1>
        <p>Grant or revoke staff access to any Xyphros product, from one place.</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>
<?php if ($success): ?><div class="alert alert--success"><?php echo e($success); ?></div><?php endif; ?>

<div class="product-tabs">
    <?php foreach ($products as $key => $p): ?>
        <a href="/staff/access?product=<?php echo e($key); ?>" class="product-tab <?php echo $product === $key ? 'is-active' : ''; ?>"><?php echo xs_icon('grid', 14); ?> <?php echo e($p['label']); ?></a>
    <?php endforeach; ?>
</div>

<div class="staff-card">
    <div class="staff-card__head" style="justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div class="staff-card__icon"><?php echo xs_icon('shield', 18); ?></div>
            <h3><?php echo e($products[$product]['label']); ?> staff <span class="badge-muted">(<?php echo e($products[$product]['sub']); ?>)</span></h3>
        </div>
        <?php if ($product === 'xyphros'): ?>
        <a href="/staff/permissions" style="font-size:12px;font-weight:600;color:var(--magenta);">Set what each person can do &rarr;</a>
        <?php endif; ?>
    </div>
    <?php foreach ($currentStaffList as $acc): ?>
        <div class="acc-summary">
            <?php if (!empty($acc['avatar'])): ?>
                <img src="<?php echo e($acc['avatar']); ?>" class="acc-avatar" alt="">
            <?php else: ?>
                <span class="acc-avatar-fallback"><?php echo e(strtoupper(substr($acc['name'] ?: $acc['username'], 0, 1))); ?></span>
            <?php endif; ?>
            <div style="flex:1;min-width:0;">
                <strong><?php echo e($acc['name'] ?: $acc['username']); ?></strong>
                <?php if ($acc['id'] === $currentStaffUser['id']): ?><span class="badge-muted">(you)</span><?php endif; ?>
                <div style="color:var(--text-muted);font-size:12.5px;"><?php echo e($acc['email']); ?></div>
            </div>
            <?php if (!empty($acc['is_super_admin'])): ?>
                <span class="acc-flag acc-flag--admin">Founder</span>
            <?php elseif ($acc['id'] !== $currentStaffUser['id']): ?>
                <form method="post" onsubmit="return confirm('Revoke this account\'s access to <?php echo e($products[$product]['label']); ?>?');">
                    <?php csrf_field(); ?>
                    <input type="hidden" name="action" value="revoke">
                    <input type="hidden" name="product" value="<?php echo e($product); ?>">
                    <input type="hidden" name="target_id" value="<?php echo e($acc['id']); ?>">
                    <button type="submit" class="btn btn--ghost btn--sm">Revoke</button>
                </form>
            <?php endif; ?>
        </div>
    <?php endforeach; ?>
</div>

<div class="staff-card">
    <div class="staff-card__head">
        <div class="staff-card__icon"><?php echo xs_icon('plus', 18); ?></div>
        <h3>Grant access</h3>
    </div>
    <form method="get" class="search-box" style="max-width:420px;">
        <input type="hidden" name="product" value="<?php echo e($product); ?>">
        <?php echo xs_icon('search', 16); ?>
        <input type="text" name="q" placeholder="Search by name, username, or email&hellip;" value="<?php echo e($q); ?>" autofocus>
    </form>
    <?php if ($q !== ''): ?>
        <?php if (empty($searchResults)): ?>
            <p style="color:var(--text-muted);font-size:13px;">No matching accounts without access already.</p>
        <?php else: foreach ($searchResults as $acc): ?>
            <div class="acc-summary">
                <?php if (!empty($acc['avatar'])): ?>
                    <img src="<?php echo e($acc['avatar']); ?>" class="acc-avatar" alt="">
                <?php else: ?>
                    <span class="acc-avatar-fallback"><?php echo e(strtoupper(substr($acc['name'] ?: $acc['username'], 0, 1))); ?></span>
                <?php endif; ?>
                <div style="flex:1;min-width:0;">
                    <strong><?php echo e($acc['name'] ?: $acc['username']); ?></strong>
                    <div style="color:var(--text-muted);font-size:12.5px;"><?php echo e($acc['email']); ?></div>
                </div>
                <form method="post">
                    <?php csrf_field(); ?>
                    <input type="hidden" name="action" value="grant">
                    <input type="hidden" name="product" value="<?php echo e($product); ?>">
                    <input type="hidden" name="target_id" value="<?php echo e($acc['id']); ?>">
                    <button type="submit" class="btn btn--primary btn--sm">Grant access</button>
                </form>
            </div>
        <?php endforeach; endif; ?>
    <?php endif; ?>
</div>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

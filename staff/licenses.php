<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_licenses');

// This page didn't have the Post/Redirect/Get treatment other actions here
// already got (see the comment on redirect_with_flash() in functions.php,
// added for the exact same "refresh resubmits the form" bug on broadcasts).
// Without it, hitting refresh after generating keys just re-POSTs the same
// form and mints another batch — which is exactly what was happening.
// The generated-keys list itself is one-time-display and shouldn't ride
// along in the redirect URL (server/browser history would keep a copy of
// real license keys), so it's stashed in a short-lived local session
// instead, read once, then discarded.
if (session_status() === PHP_SESSION_NONE) session_start();

$navPage = 'licenses';
$pageTitle = 'License Keys';
$error = $success = '';
$generatedKeys = [];

if (!empty($_SESSION['_just_generated_license_keys'])) {
    $generatedKeys = $_SESSION['_just_generated_license_keys'];
    unset($_SESSION['_just_generated_license_keys']);
}

if ($flash = get_flash()) {
    if ($flash['type'] === 'error') $error = $flash['message']; else $success = $flash['message'];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $tier = $_POST['tier'] ?? '';
        $qty = (int) ($_POST['qty'] ?? 0);

        if (!isset(License::tiers()[$tier])) {
            $error = 'Pick a valid tier.';
        } elseif ($qty < 1 || $qty > 500) {
            $error = 'Quantity must be between 1 and 500.';
        } else {
            $keys = License::generate($tier, $qty, [
                'source' => 'manual',
                'created_by_staff_id' => $currentStaffUser['id'],
            ]);
            AuditLog::log(
                $currentStaffUser['id'],
                $currentStaffUser['name'] ?: $currentStaffUser['email'],
                'license.generate',
                null,
                License::tiers()[$tier]['label'],
                "Generated {$qty}x " . License::tiers()[$tier]['label'] . ' license key(s)'
            );
            $_SESSION['_just_generated_license_keys'] = $keys;
            $redirectUrl = '/staff/licenses' . (isset($_GET['all']) ? '?all=1' : '');
            redirect_with_flash($redirectUrl, 'success', "Generated {$qty} key(s). Copy them below before leaving this page. They won't be shown again here, though they'll still show up (redeemed or not) in the list.");
        }
    }
}

$showAll = isset($_GET['all']);
$allKeys = License::all();
$keys = $showAll ? $allKeys : array_filter($allKeys, fn($k) => empty($k['redeemed']));

$unredeemedCount = count(array_filter($allKeys, fn($k) => empty($k['redeemed'])));
$redeemedCount = count($allKeys) - $unredeemedCount;

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>License Keys</h1>
        <p>Generate license keys: workspace boosts for XyphrosPortal, or XyphrosEditor Pro, and see who's redeemed what.</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>
<?php if ($success): ?><div class="alert alert--success"><?php echo e($success); ?></div><?php endif; ?>

<?php if ($generatedKeys): ?>
<div class="staff-card" style="margin-bottom:20px;">
    <h3 style="margin-top:0;">Newly generated keys</h3>
    <textarea readonly style="width:100%;min-height:120px;font-family:var(--font-mono);font-size:13px;padding:12px;" onclick="this.select();"><?php echo e(implode("\n", $generatedKeys)); ?></textarea>
    <p style="color:var(--text-muted);font-size:12.5px;margin-bottom:0;">Click to select all, then copy. Give these to whoever should redeem them.</p>
</div>
<?php endif; ?>

<div class="staff-card" style="margin-bottom:20px;">
    <h3 style="margin-top:0;">Generate keys</h3>
    <form method="post" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
        <?php csrf_field(); ?>
        <div class="field">
            <label>Tier</label>
            <select name="tier">
                <?php foreach (License::tiers() as $key => $tier): ?>
                    <option value="<?php echo e($key); ?>"><?php echo e($tier['label']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="field">
            <label>Quantity</label>
            <input type="number" name="qty" min="1" max="500" value="1" style="width:100px;">
        </div>
        <button type="submit" class="btn btn--primary">Generate</button>
    </form>
</div>

<div class="staff-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;"><?php echo $showAll ? 'All keys' : 'Unredeemed keys'; ?></h3>
        <div style="display:flex;gap:14px;align-items:center;">
            <span style="color:var(--text-muted);font-size:12.5px;"><?php echo $unredeemedCount; ?> unredeemed &middot; <?php echo $redeemedCount; ?> redeemed</span>
            <a href="/staff/licenses<?php echo $showAll ? '' : '?all=1'; ?>" class="btn btn--ghost btn--sm"><?php echo $showAll ? 'Show unredeemed only' : 'Show all'; ?></a>
        </div>
    </div>

    <?php if (empty($keys)): ?>
        <p style="color:var(--text-muted);font-size:13px;">No keys to show.</p>
    <?php else: ?>
    <table class="staff-table">
        <thead>
            <tr>
                <th>Key</th>
                <th>Order ID</th>
                <th>Tier</th>
                <th>Source</th>
                <th>Status</th>
                <th>Redeemed by</th>
                <th>Created</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($keys as $k): ?>
            <?php
                $tierInfo = License::tiers()[$k['tier'] ?? ''] ?? null;
                $redeemedBy = !empty($k['redeemed_by_user_id']) ? XyphrosAuth::findById($k['redeemed_by_user_id']) : null;
            ?>
            <tr>
                <td style="font-family:var(--font-mono);font-size:12.5px;"><?php echo e($k['key'] ?? ''); ?></td>
                <td style="font-family:var(--font-mono);font-size:12.5px;color:var(--text-muted);white-space:nowrap;">
                    <?php if (!empty($k['order_number'])): ?>
                        #<?php echo (int) $k['order_number']; ?>
                    <?php elseif (!empty($k['order_id'])): ?>
                        <span title="<?php echo e($k['order_id']); ?>" style="cursor:help;">(legacy)</span>
                    <?php else: ?>
                        —
                    <?php endif; ?>
                </td>
                <td><?php echo e($tierInfo['label'] ?? ($k['tier'] ?? 'Unknown')); ?></td>
                <td><?php echo e($k['source'] ?? 'unknown'); ?></td>
                <td>
                    <?php if (!empty($k['redeemed'])): ?>
                        <span class="status-pill status--online">Redeemed</span>
                    <?php else: ?>
                        <span class="status-pill status--soon">Unredeemed</span>
                    <?php endif; ?>
                </td>
                <td><?php echo $redeemedBy ? e($redeemedBy['name'] ?: $redeemedBy['email']) : '—'; ?></td>
                <td><?php echo e(format_date($k['created_at'] ?? '')); ?></td>
                <td>
                    <form method="post" action="/staff/license-delete" onsubmit="return confirm('Delete this license key? This can\'t be undone.');">
                        <?php csrf_field(); ?>
                        <input type="hidden" name="id" value="<?php echo e($k['id'] ?? ''); ?>">
                        <?php if ($showAll): ?><input type="hidden" name="all" value="1"><?php endif; ?>
                        <button type="submit" class="btn btn--ghost btn--sm">Delete</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

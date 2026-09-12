<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_orders');

$navPage = 'orders';
$pageTitle = 'Orders';

$statusFilter = $_GET['status'] ?? '';
$allOrders = Content::all('shop_orders', 'created_at', 'DESC');
$orders = $statusFilter !== ''
    ? array_filter($allOrders, fn($o) => ($o['status'] ?? '') === $statusFilter)
    : $allOrders;

$counts = ['pending' => 0, 'completed' => 0, 'declined' => 0, 'refunded' => 0, 'disputed' => 0];
foreach ($allOrders as $o) {
    $s = $o['status'] ?? 'pending';
    if (isset($counts[$s])) $counts[$s]++;
}

$statusBadge = [
    'pending' => 'status--soon',
    'completed' => 'status--online',
    'declined' => 'status--maintenance',
    'refunded' => 'status--maintenance',
    'disputed' => 'status--maintenance',
];

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Orders</h1>
        <p>Every purchase made through the store, and who made it.</p>
    </div>
</div>

<div class="staff-card" style="margin-bottom:20px;">
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="/staff/orders" class="btn btn--sm <?php echo $statusFilter === '' ? 'btn--primary' : 'btn--ghost'; ?>">All (<?php echo count($allOrders); ?>)</a>
        <a href="/staff/orders?status=pending" class="btn btn--sm <?php echo $statusFilter === 'pending' ? 'btn--primary' : 'btn--ghost'; ?>">Pending (<?php echo $counts['pending']; ?>)</a>
        <a href="/staff/orders?status=completed" class="btn btn--sm <?php echo $statusFilter === 'completed' ? 'btn--primary' : 'btn--ghost'; ?>">Completed (<?php echo $counts['completed']; ?>)</a>
        <a href="/staff/orders?status=declined" class="btn btn--sm <?php echo $statusFilter === 'declined' ? 'btn--primary' : 'btn--ghost'; ?>">Declined (<?php echo $counts['declined']; ?>)</a>
        <a href="/staff/orders?status=refunded" class="btn btn--sm <?php echo $statusFilter === 'refunded' ? 'btn--primary' : 'btn--ghost'; ?>">Refunded (<?php echo $counts['refunded']; ?>)</a>
        <a href="/staff/orders?status=disputed" class="btn btn--sm <?php echo $statusFilter === 'disputed' ? 'btn--primary' : 'btn--ghost'; ?>">Disputed (<?php echo $counts['disputed']; ?>)</a>
    </div>
</div>

<div class="staff-card">
    <?php if (empty($orders)): ?>
        <p style="color:var(--text-muted);font-size:13px;">No orders to show.</p>
    <?php else: ?>
    <table class="staff-table">
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Buyer</th>
                <th>Item</th>
                <th>Price</th>
                <th>Status</th>
                <th>Placed</th>
                <th>Completed</th>
                <th>License key</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($orders as $o): ?>
            <?php
                $buyer = !empty($o['xyphros_user_id']) ? XyphrosAuth::findById($o['xyphros_user_id']) : null;
                $status = $o['status'] ?? 'pending';
                $badgeClass = $statusBadge[$status] ?? 'badge--muted';
                $orderLicense = $status === 'completed' ? License::findByOrderId($o['id'] ?? '') : null;
            ?>
            <tr>
                <td style="font-family:var(--font-mono);font-size:12.5px;color:var(--text-muted);white-space:nowrap;">
                    <?php if (!empty($o['order_number'])): ?>
                        #<?php echo (int) $o['order_number']; ?>
                    <?php else: ?>
                        <span title="<?php echo e($o['id'] ?? ''); ?>" style="cursor:help;">(legacy)</span>
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ($buyer): ?>
                        <strong><?php echo e($buyer['name'] ?: $buyer['username']); ?></strong>
                        <div style="color:var(--text-muted);font-size:12px;"><?php echo e($buyer['email']); ?></div>
                    <?php else: ?>
                        <span style="color:var(--text-muted);">Unknown account</span>
                    <?php endif; ?>
                </td>
                <td><?php echo e($o['package_name'] ?? 'Unknown item'); ?></td>
                <td><?php echo e($o['currency'] ?? 'USD'); ?> <?php echo number_format((float) ($o['price_paid'] ?? $o['price'] ?? 0), 2); ?></td>
                <td><span class="status-pill <?php echo e($badgeClass); ?>"><?php echo e(ucfirst($status)); ?></span></td>
                <td><?php echo e(format_date($o['created_at'] ?? '')); ?></td>
                <td><?php echo !empty($o['completed_at']) ? e(format_date($o['completed_at'])) : '—'; ?></td>
                <td>
                    <?php if ($orderLicense): ?>
                        <button type="button" class="btn btn--ghost btn--sm" onclick="var k=this.nextElementSibling; k.style.display = k.style.display==='none' ? 'inline' : 'none'; this.style.display='none';">Show</button>
                        <code style="display:none;font-size:11.5px;"><?php echo e($orderLicense['key']); ?></code>
                    <?php else: ?>
                        <span style="color:var(--text-muted);">—</span>
                    <?php endif; ?>
                </td>
                <td>
                    <form method="post" action="/staff/order-delete" onsubmit="return confirm('Delete this order? This can\'t be undone.');">
                        <?php csrf_field(); ?>
                        <input type="hidden" name="id" value="<?php echo e($o['id']); ?>">
                        <input type="hidden" name="status" value="<?php echo e($statusFilter); ?>">
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

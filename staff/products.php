<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_products');

$navPage = 'products';
$pageTitle = 'Products';
$products = Content::all('products');

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1>Products</h1>
        <p>These are the cards shown on the public Products page.</p>
    </div>
    <a href="/staff/product-edit" class="btn btn--primary btn--sm">Add product</a>
</div>

<?php if (empty($products)): ?>
    <div class="empty-state">
        <div class="empty-state__icon"><?php echo xs_icon('box', 26); ?></div>
        <p style="margin:0;">No products yet. <a href="/staff/product-edit" style="color:var(--magenta); font-weight:700;">Add one</a>.</p>
    </div>
<?php else: ?>
    <div class="table-wrap">
        <table class="staff-table">
            <thead><tr><th>Name</th><th>Status</th><th>Featured</th><th>Link</th><th>Actions</th></tr></thead>
            <tbody>
                <?php foreach ($products as $product): ?>
                    <?php $statusMeta = product_status_meta($product['status'] ?? 'online'); ?>
                    <tr>
                        <td><?php echo e($product['name']); ?></td>
                        <td><span class="status-pill <?php echo e($statusMeta['class']); ?>"><?php echo e($statusMeta['label']); ?></span></td>
                        <td><?php echo !empty($product['featured']) ? 'Yes' : '&mdash;'; ?></td>
                        <td><span class="badge-muted"><?php echo e($product['url']); ?></span></td>
                        <td class="actions">
                            <a href="/staff/product-edit?id=<?php echo e($product['id']); ?>" class="btn btn--ghost btn--sm">Edit</a>
                            <form action="/staff/product-delete" method="post" onsubmit="return confirm('Delete this product? This cannot be undone.');">
                                <?php csrf_field(); ?>
                                <input type="hidden" name="id" value="<?php echo e($product['id']); ?>">
                                <button type="submit" class="btn btn--danger btn--sm">Delete</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
<?php endif; ?>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

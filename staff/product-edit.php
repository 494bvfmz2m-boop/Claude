<?php
require_once __DIR__ . '/includes/staff-auth.php';
require_permission('manage_products');

$editId = $_GET['id'] ?? null;
$existing = $editId ? Content::find('products', $editId) : null;

$navPage = 'products';
$pageTitle = $existing ? 'Edit product' : 'Add product';
$error = null;

$statusOptions = ['online' => 'Online', 'beta' => 'Beta', 'coming_soon' => 'Coming soon', 'maintenance' => 'Maintenance'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'That took a bit too long. Please try again.';
    } else {
        $name = trim($_POST['name'] ?? '');
        $tagline = trim($_POST['tagline'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $status = $_POST['status'] ?? 'online';
        $url = trim($_POST['url'] ?? '');
        $ctaLabel = trim($_POST['cta_label'] ?? '');
        $featured = isset($_POST['featured']);
        $id = $_POST['id'] ?? null;

        if ($name === '' || $url === '') {
            $error = 'Name and link URL are required.';
        } elseif (!filter_var($url, FILTER_VALIDATE_URL)) {
            $error = "That link URL doesn't look valid.";
        } elseif (!array_key_exists($status, $statusOptions)) {
            $error = 'Please choose a valid status.';
        } else {
            try {
                $icon = handle_image_upload('icon', UPLOADS_DIR . '/products', SITE_URL . UPLOADS_URL . '/products');
            } catch (RuntimeException $ex) {
                $error = $ex->getMessage();
                $icon = null;
            }

            if (!$error) {
                // Only one product can be featured — unfeature the rest first.
                if ($featured) {
                    foreach (Content::all('products') as $p) {
                        if (!empty($p['featured']) && $p['id'] !== $id) {
                            Content::update('products', $p['id'], ['featured' => false]);
                        }
                    }
                }

                $fields = [
                    'name' => $name, 'tagline' => $tagline, 'description' => $description,
                    'status' => $status, 'url' => $url, 'cta_label' => $ctaLabel, 'featured' => $featured,
                ];

                if (!$id) {
                    $existingProducts = Content::all('products');
                    $idBase = slugify($name);
                    $newId = $idBase;
                    $i = 2;
                    while (array_filter($existingProducts, fn($p) => $p['id'] === $newId)) { $newId = $idBase . '-' . $i; $i++; }
                    $fields['id'] = $newId;
                    $fields['icon'] = $icon;
                    Content::insert('products', $fields);
                } else {
                    if ($icon) {
                        delete_uploaded_file($existing['icon'] ?? null);
                        $fields['icon'] = $icon;
                    }
                    Content::update('products', $id, $fields);
                }
                header('Location: /staff/products');
                exit;
            }
        }
    }
}

require __DIR__ . '/includes/staff-layout-head.php';
?>

<div class="staff-topbar">
    <div>
        <h1><?php echo $existing ? 'Edit product' : 'Add product'; ?></h1>
        <p>This card appears on the public Products page (and the homepage, if featured).</p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert--error"><?php echo e($error); ?></div><?php endif; ?>

<form class="staff-form" method="post" enctype="multipart/form-data">
    <?php csrf_field(); ?>
    <?php if ($existing): ?><input type="hidden" name="id" value="<?php echo e($existing['id']); ?>"><?php endif; ?>

    <div class="field">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required maxlength="80" value="<?php echo e($_POST['name'] ?? $existing['name'] ?? ''); ?>">
    </div>
    <div class="field">
        <label for="tagline">Tagline</label>
        <input type="text" id="tagline" name="tagline" maxlength="140" value="<?php echo e($_POST['tagline'] ?? $existing['tagline'] ?? ''); ?>">
    </div>
    <div class="field">
        <label for="description">Description</label>
        <textarea id="description" name="description" maxlength="600"><?php echo e($_POST['description'] ?? $existing['description'] ?? ''); ?></textarea>
    </div>
    <div class="staff-form__row" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
        <div class="field">
            <label for="status">Status</label>
            <select id="status" name="status">
                <?php $currentStatus = $_POST['status'] ?? $existing['status'] ?? 'online'; ?>
                <?php foreach ($statusOptions as $value => $label): ?>
                    <option value="<?php echo e($value); ?>" <?php echo $currentStatus === $value ? 'selected' : ''; ?>><?php echo e($label); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="field">
            <label for="cta_label">Button label</label>
            <input type="text" id="cta_label" name="cta_label" maxlength="40" placeholder="e.g. Open XyphrosPortal" value="<?php echo e($_POST['cta_label'] ?? $existing['cta_label'] ?? ''); ?>">
        </div>
    </div>
    <div class="field">
        <label for="url">Link URL</label>
        <input type="url" id="url" name="url" required maxlength="300" placeholder="https://" value="<?php echo e($_POST['url'] ?? $existing['url'] ?? ''); ?>">
    </div>
    <div class="field">
        <label for="icon">Icon image</label>
        <?php if (!empty($existing['icon'])): ?>
            <div class="current-image">
                <img src="<?php echo e($existing['icon']); ?>" alt="">
                <span class="field--hint">Current icon &mdash; upload a new file to replace it.</span>
            </div>
        <?php endif; ?>
        <input type="file" id="icon" name="icon" accept=".jpg,.jpeg,.png,.gif,.webp">
    </div>
    <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="featured" name="featured" style="width:auto;" <?php echo !empty($_POST['featured']) || !empty($existing['featured']) ? 'checked' : ''; ?>>
        <label for="featured" style="margin:0;">Feature on homepage (only one at a time)</label>
    </div>

    <div class="btn-row">
        <button type="submit" class="btn btn--primary"><?php echo $existing ? 'Save changes' : 'Add product'; ?></button>
        <a href="/staff/products" class="btn btn--ghost">Cancel</a>
    </div>
</form>

<?php require __DIR__ . '/includes/staff-layout-foot.php'; ?>

<?php
require_staff();
$GLOBALS['page_title'] = 'Products - admin';
$GLOBALS['page_desc'] = 'Add products, upload photos and manage stock.';

$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$_POST && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    // The upload was bigger than the hosting's post_max_size, so PHP dropped the whole form.
    flash('Those files are too big for your hosting to accept in one go (limit ' . ini_get('post_max_size') . '). Upload fewer at a time, or raise post_max_size in cPanel.', 'err');
    redirect('?p=admin_products' . (isset($_GET['edit']) ? '&edit=' . (int)$_GET['edit'] : ''));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    $id = (int)($_POST['id'] ?? 0);

    if ($action === 'delete' && $id) {
        $p = one('SELECT image FROM products WHERE id = ?', [$id]);
        $files = array_column(product_media($id), 'path');
        if ($p && $p['image']) $files[] = $p['image'];
        foreach (array_unique($files) as $f) if (strpos($f, 'uploads/products/') === 0) @unlink(__DIR__ . '/../' . $f);
        q('DELETE FROM product_media WHERE product_id = ?', [$id]);
        q('DELETE FROM products WHERE id = ?', [$id]);
        flash('Product deleted.', 'warn');
        redirect('?p=admin_products');
    }

    if (in_array($action, ['media_remove', 'media_first'], true)) {
        $m = one('SELECT * FROM product_media WHERE id = ?', [(int)($_POST['media_id'] ?? 0)]);
        if ($m) {
            if ($action === 'media_remove') {
                q('DELETE FROM product_media WHERE id = ?', [$m['id']]);
                if (strpos($m['path'], 'uploads/products/') === 0) @unlink(__DIR__ . '/../' . $m['path']);
                flash(ucfirst($m['kind']) . ' removed.');
            } else {
                q('UPDATE product_media SET sort = sort + 1 WHERE product_id = ?', [$m['product_id']]);
                q('UPDATE product_media SET sort = 0 WHERE id = ?', [$m['id']]);
                flash('Moved to the front.');
            }
            refresh_product_cover((int)$m['product_id']);
            redirect('?p=admin_products&edit=' . (int)$m['product_id']);
        }
        redirect('?p=admin_products');
    }

    $name = trim((string)($_POST['name'] ?? ''));
    $price = (int)round(((float)($_POST['price'] ?? 0)) * 100);
    if ($name === '') $errors[] = 'Give the product a name.';
    if ($price < 0) $errors[] = 'Price cannot be negative.';

    $uploads = [];
    foreach (uploaded_files('media') as $file) {
        $saved = save_product_media($file, $errors);
        if ($saved) $uploads[] = $saved;
    }
    // Something failed: throw away the files that did upload so nothing is half-saved.
    if ($errors) foreach ($uploads as $u) @unlink(__DIR__ . '/../' . $u['path']);

    if (!$errors) {
        $fields = [
            $name,
            trim((string)($_POST['description'] ?? '')),
            trim((string)($_POST['category'] ?? '')),
            trim((string)($_POST['material'] ?? '')),
            trim((string)($_POST['product_details'] ?? '')),
            trim((string)($_POST['colours'] ?? '')),
            trim((string)($_POST['size_text'] ?? '')),
            trim((string)($_POST['promo_badge'] ?? '')),
            isset($_POST['is_best_seller']) ? 1 : 0,
            isset($_POST['is_new']) ? 1 : 0,
            $price,
            (int)($_POST['stock'] ?? 0),
            isset($_POST['visible']) ? 1 : 0,
        ];
        if ($action === 'update' && $id) {
            $fields[] = $id;
            q('UPDATE products SET name=?, description=?, category=?, material=?, product_details=?, colours=?, size_text=?, promo_badge=?, is_best_seller=?, is_new=?, price_cents=?, stock=?, visible=? WHERE id = ?', $fields);
            $productId = $id;
            flash('Product saved.');
        } else {
            $slug = slugify($name);
            $n = 1;
            while (one('SELECT id FROM products WHERE slug = ?', [$slug])) { $slug = slugify($name) . '-' . (++$n); }
            array_splice($fields, 1, 0, [$slug]);
            q('INSERT INTO products (name, slug, description, category, material, product_details, colours, size_text, promo_badge, is_best_seller, is_new, price_cents, stock, visible)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', $fields);
            $productId = (int)db()->lastInsertId();
            flash('Product added.');
        }
        $sort = (int)(one('SELECT MAX(sort) m FROM product_media WHERE product_id = ?', [$productId])['m'] ?? 0);
        foreach ($uploads as $u) {
            q('INSERT INTO product_media (product_id, path, kind, sort) VALUES (?,?,?,?)', [$productId, $u['path'], $u['kind'], ++$sort]);
        }
        refresh_product_cover($productId);
        redirect($uploads && $action === 'update' ? '?p=admin_products&edit=' . $productId : '?p=admin_products');
    }
}

$editing = isset($_GET['edit']) ? one('SELECT * FROM products WHERE id = ?', [(int)$_GET['edit']]) : null;
$editingMedia = $editing ? product_media((int)$editing['id']) : [];
$products = all('SELECT * FROM products ORDER BY created_at DESC');
?>
<h1>Admin</h1>
<?php admin_tabs('admin_products'); ?>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <form class="card" method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <h2><?= $editing ? 'Edit product' : 'Add a product' ?></h2>
    <input type="hidden" name="action" value="<?= $editing ? 'update' : 'create' ?>">
    <input type="hidden" name="id" value="<?= (int)($editing['id'] ?? 0) ?>">
    <label>Name <input name="name" required value="<?= e($editing['name'] ?? '') ?>"></label>
    <label>Description <textarea name="description"><?= e($editing['description'] ?? '') ?></textarea></label>
    <label>Product details <textarea name="product_details"><?= e($editing['product_details'] ?? '') ?></textarea></label>
    <div class="row">
      <label>Category <input name="category" value="<?= e($editing['category'] ?? '') ?>"></label>
      <label>Material <input name="material" value="<?= e($editing['material'] ?? '') ?>"></label>
      <label>Colours (comma separated) <input name="colours" value="<?= e($editing['colours'] ?? '') ?>"></label>
      <label>Size / dimensions <input name="size_text" value="<?= e($editing['size_text'] ?? '') ?>"></label>
      <label>Product label <input name="promo_badge" placeholder="Popular, New, Handmade For Sale" value="<?= e($editing['promo_badge'] ?? '') ?>"></label>
      <label>Price (<?= e(strtoupper(setting('currency', 'AUD'))) ?>)
        <input name="price" type="number" step="0.01" min="0" value="<?= number_format((int)($editing['price_cents'] ?? 0) / 100, 2, '.', '') ?>"></label>
      <label>Stock <input name="stock" type="number" value="<?= (int)($editing['stock'] ?? 0) ?>"></label>
    </div>
    <div class="row"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_best_seller" value="1" style="width:auto" <?= !empty($editing['is_best_seller']) ? 'checked' : '' ?>> Best seller</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_new" value="1" style="width:auto" <?= !empty($editing['is_new']) ? 'checked' : '' ?>> New product</label></div>
    <label>Photos and videos (pick as many as you like)
      <input type="file" name="media[]" multiple accept="image/*,video/mp4,video/webm,video/quicktime,.mov,.m4v">
      <span class="small muted" style="font-weight:400">Photos up to 10 MB (JPG, PNG, WEBP, GIF, AVIF). Videos up to 100 MB (MP4 works on every phone; WEBM and MOV also accepted). The first photo is the one shown in the shop.</span>
    </label>
    <?php if ($editingMedia): ?>
      <div class="media-admin">
        <?php foreach ($editingMedia as $i => $m): ?>
          <div class="media-admin-item">
            <?php if ($m['kind'] === 'video'): ?><video src="<?= e(url($m['path'])) ?>" muted preload="metadata"></video><span class="pill">video</span>
            <?php else: ?><img src="<?= e(url($m['path'])) ?>" alt=""><?php endif; ?>
            <div>
              <?php if ($i > 0): ?><button class="btn ghost small" type="submit" form="mf<?= (int)$m['id'] ?>">Make first</button><?php endif; ?>
              <button class="btn danger small" type="submit" form="mr<?= (int)$m['id'] ?>" onclick="return confirm('Remove this <?= e($m['kind']) ?>?')">Remove</button>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="visible" value="1" style="width:auto" <?= (!$editing || (int)$editing['visible'] === 1) ? 'checked' : '' ?>>
      Show in the shop
    </label>
    <button class="btn hover-sheen" type="submit"><?= $editing ? 'Save changes' : 'Add product' ?></button>
    <?php if ($editing): ?><a class="btn ghost" href="<?= e(url('?p=admin_products')) ?>">Cancel</a><?php endif; ?>
  </form>

  <div class="card">
    <h2>All products</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Photo</th><th>Name</th><th>Price</th><th>Stock</th><th>Shown</th><th></th></tr></thead>
      <tbody><?php foreach ($products as $p): ?>
        <tr>
          <td><img src="<?= e(url($p['image'] ?: 'assets/logo.png')) ?>" alt="" style="width:46px;height:46px;object-fit:cover;border-radius:8px"></td>
          <td><?= e($p['name']) ?></td>
          <td><?= money((int)$p['price_cents']) ?></td>
          <td><?= (int)$p['stock'] ?></td>
          <td><?= (int)$p['visible'] === 1 ? 'Yes' : 'No' ?></td>
          <td style="white-space:nowrap">
            <a class="btn ghost small" href="<?= e(url('?p=admin_products&edit=' . (int)$p['id'])) ?>">Edit</a>
            <button class="btn danger small" type="submit" form="del<?= (int)$p['id'] ?>"
              onclick="return confirm('Delete this product?')">Delete</button>
          </td>
        </tr>
      <?php endforeach; ?></tbody>
    </table></div>
    <?php foreach ($editingMedia as $m): ?>
      <form id="mr<?= (int)$m['id'] ?>" method="post" style="display:none"><?= csrf_field() ?><input type="hidden" name="action" value="media_remove"><input type="hidden" name="media_id" value="<?= (int)$m['id'] ?>"></form>
      <form id="mf<?= (int)$m['id'] ?>" method="post" style="display:none"><?= csrf_field() ?><input type="hidden" name="action" value="media_first"><input type="hidden" name="media_id" value="<?= (int)$m['id'] ?>"></form>
    <?php endforeach; ?>
    <?php foreach ($products as $p): ?>
      <form id="del<?= (int)$p['id'] ?>" method="post" style="display:none">
        <?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
      </form>
    <?php endforeach; ?>
  </div>
</div>

<?php
require_staff();
$GLOBALS['page_title'] = 'Producten - beheer';
$GLOBALS['page_desc'] = 'Producten toevoegen, foto\'s uploaden en voorraad beheren.';

$errors = [];
if (!defined('SL_MAX_IMAGE')) define('SL_MAX_IMAGE', 10 * 1024 * 1024);

if (!function_exists('save_product_image')) {
function save_product_image(array $file, array &$errors): ?string {
    $allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
    if (empty($file['name'])) return null;
    if ($file['error'] !== UPLOAD_ERR_OK) { $errors[] = 'Uploaden van de foto is mislukt.'; return null; }
    if ((int)$file['size'] > SL_MAX_IMAGE) { $errors[] = 'Foto\'s mogen maximaal 10 MB zijn.'; return null; }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) { $errors[] = 'Gebruik een JPG-, PNG-, WEBP-, GIF- of AVIF-afbeelding.'; return null; }
    $info = @getimagesize($file['tmp_name']);
    if ($info === false) { $errors[] = 'Dit bestand is geen leesbare afbeelding.'; return null; }
    $dir = __DIR__ . '/../uploads/products';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(5)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
        $errors[] = 'De foto kon niet worden opgeslagen. Controleer of de map uploads beschrijfbaar is.';
        return null;
    }
    return 'uploads/products/' . $name;
}
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    $id = (int)($_POST['id'] ?? 0);

    if ($action === 'delete' && $id) {
        $p = one('SELECT image FROM products WHERE id = ?', [$id]);
        if ($p && $p['image']) @unlink(__DIR__ . '/../' . $p['image']);
        q('DELETE FROM products WHERE id = ?', [$id]);
        flash('Product verwijderd.', 'warn');
        redirect('?p=admin_products');
    }

    $name = trim((string)($_POST['name'] ?? ''));
    $price = (int)round(((float)($_POST['price'] ?? 0)) * 100);
    $mpUrl = trim((string)($_POST['marktplaats_url'] ?? ''));
    if ($name === '') $errors[] = 'Geef het product een naam.';
    if ($price < 0) $errors[] = 'De prijs kan niet negatief zijn.';
    if ($mpUrl !== '' && !preg_match('#^https://(www\.)?marktplaats\.nl/#i', $mpUrl)) $errors[] = 'De Marktplaats-link moet beginnen met https://www.marktplaats.nl/';

    $image = save_product_image($_FILES['image'] ?? ['name' => '', 'error' => UPLOAD_ERR_NO_FILE, 'size' => 0], $errors);

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
            $mpUrl !== '' ? $mpUrl : null,
        ];
        if ($action === 'update' && $id) {
            $sql = 'UPDATE products SET name=?, description=?, category=?, material=?, product_details=?, colours=?, size_text=?, promo_badge=?, is_best_seller=?, is_new=?, price_cents=?, stock=?, visible=?, marktplaats_url=?';
            if ($image) { $sql .= ', image=?'; $fields[] = $image; }
            $sql .= ' WHERE id = ?';
            $fields[] = $id;
            q($sql, $fields);
            flash('Product opgeslagen.');
        } else {
            $slug = slugify($name);
            $n = 1;
            while (one('SELECT id FROM products WHERE slug = ?', [$slug])) { $slug = slugify($name) . '-' . (++$n); }
            array_splice($fields, 1, 0, [$slug]);
            $fields[] = $image;
            q('INSERT INTO products (name, slug, description, category, material, product_details, colours, size_text, promo_badge, is_best_seller, is_new, price_cents, stock, visible, marktplaats_url, image)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', $fields);
            flash('Product toegevoegd.');
        }
        redirect('?p=admin_products');
    }
}

$editing = isset($_GET['edit']) ? one('SELECT * FROM products WHERE id = ?', [(int)$_GET['edit']]) : null;
$products = all('SELECT * FROM products ORDER BY created_at DESC');
?>
<h1>Beheer</h1>
<?php admin_tabs('admin_products'); ?>
<?php foreach ($errors as $err): ?><div class="note err"><?= e($err) ?></div><?php endforeach; ?>

<div class="grid cols-2" style="align-items:start">
  <form class="card" method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <h2><?= $editing ? 'Product bewerken' : 'Product toevoegen' ?></h2>
    <input type="hidden" name="action" value="<?= $editing ? 'update' : 'create' ?>">
    <input type="hidden" name="id" value="<?= (int)($editing['id'] ?? 0) ?>">
    <label>Naam <input name="name" required value="<?= e($editing['name'] ?? '') ?>"></label>
    <label>Beschrijving <textarea name="description"><?= e($editing['description'] ?? '') ?></textarea></label>
    <label>Extra details <textarea name="product_details"><?= e($editing['product_details'] ?? '') ?></textarea></label>
    <div class="row">
      <label>Categorie <input name="category" list="cats" placeholder="Draken, Dieren, Magneten..." value="<?= e($editing['category'] ?? '') ?>"></label>
      <label>Materiaal <input name="material" list="materials" placeholder="PLA Basic of PETG Basic" value="<?= e($editing['material'] ?? '') ?>"></label>
      <label>Kleuren (met komma's) <input name="colours" value="<?= e($editing['colours'] ?? '') ?>"></label>
      <label>Afmetingen <input name="size_text" value="<?= e($editing['size_text'] ?? '') ?>"></label>
      <label>Label <input name="promo_badge" placeholder="Populair, Nieuw, Uitverkocht" value="<?= e($editing['promo_badge'] ?? '') ?>"></label>
      <label>Prijs (<?= e(strtoupper(setting('currency', 'EUR'))) ?>)
        <input name="price" type="number" step="0.01" min="0" value="<?= number_format((int)($editing['price_cents'] ?? 0) / 100, 2, '.', '') ?>"></label>
      <label>Voorraad <input name="stock" type="number" value="<?= (int)($editing['stock'] ?? 0) ?>"></label>
    </div>
    <div class="row"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_best_seller" value="1" style="width:auto" <?= !empty($editing['is_best_seller']) ? 'checked' : '' ?>> Populair</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_new" value="1" style="width:auto" <?= !empty($editing['is_new']) ? 'checked' : '' ?>> Nieuw product</label></div>
    <label>Marktplaats-link <input name="marktplaats_url" type="url" placeholder="https://www.marktplaats.nl/v/..." value="<?= e($editing['marktplaats_url'] ?? '') ?>"></label>
    <label>Foto (JPG, PNG, WEBP, GIF of AVIF, max. 10 MB) <input type="file" name="image" accept="image/*"></label>
    <datalist id="materials"><option value="PLA Basic"><option value="PETG Basic"></datalist>
    <datalist id="cats"><?php foreach (['Draken', 'Dieren', 'Magneten', 'Fidgets', 'Sleutelhangers', 'Overig'] as $c): ?><option value="<?= $c ?>"><?php endforeach; ?></datalist>
    <?php if (!empty($editing['image'])): ?>
      <img src="<?= e(url($editing['image'])) ?>" alt="" style="width:130px;border-radius:10px;margin-bottom:12px">
    <?php endif; ?>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="visible" value="1" style="width:auto" <?= (!$editing || (int)$editing['visible'] === 1) ? 'checked' : '' ?>>
      Tonen op de website
    </label>
    <button class="btn hover-sheen" type="submit"><?= $editing ? 'Opslaan' : 'Product toevoegen' ?></button>
    <?php if ($editing): ?><a class="btn ghost" href="<?= e(url('?p=admin_products')) ?>">Annuleren</a><?php endif; ?>
  </form>

  <div class="card">
    <h2>Alle producten</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Foto</th><th>Naam</th><th>Prijs</th><th>Marktplaats</th><th>Zichtbaar</th><th></th></tr></thead>
      <tbody><?php foreach ($products as $p): ?>
        <tr>
          <td><img src="<?= e(url($p['image'] ?: 'assets/logo.svg')) ?>" alt="" style="width:46px;height:46px;object-fit:cover;border-radius:8px"></td>
          <td><?= e($p['name']) ?></td>
          <td><?= money((int)$p['price_cents']) ?></td>
          <td><?= !empty($p['marktplaats_url']) ? '<a href="' . e($p['marktplaats_url']) . '" target="_blank" rel="noopener">link</a>' : '<span class="muted">-</span>' ?></td>
          <td><?= (int)$p['visible'] === 1 ? 'Ja' : 'Nee' ?></td>
          <td style="white-space:nowrap">
            <a class="btn ghost small" href="<?= e(url('?p=admin_products&edit=' . (int)$p['id'])) ?>">Bewerken</a>
            <button class="btn danger small" type="submit" form="del<?= (int)$p['id'] ?>"
              onclick="return confirm('Dit product verwijderen?')">Verwijderen</button>
          </td>
        </tr>
      <?php endforeach; ?></tbody>
    </table></div>
    <?php foreach ($products as $p): ?>
      <form id="del<?= (int)$p['id'] ?>" method="post" style="display:none">
        <?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
      </form>
    <?php endforeach; ?>
  </div>
</div>
